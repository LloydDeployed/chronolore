# Infobox fact visibility and precedence

Status: proposed architecture for CHRN-49; no schema or runtime changes are included.

## Decision summary

Model an infobox field as three separate concepts:

1. A **field definition** says what the article-level field means and how it behaves (`replace` or `append`).
2. A **value** is one semantic assertion, such as `Status = Alive`.
3. A value's **reveal paths** are alternative evidence points. Reaching any one path makes the value visible (OR semantics).

A contributor may instead mark a value as an explicit **article base**. A base is not inferred from the key or article type. It is visible whenever the article is visible, so the contributor and moderator must establish that it is safe under every path which can expose the article.

For `replace` fields, use explicit directed supersession edges. Do not derive precedence from reveal-point order, creation time, or display order. If multiple visible values remain active and none supersedes the others, return and render a conflict instead of silently choosing one.

Resolution should move to a pure server/domain function. Reader and preview APIs should return resolved groups with resolution metadata; `ArticleView` and `ArticlePreview` should not implement their own winner selection.

## Current system and failure modes

The current implementation was inspected in:

- `packages/server/src/db/schema.ts`
- `packages/server/src/middleware/progress.ts`
- `packages/server/src/routes/articles.ts`
- `packages/server/src/routes/contribute.ts`
- `packages/server/src/routes/moderate.ts`
- `packages/web/src/components/block-editor/InfoboxEditor.tsx`
- `packages/web/src/components/ArticleView.tsx`
- `packages/web/src/components/ArticlePreview.tsx`
- `packages/server/src/db/seed.ts`
- `e2e/spoiler-scoping.spec.ts`

Today, each `infobox_fields` row combines the field definition, value, one reveal point, mode, display order, and moderation state. The server filters rows to published rows whose single reveal point is in the reader's expanded progress set (or is null). Both reader and preview clients then group by `fieldKey`. A `replace` group sorts the visible rows by `sortOrder` and displays the last row; an `append` group displays every row.

This has several consequences:

- The same assertion needs duplicate rows to be independently revealed by multiple works. Hoid's `Status = Alive` attached to *The Final Empire* is not visible to a reader who knows him only through *Warbreaker*.
- `sortOrder` is simultaneously presentation order and semantic precedence. Dragging or inserting a row can change the displayed truth.
- Nonlinear progress has no total order, so "latest revealed" is undefined across independent works.
- Two visible, incompatible values are silently resolved by row order even when neither semantically supersedes the other.
- A null reveal point behaves like an article base, but the editor labels it only as `Evergreen`; it does not make the spoiler-safety promise explicit.
- Field label and mode are repeated on every row. Rows with the same key can disagree, and the client accepts the first row's metadata.
- Reader and preview duplicate the same client-side resolver, making API consumers responsible for spoiler-sensitive business logic.

The progress middleware itself already produces the correct primitive for nonlinear resolution: a set of completed reveal-point IDs. Within one entry it expands progress cumulatively by segment `sortOrder`; across entries it preserves set semantics.

### Related article-visibility gap

Fact-level OR paths do not by themselves make an article reachable through multiple works. `articles.introduced_at` is currently one nullable reveal point. For example, the seeded Hoid article is introduced only at *The Final Empire*, chapter 19, so a Warbreaker-only reader receives a 404 before infobox resolution runs.

Article introduction paths should eventually use the same base-or-OR-path concept. That may be delivered with this schema rollout or as a prerequisite/companion task, but it should not be conflated with infobox value precedence. Until then, the new fact model improves facts only for articles that the current article gate already exposes.

## Recommended schema

Names below are descriptive; implementation may follow repository naming conventions. Keep UUID primary keys, timestamps, contributor ownership, and the existing moderation statuses.

### `infobox_field_groups`

One row per semantic field on an infobox.

| Column | Purpose |
| --- | --- |
| `id` | Stable group identity. |
| `infobox_id` | Owning article infobox. |
| `field_key` | Machine key such as `status`, unique within the infobox. |
| `field_label` | Reader label such as `Status`. |
| `mode` | `replace` or `append`; defined once for the group. |
| `sort_order` | Presentation order of the field group only. Never precedence. |
| `status`, `rejection_reason`, `created_by`, timestamps | Review state and provenance for group metadata. |

Add a unique constraint on `(infobox_id, field_key)` and an index on `(infobox_id, sort_order)`.

### `infobox_field_values`

One row per semantic assertion.

| Column | Purpose |
| --- | --- |
| `id` | Stable value identity. |
| `field_group_id` | Owning definition. |
| `field_value` | Display value. |
| `visibility_kind` | `article_base` or `revealed`. No implicit default. |
| `sort_order` | Stable display order among append values or conflict candidates; never precedence. |
| `status`, `rejection_reason`, `created_by`, timestamps | Existing contribution/moderation lifecycle. |

Rules:

- A published `article_base` value has no reveal paths.
- A published `revealed` value has at least one published reveal path.
- A `replace` group should have at most one active published base unless explicit supersession makes the alternatives unambiguous. Prefer blocking a second unsuperseded base during review.
- Multiple base values are valid for an `append` group, for example aliases known whenever the article is visible.
- There is no uniqueness constraint on `field_value`; equal text can represent separate assertions/provenance. The editor should warn about exact duplicates and offer to merge their reveal paths.

### `infobox_field_value_reveal_paths`

| Column | Purpose |
| --- | --- |
| `value_id` | Semantic value made visible by this path. |
| `reveal_point_id` | One sufficient reveal point. |
| `status`, `created_by`, timestamps | Review state and provenance for changing a published value's visibility. |

Use a unique constraint on `(value_id, reveal_point_id)` plus indexes in both lookup directions. Each row is an alternative: `path A OR path B OR ...`. Do not encode an array on the value row; normalized paths retain foreign keys, provenance, moderation, and efficient article reveal-point discovery.

Only published paths participate in reader resolution. Adding a path to a published value therefore goes through review without withdrawing the already published paths.

The write service must prevent publishing a revealed value without at least one published path and prevent withdrawing its last published path while the value remains published.

### `infobox_field_value_supersessions`

| Column | Purpose |
| --- | --- |
| `field_group_id` | Makes same-group integrity enforceable. |
| `successor_value_id` | Value that takes precedence when both endpoints are visible. |
| `predecessor_value_id` | Value suppressed when both endpoints are visible. |
| `status`, `created_by`, timestamps | Review state and provenance. |

Use unique `(successor_value_id, predecessor_value_id)`, reject self-edges, and require both endpoints to belong to `field_group_id`. This can be enforced with composite foreign keys to unique `(id, field_group_id)` value keys. Application validation in the same transaction must reject cycles; a database trigger is optional defense in depth.

An edge means semantic precedence, not chronology: when both values are visible, the successor dominates the predecessor. It is valid even when the two values are revealed through different works. Published edges participate only when both endpoint values are published.

Supersession is useful primarily for `replace` groups. It may also correct or retire an append item, but the editor should hide that advanced operation by default. Normal aliases and simultaneous affiliations should simply accumulate.

### Why not `superseded_at`

A single `superseded_at` reveal point still couples replacement to one timeline and cannot express:

- a successor independently learned in several works;
- death and later resurrection with alternate evidence paths;
- two incomparable claims from nonlinear progress;
- an explicit semantic relationship between the exact predecessor and successor.

A directed edge between values expresses the actual rule and remains independent of how either value became visible.

## Deterministic reader resolution

Inputs are the visible article, its published infobox aggregate, and the reader's completed reveal-point ID set `R`.

Resolve each field group independently:

1. Load published values, published reveal paths, and published supersession edges for the group.
2. A value `v` is eligible when:
   - `v.visibility_kind = article_base`; or
   - `v.visibility_kind = revealed` and at least one path for `v` has `reveal_point_id` in `R`.
3. Build the directed supersession graph over all published values. Direction is successor to predecessor.
4. Compute transitive reachability. An eligible value `v` is dominated when another eligible value can reach `v`, even if intermediate values are not eligible. This preserves `resurrected -> dead -> alive` precedence when a reader learns the resurrection through an alternate path without seeing the original death scene.
5. Active values are eligible values that are not dominated by another eligible value.
6. For `replace` mode:
   - zero active values: omit the group;
   - one active value: return `state = resolved` and that value;
   - more than one active value: return `state = conflict` and every active value. Never select a winner by `sort_order`, reveal point, timestamp, or UUID.
7. For `append` mode, return every active value with `state = resolved`. Supersession can remove a corrected/retired append assertion, but ordinary values accumulate.
8. Sort output deterministically for presentation only: group `sort_order`, then value `sort_order`, then value UUID as a stable final tie-breaker. Ordering does not change resolution.

If a cycle is encountered despite write-time validation, fail safely: mark the group `state = invalid_conflict`, return all eligible values in deterministic order, emit telemetry, and expose the data error to moderators. Do not hide facts using an arbitrary cycle traversal.

The resolver should be a pure function with dense unit tests. Database and route code should only load input, call the resolver, and map the result.

### Suggested reader API shape

```json
{
  "key": "status",
  "label": "Status",
  "mode": "replace",
  "state": "conflict",
  "values": [
    { "id": "...", "value": "Alive" },
    { "id": "...", "value": "Dead" }
  ]
}
```

Normal readers do not need hidden paths or graph edges. For a conflict, the API may include only evidence labels whose reveal points are already in `R`; it must never disclose an unreached work or chapter. Contributor and moderator endpoints can return the full authoring graph.

## Worked examples

### Hoid and nonlinear progress

Define `Status = Alive` as an explicit article base only if every article introduction path safely establishes that fact. Otherwise define one `Alive` value with reveal paths such as *The Final Empire* chapter 19 OR *Warbreaker* epilogue OR another independent appearance. A reader reaching any one path sees the same semantic value; the value is not duplicated.

This requires article-level alternative introduction paths before a Warbreaker-only reader can open the currently seeded Hoid article. The value resolver must not bypass the article gate.

### Death and resurrection

For a character introduced alive:

- `Alive (original)` may be an article base or revealed value.
- `Dead` supersedes `Alive (original)`.
- `Alive (resurrected)` or `Cognitive Shadow` supersedes `Dead` (and therefore transitively the original alive value).

The successor should describe the intended reader fact precisely. If resurrection changes ontology, `Status = Cognitive Shadow` is usually clearer than reusing `Alive`.

If an early prequel can expose the article while the character is alive, `Dead` is not a safe base merely because death is the present-day canonical state. Both values must be reveal-scoped with explicit precedence.

### Aliases

Aliases normally use `append`. One alias value can have multiple OR reveal paths if separate works independently establish it. All eligible aliases accumulate. A corrected spelling can explicitly supersede the incorrect alias without converting the whole group to `replace`.

### Affiliations

Use `append` for concurrent or historical memberships that should accumulate. Use `replace` only when the field means one current/exclusive affiliation. For replace semantics, `Ghostbloods` superseding `Kelsier's crew` must be explicit; publication order or row position is not evidence of replacement.

### Unsuperseded conflict

Suppose one completed work establishes `Status = Alive` and another establishes `Status = Dead`, with no reviewed supersession edge. Both are eligible and active. The reader sees a neutral `Conflicting facts` treatment containing both visible values. The moderator sees a diagnostic with actions to add a supersession edge, change the field mode, merge equivalent values, or keep the intentional conflict.

## Editor and moderation UX

Organize the infobox editor by field group rather than by a flat row list.

### Field group header

- Label, key, and one mode selector.
- Field display-order control, visually separated from precedence.
- Summary badges: number of values, reveal paths, unresolved conflicts, and review items.
- Changing mode requires a confirmation and a preview of the resulting behavior.

### Value card

Each semantic value is one card containing:

- value text and moderation status;
- visibility choice:
  - **Article base — visible whenever this article is visible**; or
  - **Reveal-scoped — visible after any one of these points**;
- a multi-value reveal-point picker rendered as OR chips, never as a chronological list;
- an explicit **Supersedes** picker limited to values in the same group;
- display order for append/conflict presentation, labeled as non-semantic;
- a preview of paths through which the value is visible.

Selecting article base should show a strong confirmation: "This must be safe for every way a reader can reach this article." Show all current article introduction paths. If the article has only the legacy single `introduced_at`, say so. The UI cannot prove semantic safety; moderator review owns that judgment.

### Conflict diagnostics

Before submission and during moderation, evaluate representative progress combinations and show:

- replace values that can be simultaneously active without a precedence relationship;
- duplicate values that should probably share reveal paths;
- mixed or missing paths;
- supersession cycles;
- a base value that conflicts with another value;
- append values with suspicious supersession (warning, not necessarily error).

Block publication for structural invalidity: cycles, cross-group edges, revealed values with no path, or base values with paths. Allow intentional unsuperseded replace conflicts only with moderator acknowledgement; reader behavior remains safe because it presents all visible candidates.

### Reader presentation

For a normal resolved group, preserve the current compact infobox rendering. For a conflict:

- label the field `Conflicting facts` or add a small `disputed` badge;
- list every active visible value without selecting a canonical one;
- optionally show already-unlocked evidence labels;
- do not reveal hidden path names, later values, or the existence of unreached spoilers.

Preview mode must call the same server resolver as reader mode and add a moderator-only explanation panel showing eligibility and dominance. This replaces the duplicated `resolveInfoboxFields` functions in `ArticleView` and `ArticlePreview`.

## Migration and rollout

Use an additive, reversible rollout. Do not change or drop the current schema in the first migration.

1. **Introduce and test the domain resolver.** Define the new API contract and pure resolution tests without changing production reads.
2. **Add normalized tables beside `infobox_fields`.** Add constraints and indexes. Do not backfill or switch reads yet.
3. **Run a read-only audit.** Report inconsistent label/mode per `(infobox_id, field_key)`, duplicate values, null reveals, and the implicit order currently used for replace fields. Resolve malformed groups before automated backfill where possible.
4. **Backfill field groups and values.** Preserve text byte-for-byte and retain a durable old-row-to-new-value mapping. Convert null-reveal rows to explicit `article_base` to preserve current behavior, but flag them for semantic review.
5. **Backfill reveal paths.** Each non-null legacy reveal point becomes one published path. Strictly equivalent legacy rows may be merged into one value with multiple paths only when value, key, label, mode, moderation state, and relevant provenance are compatible; otherwise keep separate values and flag them for review.
6. **Preserve legacy replace behavior explicitly.** For each replace group, create generated supersession edges from every later legacy `sort_order` value to earlier values (with UUID as a deterministic tie-breaker for equal order). Mark these edges as migration-generated and require editorial review. This preserves current output while making the old hidden assumption visible.
7. **Shadow-read and compare.** For recorded progress fixtures, resolve both models and log differences. Expected differences should be zero until editors deliberately add paths or change generated precedence.
8. **Dual-write new edits behind a feature flag.** Keep legacy readers available. Reject edits the legacy representation cannot safely encode, or explicitly keep the new editor disabled until cutover.
9. **Switch reader and preview together.** Server returns resolved groups; both clients become presentation-only. Monitor conflicts, empty revealed values, cycles, and parity mismatches.
10. **Audit bases and generated edges.** Hoid, death/resurrection, aliases, and affiliations are priority review cases. Add intended OR paths and replace generated edges with reviewed semantic edges.
11. **Retire legacy storage later.** Only after a release window, verified backups, and parity reports should `infobox_fields` be made read-only and eventually removed in a separate migration.

### Compatibility and rollback risks

- **Article gate:** Multiple fact paths do not solve single-path article introduction. Treat article path support as an explicit dependency.
- **Implicit-order preservation:** Generated edges preserve behavior but may preserve wrong semantics. They are compatibility scaffolding, not editorial truth.
- **Null reveal conversion:** Treating existing null rows as bases preserves visibility but may expose an existing unsafe assumption. Flag all for review rather than silently blessing them.
- **Moderation atomicity:** Paths and supersession edges affect visibility and must have review state. Publishing a path should not temporarily withdraw already published paths for the same value.
- **API compatibility:** Existing clients expect raw `InfoboxField[]`. Version the response or return both raw and resolved representations during rollout; switch reader and preview in the same release.
- **Duplicate collapse:** Automatic text normalization can merge distinct assertions. Limit auto-merge to strict equivalence and retain an audit map.
- **Graph corruption:** Cycles or cross-group edges must fail safely as visible conflicts, never arbitrary winner selection.
- **Rollback:** Keep old rows synchronized and the old read path feature-flagged until after the observation window. Rollback is then a read-flag change, not a reverse data migration.
- **Performance:** Fetch all groups, values, paths, and edges for one infobox in bounded queries, then resolve in memory. Infobox cardinality is small; avoid per-value queries. Add path and edge indexes before cutover.

No destructive database command should be part of this spike or review.

## Behavioral test matrix

Use pure resolver unit tests for most combinations, route integration tests for publication/filtering boundaries, and a small number of Playwright tests for reader/editor presentation.

| Case | Progress / setup | Expected result | Primary layer |
| --- | --- | --- | --- |
| Explicit article base | Article visible; no value paths completed | Base value is visible | Unit + route |
| Base is not inferred | `status` group has a revealed value but no matching path | Field is absent | Unit |
| Invalid base with path | Base value also has a path | Publication rejected | Integration |
| Invalid revealed value | Revealed value has zero published paths | Publication rejected | Integration |
| OR path A | One value has paths A and B; only A completed | Value visible once | Unit |
| OR path B | Same value; only B completed | Value visible once | Unit |
| OR both paths | Both A and B completed | Value still visible once | Unit |
| Hoid nonlinear progress | Hoid article reachable through Warbreaker; only Warbreaker evidence completed | Shared `Alive` value is visible without Mistborn progress | Route + E2E |
| Hoid article gate regression | Only Warbreaker fact path exists but article still has Mistborn-only introduction | Article remains inaccessible; test documents dependency | Route |
| Replace base only | Base `Alive`, no successor eligible | `Alive` resolved | Unit |
| Death | `Dead` eligible and explicitly supersedes base `Alive` | Only `Dead` resolved | Unit + E2E |
| Resurrection | `Cognitive Shadow` supersedes `Dead`, which supersedes `Alive`; all eligible | Only `Cognitive Shadow` resolved | Unit |
| Resurrection via alternate path | Original `Alive` and resurrection eligible; intermediate `Dead` not eligible | Transitive precedence suppresses original `Alive`; resurrection resolves | Unit |
| Historical figure/prequel | Prequel exposes alive value; later work exposes dead value | Alive for prequel-only; dead when later value is also eligible | Unit |
| Unsuperseded replace conflict | `Alive` and `Dead` eligible, no path between them | `state=conflict`; both returned; no arbitrary winner | Unit + E2E |
| Conflict evidence secrecy | Conflict has visible and hidden evidence paths | UI/API expose only reached evidence labels | Route + E2E |
| Display reorder | Change group/value `sort_order` | Winner/conflict state unchanged; presentation order changes only | Unit |
| Equal sort order | Two active unsuperseded values share order | Conflict returned in deterministic UUID tie order | Unit |
| Direct supersession | B supersedes A and both are eligible | B only | Unit |
| Hidden successor | B supersedes A but B is not eligible | A remains active | Unit |
| Supersession cycle | A supersedes B and B supersedes A | Write rejected; corrupted read returns `invalid_conflict` with both | Integration + unit |
| Cross-group edge | Status value tries to supersede species value | Write rejected | Integration |
| Append aliases | Two independently visible aliases | Both accumulate | Unit + E2E |
| Alias with multiple paths | One alias established in two works | Alias rendered once after either or both works | Unit |
| Corrected alias | Correct spelling supersedes published typo | Only correction rendered when both eligible; typo remains before correction | Unit |
| Concurrent affiliations | Group uses append; two memberships eligible | Both render | Unit |
| Exclusive affiliation | Group uses replace; new affiliation supersedes old | One value at each relevant progress set | Unit |
| Mode consistency | Attempt to create mixed replace/append values in one group | Impossible because mode lives on group | Schema/integration |
| Draft/review isolation | Draft value/path/edge exists beside published data | Reader resolution uses published data only | Integration |
| Preview parity | Same reveal-point set sent to preview and reader resolvers | Identical resolved field state and values | Integration |
| No progress | Article visible, base plus scoped values exist | Base only | Route |
| Legacy parity | Migrated fixtures across chapter 1 and complete progress | New resolver matches current Kelsier infobox output | Migration test |
| Generated precedence review | Backfilled replace rows have explicit generated edges | Output matches old highest-`sortOrder` behavior and audit marks edges | Migration test |
| Duplicate strict merge | Equivalent old rows differ only by reveal point | One value with two paths and durable source mapping | Migration test |
| Non-equivalent duplicate | Same text but different moderation/provenance | Not auto-merged; audit warning emitted | Migration test |

## Implementation boundaries after approval

The first implementation should include the normalized schema, pure resolver, migration audit/backfill tooling, versioned reader response, and tests. It should not broaden into generic passage supersession or infer universal defaults from field templates.

The recommended follow-up is article introduction OR paths, because cross-work characters cannot fully benefit from fact-level OR paths while `articles.introduced_at` remains singular.

## Decision needed before implementation

Decide whether article introduction OR paths ship in the same implementation or as a prerequisite companion task. The recommendation is a prerequisite companion task using the same base-or-path vocabulary: it keeps the infobox schema focused while making the Hoid/Warbreaker acceptance case testable end to end. Shipping infobox paths alone is internally valid, but it cannot fix that reader journey because the current article gate returns 404 first.

# Chronolore v2 — Content Data Model & Editor Design

> Design session: 2026-03-12
> Status: APPROVED DIRECTION — ready for implementation planning

## Decisions Made

| Question | Decision |
|----------|----------|
| Reveal granularity | Chapter-level. Finer is too complex for contributors, coarser loses value. |
| Cross-universe characters (Hoid) | Single article, sections provide series/world context ("Hoid in Mistborn Era 1"), passages gated to relevant series' reveal points. |
| Field versioning | `superseded_at` field in schema (optional). Active value = latest revealed that hasn't been superseded. In schema from day one, dormant in MVP editor. |
| Editor approach | Block-based custom editor (Scratch-like). Each passage is a draggable block with visible reveal point, status, and controls. NOT a rich text editor. |
| Reading orders | One canonical order per universe for MVP. Schema can accommodate multiple orderings later. |
| Collaborative editing | Open contribution (option A). Anyone adds passages, moderator curates ordering and resolves duplicates during review. |

---

## Data Model v2

### Article
```sql
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES universes(id),
  article_type_id UUID NOT NULL REFERENCES article_types(id),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  introduced_at UUID NOT NULL REFERENCES reveal_points(id),
  status article_status NOT NULL DEFAULT 'draft',  -- draft/review/published/rejected
  rejection_reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(universe_id, slug)
);
```

### Section
Named grouping within an article. **No reveal point** — visible if any child passage is visible.

```sql
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  heading TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Passage
The atomic unit of revealable content. Independently gated.

```sql
CREATE TABLE passages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  body TEXT NOT NULL,                                -- markdown content
  reveal_point_id UUID NOT NULL REFERENCES reveal_points(id),
  superseded_at UUID REFERENCES reveal_points(id),   -- optional, dormant in MVP
  sort_order INTEGER NOT NULL DEFAULT 0,
  status article_status NOT NULL DEFAULT 'draft',    -- draft/review/published/rejected
  rejection_reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Infobox
Structured data panel (biography card, quick facts). One per article, optional.

```sql
CREATE TABLE infoboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL UNIQUE REFERENCES articles(id) ON DELETE CASCADE,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### InfoboxField
Individual key/value pairs, independently reveal-gated.

```sql
CREATE TABLE infobox_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  infobox_id UUID NOT NULL REFERENCES infoboxes(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,          -- "status", "aliases", "affiliation", etc.
  field_label TEXT NOT NULL,        -- display label
  field_value TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'replace',  -- 'replace' (latest wins) or 'append' (accumulate)
  reveal_point_id UUID NOT NULL REFERENCES reveal_points(id),
  superseded_at UUID REFERENCES reveal_points(id),  -- dormant in MVP
  sort_order INTEGER NOT NULL DEFAULT 0,
  status article_status NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### ArticleIdentity (post-MVP, schema only)
For OreSeur/TenSoon, secret identities, etc.

```sql
CREATE TABLE article_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id),
  linked_article_id UUID NOT NULL REFERENCES articles(id),
  relationship_type TEXT NOT NULL,  -- replaced_by, alias_of, possessed_by, impersonated_by
  reveal_point_id UUID NOT NULL REFERENCES reveal_points(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### DynamicTable (post-MVP, schema only)
For things like "Known Allomantic Metals" where rows reveal independently.

```sql
CREATE TABLE dynamic_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
  heading TEXT,
  columns JSONB NOT NULL,  -- [{key, label, width?}]
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE dynamic_table_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES dynamic_tables(id) ON DELETE CASCADE,
  data JSONB NOT NULL,     -- {metal: "Iron", ability: "Pulls metals"}
  reveal_point_id UUID NOT NULL REFERENCES reveal_points(id),
  superseded_at UUID REFERENCES reveal_points(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status article_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Visibility Rules

### For Readers
1. **Article** visible if `introduced_at` ≤ reader's progress
2. **Section** visible if ANY of its passages are visible (derived, not stored)
3. **Passage** visible if `reveal_point_id` ≤ progress AND (`superseded_at` IS NULL OR `superseded_at` > progress) AND status = `published`
4. **Infobox** visible if article is visible
5. **InfoboxField** same rules as passage (reveal + supersede + published)
6. **InfoboxField (replace mode):** show the latest revealed, non-superseded value
7. **InfoboxField (append mode):** show all revealed, non-superseded values

### For Authors
1. **Drafts view:** see ALL own content regardless of progress or status
2. **Wiki view:** own draft content appears with visual indicator (dimmed + badge)
3. **Preview mode:** ephemeral progress picker to view article as a reader at any point

### For Moderators
1. Review queue shows only `review` status passages, infobox fields, and articles
2. Can publish/reject individual passages and fields (not just whole articles)
3. Can reorder passages within sections during review
4. Rejection includes reason visible to author

---

## Block Editor Design

### Concept
Each passage is a visible, manipulable block — like Scratch programming blocks. The editor is a structured block assembly tool, not a rich text editor.

### Block Anatomy
```
┌─ 📗 The Final Empire, Ch.5 ───── [draft] ──┐
│                                              │
│  Lost his wife in the Pits of Hathsin       │
│  during a heist gone wrong.                 │
│                                              │
│  [✏️ Edit] [📤 Submit for Review] [⠿ Drag]  │
└──────────────────────────────────────────────┘
```

- Color-coded border/tag by book (each book in the series gets a consistent color)
- Status badge (draft/review/published/rejected)
- Drag handle for reordering (contributors reorder own, moderators reorder all)
- Inline edit: click edit → block expands to textarea + reveal point picker
- Submit for review: sends passage to moderation queue

### Section Assembly
```
┌─ Section: Early Life ─────────── [⠿ Drag] ──┐
│                                               │
│  [passage block 1]                            │
│  [passage block 2]                            │
│  [passage block 3]                            │
│                                               │
│  [+ Add Passage]                              │
└───────────────────────────────────────────────┘

[+ Add Section]
```

Sections are also draggable for reordering. "Add Passage" opens a mini-form: textarea + reveal point picker.

### Infobox Editor
Sidebar or collapsible panel at the top of the article editor:

```
┌─ Infobox ────────────────────────────────────┐
│  [image upload/url]                           │
│                                               │
│  Status:  Alive    📗 FE Ch.1     [draft]    │
│  Aliases: Survivor 📗 FE Ch.3     [draft]    │
│  Status:  Dead     📗 FE Ch.38    [draft]    │
│                                               │
│  [+ Add Field]                                │
└───────────────────────────────────────────────┘
```

Each field row shows key, value, reveal point, and status. "Add Field" lets you pick from templates (for the article type) or add custom.

### Render/Preview Mode
Toggle button: **Edit Mode** ↔ **Preview Mode**

Preview mode:
- Strips all editor controls
- Shows a progress picker at the top
- Renders the article as a reader at that progress would see it
- Clean wiki layout: infobox card + sections + passages

---

## Article Types & Infobox Templates

Each article type provides a default set of infobox field suggestions:

| Type | Default Fields |
|------|---------------|
| Character | image, status, aliases, species, affiliation, born, died |
| Location | image, type, population, affiliation, region |
| Concept | image, type, practitioners, related |
| Event | date, location, participants, outcome |
| Item | image, type, owner, status, abilities |
| Organization | image, type, leader, headquarters, members |

Templates are suggestions — contributors can add/remove/customize fields.

---

## Migration from v1

1. Existing `content_blocks` → `passages` within auto-created sections
2. Block's `heading` → Section heading (group blocks sharing a heading into one section)
3. Block's `reveal_point_id` → Passage's `reveal_point_id`
4. Block's `status` → Passage's `status`
5. Articles, universes, series, entries, segments, reveal_points — unchanged
6. `content_blocks` table retained temporarily for rollback safety, dropped after validation

Migration script runs once, is idempotent, logs all transformations.

---

## Tech Stack

- **Block editor:** React + `dnd-kit` for drag-and-drop, custom block components
- **Text within blocks:** Simple textarea or lightweight markdown input (not Tiptap — blocks handle structure, not rich text)
- **Infobox:** Custom React component with field rows
- **Preview renderer:** Shared component used by both preview mode and the reader-facing wiki view
- **API:** Existing Express + Drizzle + Postgres stack, new routes for sections/passages/infoboxes

---

## Implementation Phases

### Phase 1 — Schema & API
- [ ] New tables: sections, passages, infoboxes, infobox_fields
- [ ] Post-MVP tables created but unused: article_identities, dynamic_tables, dynamic_table_rows
- [ ] Migration script: content_blocks → sections + passages
- [ ] CRUD API endpoints for sections, passages, infobox, infobox_fields
- [ ] Updated visibility query (reader view respects new model)
- [ ] Author visibility (see own drafts in wiki view)

### Phase 2 — Block Editor
- [ ] Section block component (heading, drag, add passage)
- [ ] Passage block component (body, reveal point picker, status, drag, edit)
- [ ] Drag-and-drop reordering (dnd-kit)
- [ ] Infobox editor component
- [ ] Article editor page assembling all blocks

### Phase 3 — Preview & Polish
- [ ] Preview mode with progress picker
- [ ] Reader-facing article view using new data model
- [ ] Moderator review at passage level (publish/reject individual passages)
- [ ] Book-based color coding for reveal points
- [ ] Mobile-responsive block editor

### Phase 4 — Theming & Branding
- [ ] Universe-level theming: `theme` JSONB column on `universes` table
  - `primaryColor`, `accentColor`, `bgColor`, `fontFamily`
  - `logoUrl`, `bannerUrl`
- [ ] Optional series/entry-level theme overrides (inherit from universe, override selectively)
- [ ] Frontend applies theme as CSS custom properties (`--universe-primary`, `--universe-accent`, etc.) when entering a universe context
- [ ] Universe header component: logo, banner, styled navigation
- [ ] Admin UI for setting universe theme (color pickers, image upload)
- [ ] Fallback to default theme when none is set

### Phase 5 — Advanced (post-MVP)
- [ ] `superseded_at` UI for versioned facts
- [ ] Article identity system (OreSeur/TenSoon)
- [ ] Dynamic tables
- [ ] Multiple reading orders per universe

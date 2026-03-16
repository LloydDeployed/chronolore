# Schema v2 — Change Summary

> Generated: 2026-03-13

## Changes from v1 schema

### Modified
- **articles**: `introduced_at` is now **nullable** (was `NOT NULL`). Null = evergreen article, always visible regardless of reader progress.
- **cross_references**: `source_block_id` renamed to `source_passage_id`, now references `passages` instead of `content_blocks`. Will need data migration.

### Removed
- **content_blocks** — replaced by `sections` + `passages`
- **block_type** enum — no longer needed

### New Enums
- **passage_type**: `prose`, `quote`, `note`
- **infobox_field_mode**: `replace`, `append`

### New Tables (MVP)
| Table | Purpose |
|-------|---------|
| `sections` | Named groupings within an article (heading + sort_order). Visibility is derived from child passages. |
| `passages` | Atomic revealable content unit. Markdown body, nullable reveal_point_id, status, passage_type. |
| `infoboxes` | One-per-article structured data panel. Has optional image_url. |
| `infobox_fields` | Key/value pairs on an infobox, independently reveal-gated. Supports replace/append modes. |

### New Tables (Post-MVP, schema only)
| Table | Purpose |
|-------|---------|
| `article_identities` | Secret identity / alias relationships between articles. |
| `dynamic_tables` | Section-attached tables with JSONB column definitions. |
| `dynamic_table_rows` | Independently revealable rows within dynamic tables. |

## Design Decisions
- **No `superseded_at` in MVP** — DESIGN-v2.md includes it in the SQL but we're deferring it. For replace-mode infobox fields, the query will pick the latest revealed value. Can add the column later without breaking anything.
- **Nullable reveal_point_id** everywhere (passages, infobox_fields, article_identities, dynamic_table_rows) means evergreen content.
- **ON DELETE CASCADE** on all child tables (sections→articles, passages→sections, etc.) for clean article deletion.
- **Indexes** added for common query patterns: looking up passages by section, by reveal_point, infobox fields by infobox, etc.

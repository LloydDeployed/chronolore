# Chronolore Data Model

## Core Concept

Every piece of wiki content is tagged with a **reveal point** — the earliest moment in a media timeline where that information becomes available to the audience. Readers set their **progress** (what they've consumed), and the system filters content to only show what's within their completed set.

A universe like the Cosmere has no single mandatory reading order — readers may start with Mistborn, Elantris, or Stormlight. Progress is tracked as a **set of completed entries/segments**, not a single linear position.

## Media Hierarchy

```
Universe
├── Series (organizational grouping — no role in spoiler logic)
│   ├── Entry (Book, Season, Movie, Game)
│   │   ├── Segment (Chapter, Part, Episode, Act)
```

### Universe

The top-level container. Each universe defines its own media structure.

```sql
CREATE TABLE universes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,        -- url-friendly: "cosmere", "star-wars"
  name          TEXT NOT NULL,               -- "The Cosmere"
  description   TEXT,
  image_url     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### Series

An organizational grouping within a universe. Used for display/navigation in the progress picker. **Has no role in spoiler logic or progress tracking.**

```sql
CREATE TABLE series (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id   UUID NOT NULL REFERENCES universes(id),
  slug          TEXT NOT NULL,               -- "mistborn-era-1"
  name          TEXT NOT NULL,               -- "Mistborn Era 1"
  sort_order    INT NOT NULL DEFAULT 0,      -- display order in progress picker
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (universe_id, slug)
);
```

### Entry

A single media item — a book, movie, season, game, etc. Entry slugs are unique within a universe.

```sql
CREATE TYPE entry_type AS ENUM ('book', 'movie', 'season', 'game', 'other');

CREATE TABLE entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id   UUID NOT NULL REFERENCES universes(id),
  series_id     UUID REFERENCES series(id),  -- NULL for ungrouped standalones
  slug          TEXT NOT NULL,               -- "the-final-empire"
  name          TEXT NOT NULL,               -- "The Final Empire"
  entry_type    entry_type NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,      -- order within series (display only)
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (universe_id, slug)
);
```

### Segment

A subdivision within an entry. Optional (movies typically have none).

```sql
CREATE TYPE segment_type AS ENUM ('part', 'chapter', 'episode', 'act', 'other');

CREATE TABLE segments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      UUID NOT NULL REFERENCES entries(id),
  slug          TEXT NOT NULL,               -- "chapter-1", "part-2"
  name          TEXT NOT NULL,               -- "Chapter 1: Ash"
  segment_type  segment_type NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (entry_id, slug)
);
```

## Reveal Points

A reveal point represents a specific moment in the media timeline. This is the core mechanism for spoiler scoping.

```sql
CREATE TABLE reveal_points (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id   UUID NOT NULL REFERENCES universes(id),
  entry_id      UUID NOT NULL REFERENCES entries(id),
  segment_id    UUID REFERENCES segments(id),   -- NULL = entire entry (e.g., a movie)
  UNIQUE (entry_id, segment_id)
);
```

No `global_order` — the Cosmere (and many universes) has no single canonical consumption order. Progress is tracked as a set of completed reveal points, not a linear position.

## Articles

Articles are the wiki pages — character bios, location descriptions, event summaries, etc.

```sql
CREATE TABLE article_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id   UUID REFERENCES universes(id), -- NULL = built-in/global type
  slug          TEXT NOT NULL,                  -- "character", "location", "technology"
  name          TEXT NOT NULL,                  -- "Character", "Location", "Technology"
  icon          TEXT,                           -- emoji or icon name
  UNIQUE (universe_id, slug)
);

-- Built-in types (universe_id = NULL):
-- character, location, event, organization, item, concept

CREATE TABLE articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id   UUID NOT NULL REFERENCES universes(id),
  article_type_id UUID NOT NULL REFERENCES article_types(id),
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,                 -- "Kelsier"
  -- The earliest point at which this article should appear in search/nav:
  introduced_at UUID NOT NULL REFERENCES reveal_points(id),
  status        TEXT NOT NULL DEFAULT 'draft', -- draft, review, published
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (universe_id, slug)
);
```

## Content Blocks

Articles are composed of content blocks, each independently tagged with a reveal point. This is the hybrid section/fact-level approach.

```sql
CREATE TYPE block_type AS ENUM ('section', 'fact', 'relationship', 'image', 'quote');

CREATE TABLE content_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id    UUID NOT NULL REFERENCES articles(id),
  parent_id     UUID REFERENCES content_blocks(id),  -- for nesting (facts within sections)
  block_type    block_type NOT NULL,
  reveal_point_id UUID NOT NULL REFERENCES reveal_points(id),
  sort_order    INT NOT NULL DEFAULT 0,

  -- Content (type-dependent):
  heading       TEXT,                          -- section heading
  body          TEXT,                          -- markdown content
  metadata      JSONB DEFAULT '{}',           -- flexible: relationship target, image url, etc.

  -- Moderation:
  status        TEXT NOT NULL DEFAULT 'draft', -- draft, review, published
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blocks_article_reveal
  ON content_blocks(article_id, reveal_point_id);
```

### Block Types

- **section** — A headed section (e.g., "Appearance", "History"). Can contain child blocks.
- **fact** — A single tagged paragraph/statement. The atomic unit.
- **relationship** — A connection to another article (e.g., "ally of Vin"). Has `metadata.target_article_id` and `metadata.relationship_type`.
- **image** — An illustration or diagram.
- **quote** — A notable quote with source attribution.

### Hybrid Model

Sections provide structure. Facts within sections provide granularity. Contributors can choose their level of detail:

```
Article: Kelsier
├── Section: "Overview" [revealed: Final Empire Ch 1]
│   ├── Fact: "A Mistborn and skaa thief" [revealed: Final Empire Ch 1]
│   └── Fact: "Known as the Survivor of Hathsin" [revealed: Final Empire Ch 3]
├── Section: "Abilities" [revealed: Final Empire Ch 4]
│   ├── Fact: "Full Mistborn — can burn all metals" [revealed: Final Empire Ch 4]
│   └── Fact: "Exceptionally skilled with iron and steel" [revealed: Final Empire Ch 7]
├── Section: "History" [revealed: Final Empire Ch 1]
│   ├── Fact: "Survived the Pits of Hathsin" [revealed: Final Empire Ch 1]
│   └── Fact: "..." [revealed: Final Empire Ch 38]
```

A section is visible if at least one of its child blocks is visible (or the section itself is within progress).

## Cross-References

Links between articles that respect spoiler scoping.

```sql
CREATE TABLE cross_references (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_block_id   UUID NOT NULL REFERENCES content_blocks(id),
  target_article_id UUID NOT NULL REFERENCES articles(id),
  -- The cross-reference inherits the reveal_point of its source block.
  -- It's only visible if BOTH the source block AND the target article
  -- are within the reader's progress.
);
```

## Users & Progress

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'contributor', -- contributor, moderator, admin
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Per-universe role overrides
CREATE TABLE universe_roles (
  user_id       UUID NOT NULL REFERENCES users(id),
  universe_id   UUID NOT NULL REFERENCES universes(id),
  role          TEXT NOT NULL,  -- contributor, moderator, admin
  PRIMARY KEY (user_id, universe_id)
);
```

### Progress Tracking

Progress is stored as a **set of completed reveal points**, not a single linear value. This supports non-linear universes where readers can consume entries in any order.

```sql
CREATE TABLE user_progress (
  user_id         UUID NOT NULL REFERENCES users(id),
  reveal_point_id UUID NOT NULL REFERENCES reveal_points(id),
  completed_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, reveal_point_id)
);
```

### Anonymous Progress (localStorage)

For anonymous readers, progress is stored in localStorage as a flat map of entry slugs to segment progress. Entry slugs are unique within a universe, so series grouping is not needed in the payload:

```json
{
  "cosmere": {
    "the-final-empire": "chapter-20",
    "well-of-ascension": "complete",
    "elantris": "complete"
  }
}
```

Values:

- `string` (segment slug) — completed through that segment (e.g., `"chapter-20"`, `"prologue"`, `"epilogue"`)
- `"complete"` — entire entry completed
- absent / `null` — not started

The server expands this into the full set of reveal point IDs for query filtering. This keeps the localStorage payload compact regardless of universe size.

### Progress Picker

The progress picker UI uses the series grouping for display, but writes a flat entry map:

```
Cosmere
├── Mistborn Era 1
│   ├── ☑ The Final Empire (20/38)
│   ├── ☐ Well of Ascension
│   └── ☐ Hero of Ages
├── Elantris
│   └── ☑ Elantris ✓
├── Stormlight Archive
│   └── ☐ The Way of Kings
```

Checking a segment marks all prior segments within that entry. Checking a series checkbox marks all entries in that series complete. Series is purely organizational.

## External Sources

For non-media sources like Words of Brandon, interviews, etc.

```sql
CREATE TABLE external_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id   UUID NOT NULL REFERENCES universes(id),
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,               -- "Words of Brandon"
  source_type   TEXT NOT NULL,               -- "author_commentary", "interview", "panel"
  url           TEXT,                        -- link to original source
  date          DATE,
  -- External sources get their own reveal point
  reveal_point_id UUID NOT NULL REFERENCES reveal_points(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (universe_id, slug)
);
```

## Core Query Pattern

The fundamental query — "get article content for a reader with a given progress set":

```sql
SELECT cb.*
FROM content_blocks cb
WHERE cb.article_id = $article_id
  AND cb.status = 'published'
  AND cb.reveal_point_id = ANY($reader_reveal_points)
ORDER BY cb.sort_order;
```

For authenticated users, this can be a join:

```sql
SELECT cb.*
FROM content_blocks cb
JOIN user_progress up ON up.reveal_point_id = cb.reveal_point_id
WHERE cb.article_id = $article_id
  AND cb.status = 'published'
  AND up.user_id = $user_id
ORDER BY cb.sort_order;
```

Article visibility in search/nav:

```sql
SELECT a.*
FROM articles a
WHERE a.universe_id = $universe_id
  AND a.status = 'published'
  AND a.introduced_at = ANY($reader_reveal_points);
```

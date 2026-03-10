# Chronolore Architecture

## Tech Stack

| Layer    | Choice                                          | Rationale                                                                                  |
| -------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Frontend | React + TypeScript (Vite)                       | Lloyd's stack, large ecosystem, SSR-ready with frameworks                                  |
| Backend  | Node.js + Express + TypeScript                  | Matches frontend language, simple and proven                                               |
| Database | PostgreSQL                                      | JSONB for flexible metadata, strong indexing, relational integrity for the media hierarchy |
| ORM      | Drizzle                                         | Type-safe, lightweight, good Postgres support                                              |
| Auth     | Passport.js (local + OAuth)                     | Simple, extensible                                                                         |
| Search   | PostgreSQL full-text (v1) → MeiliSearch (later) | FTS is good enough for MVP, scoped queries are easier in Postgres                          |
| Content  | Markdown (stored)                               | Contributors write markdown, rendered client-side                                          |
| Cache    | Redis (optional v2)                             | Not needed for MVP                                                                         |

## Project Structure

```sh
chronolore/
├── docs/                    # Design docs (you are here)
├── packages/
│   ├── shared/              # Shared types, validation, constants
│   │   └── src/
│   │       ├── types/       # TypeScript interfaces matching data model
│   │       └── validation/  # Zod schemas for API payloads
│   ├── server/              # Express API
│   │   └── src/
│   │       ├── db/          # Drizzle schema, migrations
│   │       ├── routes/      # Express route handlers
│   │       ├── middleware/  # Auth, progress resolution, error handling
│   │       └── services/    # Business logic
│   └── web/                 # React SPA
│       └── src/
│           ├── components/  # UI components
│           ├── pages/       # Route-level pages
│           ├── hooks/       # Custom hooks (useProgress, useArticle, etc.)
│           ├── stores/      # State management (progress, auth)
│           └── api/         # API client
├── package.json             # Workspace root
└── README.md
```

Monorepo with npm workspaces. Shared types between frontend and backend.

## API Design

REST, scoped by universe. The reader's progress is sent as a header or query param.

### Progress Resolution

Every request includes progress context:

- **Anonymous:** `X-Chronolore-Progress: <JSON>` header or query param (client sends flat entry map from localStorage)
- **Authenticated:** Server reads from `user_progress` table (set of completed reveal points), header can override
- Server expands either format into a `UUID[]` of reveal point IDs used for filtering

### Key Endpoints

```md
# Universes
GET    /api/universes
GET    /api/universes/:slug

# Media hierarchy (for progress picker)
GET    /api/universes/:slug/media          # full tree: series → entries → segments

# Articles (progress-scoped)
GET    /api/universes/:slug/articles       # list (filtered by progress)
GET    /api/universes/:slug/articles/:slug # single article (blocks filtered by progress)

# Search (progress-scoped)
GET    /api/universes/:slug/search?q=      # full-text, respects progress

# Progress (authenticated)
GET    /api/progress/:universe_slug
PUT    /api/progress/:universe_slug        # { progress: <global_order> }

# Contributing (authenticated)
POST   /api/universes/:slug/articles                    # create article
POST   /api/universes/:slug/articles/:slug/blocks       # add content block
PUT    /api/universes/:slug/articles/:slug/blocks/:id   # edit block
POST   /api/universes/:slug/articles/:slug/blocks/:id/review  # submit for review

# Admin
PUT    /api/universes/:slug/articles/:slug/blocks/:id/publish
POST   /api/universes/:slug/media/series    # add series
POST   /api/universes/:slug/media/entries   # add entry
POST   /api/universes/:slug/media/segments  # add segment
POST   /api/universes/:slug/article-types   # add custom article type
```

## Frontend Architecture

### Progress State

Progress is the central piece of client state. Everything renders relative to it.

```typescript
// localStorage representation — flat map of entry slugs to segment progress
interface ProgressState {
  [universeSlug: string]: {
    [entrySlug: string]: number | "complete"; // segment sort_order | entire entry
  };
}
```

Example:
```json
{
  "cosmere": {
    "the-final-empire": 20,
    "well-of-ascension": "complete",
    "elantris": "complete"
  }
}
```

- Entry slugs are unique within a universe — no series key needed
- Stored in localStorage for anonymous users
- Synced to server for authenticated users (server stores as reveal point set)
- Exposed via `useProgress(universeSlug)` hook
- Server expands the flat map into a full set of reveal point IDs for query filtering

### Progress Picker

The main UI for setting progress. Renders the media tree as a checklist:

```md
☑ Mistborn Era 1
  ☑ The Final Empire
    ☑ Part 1 (Ch 1-6)
    ☑ Part 2 (Ch 7-15)
    ☐ Part 3 (Ch 16-25)  ← reader is here
    ☐ Part 4 (Ch 26-35)
    ☐ Epilogue
  ☐ Well of Ascension
  ☐ Hero of Ages
☐ Mistborn Era 2
  ...
```

Checking a segment automatically checks everything before it. Simple and visual.

### Article Rendering

1. Fetch article with blocks (server already filters by progress)
2. Render block tree: sections with nested facts
3. Cross-references link to other articles (only if target is within progress)
4. Show subtle progress indicator: "Viewing through: The Final Empire, Part 2"

### Editor (Contributing)

- Markdown editor with reveal point selector
- Side-by-side preview at any progress point
- "Quick tag" — select text, assign reveal point in one click
- Diff view for moderator review

## Deployment (v1)

- **Server:** Single Node process (Express serves API + static frontend build)
- **Database:** PostgreSQL (managed or self-hosted)
- **Hosting:** Any VPS, Docker, or platform (Railway, Fly.io, etc.)
- **Optional:** Docker Compose for easy self-hosting

Keep it simple. Scale later.

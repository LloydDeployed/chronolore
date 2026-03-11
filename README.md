# Chronolore

A spoiler-safe wiki platform where content is scoped to what you've actually read, watched, or played.

## The Problem

Fan wikis are spoiler minefields. You look up a character from the book you're reading and immediately learn they die in Book 3. Chronolore solves this by tagging every piece of content with its reveal point, then filtering based on your progress.

## How It Works

1. **Set your progress** — Check off which books, chapters, episodes, or movies you've completed
2. **Browse safely** — Articles only show information available at your progress point
3. **Contribute** — Tag content with reveal points so others can browse safely too

## Key Principles

- **No spoiler placeholders** — Hidden content is simply absent, not teased with "[SPOILER]" blocks
- **Existence is a spoiler** — Characters, locations, and concepts don't appear in search until they've been introduced at your progress point
- **Explicit reveals** — Content is tagged to when it's explicitly confirmed, not when it's foreshadowed
- **Media-agnostic** — Works for books, TV, movies, games, and any combination

## Tech Stack

- **Frontend:** React + TypeScript (Vite)
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** JWT (anonymous reading, accounts for contributing)

## Quick Start

```bash
# Prerequisites: Node 20+, pnpm, Docker

git clone https://github.com/LloydDeployed/chronolore.git
cd chronolore

# Configure
cp .env.example .env
# Edit .env with your database URL and JWT secret

# Start database
docker compose up -d

# Install and build
pnpm install
pnpm db:migrate    # Push schema to database
pnpm db:seed       # Seed with Cosmere / Mistborn Era 1

# Development
pnpm dev           # Frontend on :4000, API on :4001
```

## Production Deployment

```bash
# Set environment variables
export POSTGRES_PASSWORD=your-secure-password
export JWT_SECRET=your-secure-secret

# Build and run
docker compose -f docker-compose.prod.yml up -d --build

# Push schema and seed (first time only)
docker compose -f docker-compose.prod.yml exec app \
  node -e "import('drizzle-kit').then(m => m.push())"
```

The app serves on port 4001. Put it behind a reverse proxy (Caddy, nginx) for SSL.

## Architecture

```
Universe (e.g., "The Cosmere")
├── Series (e.g., "Mistborn Era 1") — organizational grouping, no spoiler role
│   ├── Entry (e.g., "The Final Empire") — book, movie, season, game
│   │   └── Segment (e.g., "Chapter 5") — chapter, episode, act
│   │       └── Reveal Point — tags content to this moment
```

Every article and content block is tagged with a **reveal point**. Reader progress is stored as a set of completed entries/segments. Content is visible only if its reveal point is within the reader's progress set.

See [docs/data-model.md](docs/data-model.md) and [docs/architecture.md](docs/architecture.md) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for content guidelines and development setup.

## License

- **Code:** MIT
- **Content:** [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

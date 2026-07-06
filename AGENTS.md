# AGENTS.md — Agent Instructions for Chronolore

## Database Migrations

After ANY schema change (new tables, columns, indexes, constraints):

```bash
cd packages/server
pnpm db:migrate
```

This MUST be run before considering the task done. Do not leave unapplied schema changes.

Currently `db:migrate` runs `drizzle-kit push` (direct schema sync). If this changes to file-based migrations in the future, the command stays the same.

## Project Structure

- `packages/client` — React + Vite frontend
- `packages/server` — Express + TypeScript backend, Drizzle ORM
- `packages/shared` — Shared types
- Database: PostgreSQL in Docker (`chronolore-db-1`)

## Docker

Use `DOCKER_HOST=unix:///var/run/docker.sock` when running docker commands (not Docker Desktop socket).

## Worktrunk

Use worktrunk for isolated branch work to avoid stomping the dev server:
```bash
wt switch --create <branch> --yes
# ... work ...
wt merge <branch> --yes
```

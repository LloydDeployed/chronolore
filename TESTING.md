# E2E Testing with Playwright

## Prerequisites

- Docker running with PostgreSQL on port 5436
- Database seeded: `pnpm db:seed`
- Chromium browser installed: `npx playwright install chromium`

## Running Tests

```bash
# Run all E2E tests (starts dev servers automatically)
pnpm test:e2e

# Interactive UI mode
pnpm test:e2e:ui

# Run a specific test file
npx playwright test e2e/spoiler-scoping.spec.ts

# Run with headed browser (see the browser)
npx playwright test --headed

# Debug a test
npx playwright test --debug
```

## Test Structure

| File | What it tests |
|------|---------------|
| `e2e/auth.spec.ts` | Register, login, session persistence, logout |
| `e2e/spoiler-scoping.spec.ts` | Content filtering based on reading progress — the core feature |
| `e2e/reading-progress.spec.ts` | Setting progress via sidebar, localStorage persistence |
| `e2e/contribution-moderation.spec.ts` | Draft creation, review submission, moderation approval/rejection |

## Architecture

- Tests use the **real database** (seeded Cosmere/Mistborn data)
- Auth setup uses direct API calls for speed, UI interactions for the auth flow tests
- Progress is set via `localStorage` to match how the app works
- Each test creates unique users/articles (via `uniqueId()`) for isolation
- Config starts both server (port 4001) and web (port 4000) dev servers automatically

## Important Notes

- Tests run **serially** (`workers: 1`) because they share the database
- The seed user `testadmin` / `chronolore` (admin@chronolore.dev) is used as the moderator
- New test users are created with unique emails to avoid conflicts
- The `X-Chronolore-Progress` header is derived from localStorage by the frontend

# Contributing to Chronolore

Thanks for helping build the spoiler-safe wiki! Here's how to contribute.

## Content Contributions

### The Golden Rule: Tag to the Explicit Reveal

Every piece of content must be tagged with the **earliest point where the information is explicitly revealed** — not where it's foreshadowed, hinted at, or could be inferred. If a character's true identity is hinted in Chapter 3 but confirmed in Chapter 15, tag it to Chapter 15.

### Article Guidelines

- **One article per subject** — don't create duplicate pages
- **Set the introduction point** to when the subject first appears or is first mentioned by name
- **Article existence is a spoiler** — an article won't appear for readers who haven't reached the introduction point

### Content Block Guidelines

- **Sections** group related facts with a heading. Use for "Overview", "Abilities", "History", etc.
- **Facts** are individual statements tagged independently. Prefer granular facts over long paragraphs — they scope better.
- **Quotes** are notable in-universe quotes with attribution.
- Tag each block to the chapter/episode where the information is **explicitly confirmed**.
- If a section heading itself is a spoiler (e.g., "Death"), tag the section to the reveal point of that event.

### Content Status

All new contributions start as **draft** and must be reviewed by a moderator before they're visible to readers:

1. **Draft** — Just created, only visible in moderation queue
2. **Review** — Submitted for review
3. **Published** — Visible to readers at the appropriate progress point

### Style Guide

- Write in third person, present tense ("Kelsier is a Mistborn" not "Kelsier was a Mistborn")
- Be concise — wiki summaries, not essays
- Avoid speculation — stick to what's in the source material
- Don't copy text directly from the source material (fair use applies to summaries and commentary)

## Code Contributions

### Setup

```bash
git clone https://github.com/LloydDeployed/chronolore.git
cd chronolore
pnpm install
docker compose up -d     # Postgres on port 5435
pnpm db:migrate          # Push schema
pnpm db:seed             # Seed Mistborn Era 1 data
pnpm dev                 # Frontend :4000, API :4001
```

### Project Structure

```
packages/
├── shared/    # TypeScript types shared between frontend and backend
├── server/    # Express API + Drizzle ORM + PostgreSQL
└── web/       # React + Vite frontend
```

### Key Patterns

- **Progress is a set, not a point** — readers can consume entries in any order
- **Reveal points** are the core mechanism — every content block is tagged with one
- **Article existence is scoped** — articles have an `introduced_at` reveal point

### Submitting Changes

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Ensure `pnpm build` passes
5. Open a PR with a clear description

## License

- Code: MIT
- Content contributions: CC-BY-SA 4.0

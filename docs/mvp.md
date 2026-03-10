# Chronolore MVP

## Goal

A functional spoiler-safe wiki for Mistborn Era 1 that demonstrates the core concept. Enough to show to the 17th Shard community and get feedback.

## In Scope (v1)

### Reader Experience
- [ ] Progress picker (checklist UI for Mistborn Era 1 media tree)
- [ ] Progress persisted in localStorage
- [ ] Article list filtered by progress
- [ ] Article page with content blocks filtered by progress
- [ ] Search filtered by progress
- [ ] Article existence hidden until introduction point
- [ ] Cross-reference links (hidden if target not yet introduced)
- [ ] Progress indicator on article pages ("Viewing through: ...")
- [ ] Mobile-responsive layout

### Content
- [ ] Seed data: Cosmere universe, Mistborn Era 1 series, books, chapters
- [ ] Seed articles: 10-15 key characters, 5-10 locations, major events
- [ ] All seed content tagged with reveal points

### Contributing
- [ ] User registration / login
- [ ] Create article (select type, set introduction point)
- [ ] Add/edit content blocks with reveal point tagging
- [ ] Markdown editor with preview
- [ ] Content goes to "review" status by default

### Moderation
- [ ] Review queue for moderators
- [ ] Publish/reject content blocks
- [ ] Basic universe admin (add series, entries, segments)

### Infrastructure
- [ ] Monorepo setup (npm workspaces)
- [ ] Database migrations
- [ ] Docker Compose for local dev
- [ ] Basic deployment config

## Out of Scope (Later)

- Multiple reading orders per universe
- Content import from existing wikis (MediaWiki)
- OAuth login (GitHub, Google, Discord)
- Redis caching
- Discord bot / API embeds
- Contribution stats / leaderboards
- Edit history / diffing
- "Show all" override mode
- External sources (Words of Brandon)
- Self-hosting documentation
- Multiple universes (infra supports it, just no seed data)
- Image uploads (v1 uses external URLs)
- i18n

## Milestones

### M1: Foundation
- Monorepo, database, migrations, shared types
- Media hierarchy CRUD (admin seeding)
- Seed Mistborn Era 1 data

### M2: Core Reading
- Progress picker + localStorage
- Article list + detail pages with progress filtering
- Search

### M3: Contributing
- Auth (register/login)
- Article + block creation with tagging
- Markdown editor

### M4: Moderation & Polish
- Review queue
- Publish flow
- Mobile polish
- Seed 10-15 articles with real content

### M5: Launch Prep
- Deploy to hosting
- Landing page explaining the concept
- README + contributing guide

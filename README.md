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
- **Database:** PostgreSQL with JSONB
- **Auth:** Anonymous reading (progress in localStorage), accounts for contributing
- **License:** MIT (code), CC-BY-SA 4.0 (user-contributed content)

## Project Status

🚧 Early development — data model and architecture phase.

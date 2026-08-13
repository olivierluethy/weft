<div align="center">

<img src="apps/web/public/favicon.svg" width="72" height="72" alt="Weft" />

# Weft

**A local-first, self-hostable Notion clone. A woven web of connected notes.**

Nested pages · block editor · real-time collaboration · version history · graph view — all on your machine, in one command.

</div>

---

## Quick start

```bash
pnpm install
pnpm dev
```

That's it. `pnpm dev` auto-creates `.env` (from `.env.example`), sets up a local SQLite
database, and starts everything:

- **Web app** → http://localhost:5173
- **API + collaboration server** → http://localhost:4000

Create an account on the login screen and you're in. No external services, no API keys,
no database server to run.

> Optional demo account: `pnpm seed` creates `demo@weft.local` / `weftdemo1`.

### Requirements
- Node ≥ 20 and **pnpm** (`npm i -g pnpm`).

---

## What's inside

A **pnpm-workspaces monorepo**:

```
apps/
  web/       React + Vite + TypeScript + Tailwind — the client
  server/    Fastify + TypeScript + Prisma (SQLite) — API + Yjs collaboration
packages/
  shared/    Types & zod contracts shared by both ends
docs/
  STYLEGUIDE.md   The single source of truth for the visual system
```

### Features

**Accounts & security** — register / login / logout, argon2 password hashing, rotating
refresh tokens in httpOnly cookies, a **“stay logged in”** option, email-based password
reset (dev fallback prints the link to the console + `apps/server/data/outbox/outbox.log`),
change email / password / profile / avatar, a **device & session overview** with
device · location · dates, session revocation, and a full formatted **login audit log**.

**Pages & editor** — infinitely nested pages, a sidebar tree with **woven indent guides**,
subtree hover highlighting, collapse/expand and **drag-and-drop reorder & re-parent**;
breadcrumbs; a **BlockNote** block editor with a slash menu (headings, text styles, lists,
checkboxes, tables, code with highlighting, images, embeds); per-page **icon**
(emoji / upload / image search), **cover** and **background**, **lock/unlock**, star,
**draggable width** + full-width toggle, live **stats** (words / sentences / characters /
reading time), and **per-page & global custom CSS** (CodeMirror, applied live and scoped).

**Media, search, import/export** — image upload + URL preview + keyless **Openverse /
Wikimedia** image search; full-text search with a **⌘K** quick switcher and command
palette; **@page mentions with backlinks**; export a page to **PDF · Markdown · HTML ·
JSON · DOCX**, and whole-workspace JSON export.

**Version history (Git-style)** — snapshots on debounce, on page-leave, and on demand; a
**diff viewer** highlighting additions/removals; restore any version; export the history.

**Collaboration** — workspaces with roles (owner / editor / viewer), **email invitations**,
public read-only **share links**, real-time **co-editing with presence cursors** (Yjs +
Hocuspocus), and comments.

**Extras** — trash + restore, page templates, tags, a **network graph** of pages +
backlinks, dark / light / system theme, and keyboard shortcuts.

---

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Bootstrap + run web & server together |
| `pnpm build` | Type-check and build all packages |
| `pnpm setup` | Create `.env` and sync the DB schema |
| `pnpm seed` | Seed a demo account |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm --filter @weft/server prisma:studio` | Browse the database |

---

## Configuration

Everything is optional — see `.env.example` for the full list with working defaults.

- **Database** — SQLite by default (`file:./dev.db`). To use **Postgres**, set
  `DATABASE_URL` to your server and change `provider` to `postgresql` in
  `apps/server/prisma/schema.prisma`, then `pnpm --filter @weft/server prisma:migrate`.
- **Email** — set `SMTP_*` to send real reset/invite emails; otherwise links go to the
  console + local outbox file.
- **Auth secrets** — change `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` before exposing
  the server beyond localhost.

---

## Tech

React · Vite · TypeScript · TailwindCSS · BlockNote (ProseMirror) · Yjs + Hocuspocus ·
Fastify · Prisma · SQLite · argon2 · Openverse · react-force-graph.

The visual system is documented in [`docs/STYLEGUIDE.md`](docs/STYLEGUIDE.md) and is the
source of truth for every colour, type and spacing decision.

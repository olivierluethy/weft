# Weft — Developer Handoff & Architecture Notes

> A living document for anyone picking up **Weft**. It explains how the app is put
> together, the decisions behind it, the non-obvious gotchas, and what's deliberately
> left unfinished. Pair it with [`README.md`](../README.md) (how to run) and
> [`STYLEGUIDE.md`](./STYLEGUIDE.md) (the visual source of truth).
>
> _Last updated: 2026-08-13._

---

## 1. What Weft is

A local-first, self-hostable Notion clone. One command (`pnpm dev`) boots the whole thing
against a single SQLite file — no external services, no API keys. It reproduces the
non-AI Notion feature set (nested pages, block editor, covers/icons, version history,
sharing, real-time collaboration, a page graph, per-page CSS, full accounts) plus a few
extras (trash, templates, tags, an Explorer-style path bar, a richer search).

**Stack:** pnpm-workspaces monorepo · React + Vite + TypeScript + Tailwind (web) ·
Fastify + Prisma + SQLite (server) · BlockNote (editor) · Yjs + Hocuspocus (collab) ·
zod contracts shared between both ends.

---

## 2. Monorepo layout

```
apps/
  web/      React client. Vite dev server on :5173, proxies /api and /collab to :4000.
  server/   Fastify API + Hocuspocus websocket, all on :4000. Prisma/SQLite.
packages/
  shared/   Types + zod schemas imported by both apps (compile-time only; source-linked).
docs/
  STYLEGUIDE.md  Visual system — the single source of truth. Change it BEFORE restyling.
  HANDOFF.md     This file.
scripts/
  setup.mjs      Zero-config bootstrap: ensures .env + syncs the DB. Runs before `pnpm dev`.
```

`@weft/shared` is consumed as source (`main`/`types` point at `src/index.ts`), so there's
no build step for it during dev — both apps typecheck against the same TypeScript.

### Key scripts (root `package.json`)
| Command | Effect |
| --- | --- |
| `pnpm dev` | `node scripts/setup.mjs` then runs server + web via `concurrently`. |
| `pnpm build` | Builds shared → server → web (also the CI-ish typecheck gate). |
| `pnpm setup` | Create `.env` from `.env.example` and `prisma db push`. |
| `pnpm seed` | Seed a demo account (`demo@weft.local` / `weftdemo1`). |
| `pnpm typecheck` | `tsc --noEmit` across every workspace. |

---

## 3. Running & environment

- **Zero-config boot:** `scripts/setup.mjs` copies `.env.example`→`.env` if missing and runs
  `prisma db push` from the repo root (so Prisma loads the root `.env`; the SQLite path
  resolves relative to `schema.prisma` regardless of cwd).
- **All config lives in the root `.env`** (`apps/server/src/env.ts` loads `../../.env` then a
  server-local `.env`). Everything has a working default; you can boot with an empty file.
- **Swapping to Postgres:** set `DATABASE_URL`, change `provider` in
  `apps/server/prisma/schema.prisma` to `postgresql`, run `prisma:migrate`. The schema
  deliberately avoids DB-specific features so it's a drop-in (see §5.2).

---

## 4. Backend architecture (`apps/server`)

### 4.1 Composition
`src/index.ts` builds the Fastify instance, registers plugins (cors, cookie, jwt,
multipart, static `/uploads`, websocket, the auth plugin), mounts a single global error
handler, wires the Hocuspocus websocket at `COLLAB_PATH` (`/collab`), and registers every
route module under `/api/*`.

- **Routes** live in `src/routes/*.ts`, each a Fastify plugin. Most add
  `app.addHook('preHandler', app.authenticate)` so the whole module is authenticated.
  A few register absolute paths under the `/api` prefix because they mix
  `/pages/:id/...` and top-level paths (versions, comments, tags, share, invites, graph).
- **`src/lib/*`** holds the reusable pieces: `crypto` (argon2 + token hashing), `auth`
  (session issue/rotate + cookies), `audit` (login log), `geo` (ip-api, cached, never
  throws), `ua` (ua-parser), `mail` (nodemailer + dev outbox), `permissions` (role checks),
  `serialize` (row → API view with date-fns formatting), `text` (BlockNote → plain text,
  word count, mention extraction), `bootstrap` (default workspace + welcome page), `http`
  (typed `HttpError` helpers + `clientIp`).
- **Error handling:** throw `HttpError` (or the `badRequest`/`forbidden`/… helpers) or a
  `ZodError`; the global handler in `index.ts` maps both to clean JSON. Don't hand-format
  error responses in routes.

### 4.2 Auth model (the important one)
- **Passwords:** argon2id (`lib/crypto.ts`).
- **Access token:** short-lived JWT (`@fastify/jwt`) in the `weft_at` httpOnly cookie,
  payload `{ sub: userId, sid: sessionId }`.
- **Refresh token:** an opaque random string stored **hashed** (sha256) on the `Session`
  row. The `weft_rt` cookie carries `${sessionId}.${rawToken}`. On refresh we look up the
  session, compare hashes, **rotate** the raw token, and re-issue both cookies
  (`lib/auth.ts::rotateSession`).
- **"Stay logged in"** simply chooses the long refresh TTL (`REFRESH_TOKEN_TTL_DAYS_REMEMBER`).
- **`app.authenticate`** (`plugins/authenticate.ts`) verifies the access JWT and checks the
  session isn't revoked/expired; if the JWT is expired it **transparently attempts a
  refresh** before failing. `app.optionalAuth` is the non-throwing variant.
- **Sessions & audit:** every login records device (ua-parser), IP, and geolocation on the
  `Session` row and appends a `LoginEvent`. Users can list/revoke sessions and view the
  formatted log (`routes/sessions.ts`). All dates are formatted server-side with date-fns
  in `lib/serialize.ts`.
- **Client mirror:** the web `api` client (`apps/web/src/lib/api.ts`) also retries once
  through `/auth/refresh` on a 401, so an expired access token is invisible to callers.

### 4.3 Data model highlights (`prisma/schema.prisma`)
- **SQLite-first, Postgres-compatible:** no native enums (role/kind are `String`, validated
  in app code against `@weft/shared`), `Json` columns for BlockNote content, no DB-specific
  types.
- **Pages** are self-referential (`parentId`) for infinite nesting, ordered by a **`position`
  Float** (fractional indexing — new siblings get `maxPosition + 1000`, inserts use the
  midpoint between neighbours). Soft-deleted via `deletedAt` (trash). Cover framing persists
  as `coverOffsetX`, `coverOffsetY` (0–100) and `coverScale` (1–4).
- **Favorites** are a per-user join table (`Favorite`), not a column — so "favorite" is
  per-viewer. The tree/detail endpoints compute `isFavorite` for the requesting user.
- **Backlinks** (`Backlink`) are derived: on every content save the server extracts `mention`
  inline nodes and rewrites the source page's backlink rows (`routes/pages.ts::syncBacklinks`).
- **Versions** store full content snapshots; auto snapshots are capped to the latest 100 per
  page (`routes/versions.ts`).

### 4.4 Collaboration (Hocuspocus / Yjs)
- `src/collab.ts` configures a Hocuspocus server; `index.ts` hands websocket upgrades to it.
- **Documents are keyed by pageId and held in memory** for the life of the process.
- **The canonical source of truth is the BlockNote JSON in Prisma**, written by the client's
  debounced autosave + version snapshots — *not* a persisted Yjs binary. On reconnect the
  Yjs doc rehydrates from that JSON (client-side seeding, see §5.5). This keeps setup
  zero-config and avoids binary blobs in SQLite.
- **The socket is intentionally unauthenticated on localhost.** Tighten `onAuthenticate`
  before exposing the server publicly.

### 4.5 Search (`routes/search.ts`)
- Flattens each page into `{ blockId, text }` entries (title is a pseudo-block with
  `blockId: null`), builds a regex from the query, and returns **per-occurrence** matches
  with `before`/`match`/`after` snippets plus the page's ancestor **path**.
- **Match modes:** `mode=whole` uses unicode lookaround `(?<![\p{L}\p{N}_])…(?![\p{L}\p{N}_])`;
  `caseSensitive` toggles the `i` flag. **Defaults are contains + case-insensitive.**
- Occurrences are capped at 25 per page; `count` is the true total (the UI shows "+N more").

### 4.6 Media, mail, external services
- **Uploads** stream to local disk under `UPLOAD_DIR`, bucketed by `YYYY-MM`, served
  statically at `/uploads` (`routes/uploads.ts`).
- **Image search** proxies Openverse (primary) → Wikimedia (fallback), keyless, with
  timeouts and graceful empty results (`routes/images.ts`).
- **Mail** (`lib/mail.ts`): with no `SMTP_HOST`, reset/invite links are printed to the
  console **and** appended to `apps/server/data/outbox/outbox.log`.

---

## 5. Frontend architecture (`apps/web`)

### 5.1 Foundations
- **Design tokens** are CSS custom properties in `src/index.css`; Tailwind
  (`tailwind.config.ts`) maps semantic names (`bg-surface`, `text-ink`, `text-thread`, …) to
  them. **Never hard-code hex** — add a token to the styleguide + `index.css` and reference
  it. Fonts are self-hosted via `@fontsource` (offline-capable).
- **Providers** (mounted in `main.tsx` / `App.tsx`): `QueryClientProvider` (React Query),
  `BrowserRouter`, `AuthProvider`, and `Toaster`. Theme is a zustand store
  (`hooks/useTheme.tsx`) with light/dark/system, applied via `data-theme` on `<html>`.
- **API client** (`lib/api.ts`): thin `fetch` wrapper, same-origin (Vite proxies to the
  server so httpOnly cookies just work), auto-refresh on 401, `api.upload` for multipart.
- **State:** server state via React Query (keys like `['tree', wsId]`, `['page', id]`,
  `['comments', id]`, …; see `lib/queries.ts` and `useInvalidate`). Local/UI state via
  component state or small zustand stores (theme, toasts). No Redux.

### 5.2 Routing / shell
- `App.tsx` splits public routes (`/share/:token`, auth screens) from the authenticated
  app (`AppShell`, lazy-loaded). `AppShell` (`features/app/AppShell.tsx`) owns the sidebar
  (collapse + mobile drawer state), the ⌘K palette, workspace-scoped global CSS injection,
  and the routed main area. Heavy views (settings, graph, trash, members) are `lazy()`.
- **Workspace context** (`features/app/workspace.tsx`) holds the active workspace id
  (persisted), defaulting to the first membership.

### 5.3 The editor (`features/editor/`)
This is the most intricate area.
- **`Editor.tsx`** creates a Yjs `Y.Doc` + `HocuspocusProvider` per mounted page (the
  component is keyed by `pageId` in `PageView`, so it fully remounts on navigation). It uses
  BlockNote's `useCreateBlockNote` with:
  - a **custom schema** (`weftSchema` from `mention.tsx`) = default blocks + the `mention`
    inline content;
  - **collaboration** config (provider + fragment + presence user);
  - an `uploadFile` handler that posts to `/uploads`.
- **Content seeding:** because collaboration holds content in Yjs, initial JSON is seeded
  into the shared doc **only when it's empty** (guarded by a `meta.seeded` flag), on Yjs
  `synced` **and** on a `1.5s fallback timer** so content always renders even if the socket
  is slow/unavailable. See the seed effect in `Editor.tsx`.
- **Autosave & history:** `onChange` debounces a `PATCH /pages/:id { content }` (800ms) and a
  version snapshot (`SNAPSHOT_DEBOUNCE_MS`); on unmount it flushes a save + a `blur` snapshot.
- **`PageView.tsx`** loads the page, owns the `update(partial)` helper (patch + invalidate),
  injects **page-scoped custom CSS** (`GlobalStyles` wraps it in `.weft-page-content { … }`
  via native CSS nesting), renders the header + editor + backlinks, and handles
  **jump-to-block** (reads `?b=<blockId>` and calls `flashBlock`).
- **`PageHeader.tsx`** is the dense one: the sticky bar (path bar + stats/favorite/comments/
  share/history/⋯ menu), the cover area, and the icon+title block. The ⋯ menu holds cover,
  width, lock, background, custom CSS, and the export submenu.

### 5.4 Covers (`cover.ts`, `CoverReposition.tsx`)
- `coverImageStyle(offsetX, offsetY, scale)` is the **single render function** used
  everywhere a cover appears (header + public view). It combines `object-position` (focal
  point) with `transform: scale` + matching `transform-origin`.
- `CoverReposition` is the drag-to-focus + zoom editor (slider + wheel, live preview,
  Save/Cancel/Reset). It persists `{ coverOffsetX, coverOffsetY, coverScale }`.

### 5.5 Mentions & backlinks (`mention.tsx`)
- `Mention` is a BlockNote **custom inline content spec** (`createReactInlineContentSpec`)
  with props `{ pageId, title, icon }`, serialising as `{ type: 'mention', … }` — exactly the
  shape the server's backlink extractor looks for.
- The `@` picker is a `SuggestionMenuController triggerCharacter="@"` child of
  `BlockNoteView` in `Editor.tsx`; it lists pages from the sidebar tree and inserts a
  mention. Backlinks appear in the **Linked references** section (`PageView.tsx`).

### 5.6 Sidebar (`features/app/`)
- **`PageTree.tsx`** builds a nested tree from the flat list, renders **woven indent guides**
  (that brighten to the thread colour on subtree hover), supports **collapse/expand**, and
  **HTML5 drag-and-drop** with before/after/inside drop zones → computes a new `position`
  (midpoint or ±500) and `POST /pages/:id/move`. Row icons are **clickable** (open the icon
  picker) — hence the popover inside a draggable row (clicks `stopPropagation`).
- **`Sidebar.tsx`** hosts the workspace switcher, search trigger, favorites, the tree,
  footer nav, and the collapse/close control. It's resizable on desktop.
- **Collapse + responsive:** `AppShell` persists collapsed state and, on mobile
  (`hooks/useMediaQuery.ts`), turns the sidebar into an overlay drawer with a backdrop and a
  floating reopen button.

### 5.7 Search UI (`features/search/`, `CommandPalette.tsx`)
- `highlight.tsx` wraps matches in `<mark class="weft-mark">` (mirrors the server's regex,
  so client highlighting matches server matching).
- `jump.ts` builds `?b=<blockId>&t=<ts>` URLs and `flashBlock()` finds the rendered block
  (`[data-id]`), scrolls to it, and applies the `weft-flash` animation. The timestamp makes
  repeat jumps re-trigger the effect.
- `CommandPalette.tsx` renders results with **path breadcrumb + copy-path**, highlighted
  snippets, an expandable **match count**, and persisted **whole-word / case** toggles.

### 5.8 Path bar (`PathBar.tsx`)
Explorer-style breadcrumb: click a segment to go up, copy the full path, or edit it as text
(`A / B / C`) and press Enter to navigate. Resolution walks the tree matching segment titles
(trimmed, case-insensitive); unresolved input shows an inline "Path not found" without
navigating.

### 5.9 Shared UI primitives
`components/ui/`: `Button`/`IconButton`, `Modal`, `Menu` (dropdown), `Popover` (anchored
floating panel — used by pickers/stats), `Avatar`, `Spinner`, `Toaster`. Reuse these; they
encode the styleguide's interactive states.

---

## 6. Key decisions & their rationale

| Decision | Why |
| --- | --- |
| BlockNote **JSON in Prisma is canonical**, Yjs is transient | Zero-config, no binary blobs in SQLite, survives restarts. |
| **Fractional `position` Float** for ordering | O(1) reorder/reparent without renumbering siblings. |
| **Favorites as a join table**, not a page column | Favorites are per-user in a multi-member workspace. |
| **Client seeds** the Yjs doc from JSON (with a fallback timer) | Content must render even if the collab socket is degraded. |
| **Cover framing via `object-position` + `scale`** in one helper | WYSIWYG between the reposition editor, header, and public view. |
| **Search returns per-block occurrences** | Enables jump-to-position + expandable match lists. |
| **Global focus ring scoped out of the editor** | The app-wide `:focus-visible` ring was boxing the ProseMirror editable. |
| **No native Prisma enums / Json-on-SQLite only** | Keeps the schema a Postgres drop-in. |
| **Vite proxies `/api` + `/collab`** | Same-origin in dev → httpOnly cookies + websockets "just work". |
| **Collab unauthenticated on localhost** | Simplicity for local-first; documented to tighten before public deploy. |

---

## 7. Gotchas & things to watch

- **Regenerating the Prisma client requires a server restart.** `tsx watch` watches `src/`,
  not `node_modules`. After a schema change + `prisma generate`, restart `pnpm dev` or the
  running server keeps the old client (new columns will be rejected).
- **pnpm 11 blocks native build scripts by default.** `argon2`, `sharp`, `esbuild`, `prisma`
  are allow-listed via `onlyBuiltDependencies` in `pnpm-workspace.yaml`. If you add another
  native dep, add it there.
- **TS7022 "referenced in its own initializer"** appears when a `const` is inferred from a
  Prisma call inside a loop/recursion. The fix used throughout: **annotate the variable's
  type explicitly** (see `routes/pages.ts` breadcrumbs, `PathBar.tsx` resolve loop).
- **Prisma `Json` + null:** assigning a possibly-null `Json` to a required column needs
  `(value ?? Prisma.JsonNull) as Prisma.InputJsonValue` (see `routes/versions.ts`).
- **BlockNote block set:** only the default blocks are registered (plus the `mention` inline).
  Seed/imported content must not reference unregistered block types (`callout`/`toggle` were
  removed from the welcome doc for this reason — see `lib/bootstrap.ts`).
- **Jump-to-block is block-granular:** `flashBlock` highlights the whole block, not the exact
  character range — deliberately, to avoid DOM surgery inside a contenteditable.
- **Bundle size:** the `editor` chunk is large mostly because BlockNote pulls Shiki grammars;
  they're lazy-loaded per language. Don't be alarmed by the build warning.
- **Custom-CSS scoping** relies on **native CSS nesting** (`.weft-page-content { <user css> }`).
  Global (workspace) CSS is injected raw and can theme the whole app by design.

---

## 8. Known gaps & suggested next steps

Worthwhile follow-ups:
- **Collab hardening:** authenticate the Hocuspocus socket (verify the access JWT in
  `onAuthenticate`) and optionally persist the Yjs state for offline-first before public
  deployment.
- **Search inside tables** and **exact character highlight** on jump.
- **Mention menu** currently lists all pages; consider ranking by recency/relevance.
- **Real email:** wire `SMTP_*` for production; the dev outbox is console/file only.
- **Comments are page-level**, not anchored to a block/selection (the `blockId` column exists
  but the UI doesn't set it yet).
- **Bundle splitting / accessibility audit / broader mobile polish.**

---

## 9. Conventions

- **Styleguide first.** `docs/STYLEGUIDE.md` is authoritative. If you need a new colour or
  pattern, add the token there (and to `index.css`) *before* using it. Don't restyle existing
  surfaces on the side.
- **Commits:** small, English, Conventional Commits, one logical change each. History is meant
  to be bisectable.
- **Types are shared:** request/response contracts live in `packages/shared/src/dto.ts`
  (zod). The server validates with them; the web imports the inferred types. Change both ends
  by changing the contract.
- **Errors:** throw typed `HttpError`/zod on the server; surface `ApiError.message` via
  toasts on the client.

---

## 10. Where to find things (quick map)

| I want to… | Look at |
| --- | --- |
| Change the visual system | `docs/STYLEGUIDE.md`, `apps/web/src/index.css`, `tailwind.config.ts` |
| Touch auth / sessions | `apps/server/src/lib/auth.ts`, `plugins/authenticate.ts`, `routes/auth.ts`, `routes/sessions.ts` |
| Add/adjust an API route | `apps/server/src/routes/*.ts` (+ contract in `packages/shared/src/dto.ts`) |
| Change the DB schema | `apps/server/prisma/schema.prisma` (then `prisma db push`/`migrate` + restart) |
| Work on the editor / collab | `apps/web/src/features/editor/Editor.tsx`, `PageView.tsx`, `mention.tsx` |
| Work on the page header / covers | `features/editor/PageHeader.tsx`, `cover.ts`, `CoverReposition.tsx`, `PathBar.tsx` |
| Work on the sidebar / tree / DnD | `features/app/Sidebar.tsx`, `PageTree.tsx`, `AppShell.tsx` |
| Work on search | `apps/server/src/routes/search.ts`, `features/app/CommandPalette.tsx`, `features/search/*` |
| Work on tags | `features/editor/TagEditor.tsx`, `apps/server/src/routes/tags.ts` |
| Work on templates / new-page | `features/app/TemplatePicker.tsx`, `useCreatePage.ts`; instantiation in `routes/pages.ts` |
| Work on export/import | `features/export/exporters.ts` |
| Work on sharing / public view | `routes/share.ts`, `routes/public.ts`, `features/share/*` |
| Change run/setup behaviour | `scripts/setup.mjs`, root `package.json`, `.env.example` |

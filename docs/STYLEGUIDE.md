# Weft — Style Guide

> The single source of truth for Weft's visual system. Every feature, extension, and
> change must look like it was always part of the product. Colours and type stay exactly
> as defined here unless this document is deliberately updated first.

Weft is a local-first, self-hostable knowledge workspace. Its identity is drawn from
weaving: the **weft** is the crosswise thread drawn through the warp to build cloth. Notes
are threads; a workspace is the woven fabric. The interface is a quiet, paper-like canvas
so that the writing is the hero; the craft shows in the details — the woven indent guides
of the page tree, the thread-coloured active states, and the interlaced brand mark.

---

## 1. Design principles

1. **Content is the hero.** Chrome recedes; the page canvas is calm and paper-like. Colour
   and motion are spent sparingly so long reading and writing sessions stay comfortable.
2. **The weave is the signature.** The one memorable element is the woven thread: the
   sidebar indent guides, the brand mark, subtle cover textures. Everything else is quiet.
3. **Warm neutrals, cool accent.** Backgrounds carry a faint warm (paper) tint; the
   interactive accent is a cool woad-indigo. A single warm madder accent is reserved for
   favourites/stars and "live" highlights — never used decoratively.
4. **Quality floor, unannounced.** Responsive to mobile, visible keyboard focus, reduced
   motion respected, AA contrast on text.

---

## 2. Colour

Colours are defined as CSS custom properties (design tokens). Tailwind is configured to
consume them, so components reference semantic tokens, never raw hex.

### 2.1 Brand & accent

| Token            | Light      | Role                                                        |
| ---------------- | ---------- | ---------------------------------------------------------- |
| `--thread`       | `#2E4374`  | Woad-indigo. Primary interactive/brand accent, links, focus |
| `--thread-hover` | `#37518F`  | Hover for indigo interactive elements                       |
| `--thread-soft`  | `#E7EAF3`  | Indigo tint fill (selected rows, subtle badges)             |
| `--madder`       | `#B4552D`  | Warm accent. Favourites/stars, presence, "live" markers only |
| `--madder-soft`  | `#F6E7DF`  | Madder tint fill                                            |

### 2.2 Neutrals (warm-tinted paper scale)

| Token          | Light      | Role                                              |
| -------------- | ---------- | ------------------------------------------------- |
| `--paper`      | `#FCFBF9`  | App canvas / editor background                    |
| `--surface`    | `#FFFFFF`  | Cards, menus, popovers, modals                    |
| `--sunk`       | `#F4F2EE`  | Sidebar, sunken panels, code block background      |
| `--line`       | `#E7E4DE`  | Hairline borders, dividers                        |
| `--line-strong`| `#D8D4CC`  | Stronger borders (inputs, table cells)            |
| `--ink`        | `#211F1C`  | Primary text (warm near-black)                    |
| `--ink-muted`  | `#6B6660`  | Secondary text, metadata                          |
| `--ink-faint`  | `#9A948C`  | Placeholders, disabled, timestamps                |

### 2.3 Status

| Token         | Light     | Role                    |
| ------------- | --------- | ----------------------- |
| `--ok`        | `#3C7A57` | Success                 |
| `--ok-soft`   | `#E4F0E9` | Success fill            |
| `--warn`      | `#9A6C15` | Warning                 |
| `--warn-soft` | `#F6EDD8` | Warning fill            |
| `--danger`    | `#B23A3A` | Destructive / error     |
| `--danger-soft`| `#F6E1E1`| Destructive fill        |

### 2.4 Diff (version history — Git-style)

| Token           | Light     | Role                         |
| --------------- | --------- | ---------------------------- |
| `--diff-add`    | `#3C7A57` | Added text                   |
| `--diff-add-bg` | `#E4F0E9` | Added line/inline background  |
| `--diff-del`    | `#B23A3A` | Removed text                 |
| `--diff-del-bg` | `#F6E1E1` | Removed line/inline background |

### 2.5a Interaction accents (search & on-image controls)

| Token          | Light      | Role                                                         |
| -------------- | ---------- | ------------------------------------------------------------ |
| `--mark-bg`    | `#FCE7A6`  | Highlighted matched substring inside a search snippet         |
| `--mark-ink`   | `#5A4410`  | Text colour on `--mark-bg`                                    |
| `--flash-bg`   | `#FDEBB0`  | Temporary "jumped-to" block flash (fades out over ~1.6s)      |
| `--scrim`      | `rgba(255,255,255,.9)` | Surface for buttons laid over cover images (backdrop-blurred) |
| `--scrim-ink`  | `#211F1C`  | Text/icon colour on `--scrim`                                |

Dark equivalents: `--mark-bg #4A3D18`, `--mark-ink #F0D896`, `--flash-bg #4A3D18`,
`--scrim rgba(24,23,22,.82)`, `--scrim-ink #ECE9E3`.

**On-image controls** — buttons placed over a cover use `--scrim` (with
`backdrop-blur`) as their surface and `--scrim-ink` for content, so they stay legible
against any image. Grouped in a single pill, top-right of the cover, radius `rounded`,
`shadow-sm`, gap `4px`.

### 2.5 Dark theme

Dark mode redefines the same tokens on `:root[data-theme="dark"]` and under
`@media (prefers-color-scheme: dark)` (guarded so an explicit light choice always wins).
Roles are preserved; the accent stays recognisably the same hue.

| Token           | Dark       |
| --------------- | ---------- |
| `--paper`       | `#1A1917`  |
| `--surface`     | `#232120`  |
| `--sunk`        | `#161514`  |
| `--line`        | `#343230`  |
| `--line-strong` | `#413E3B`  |
| `--ink`         | `#ECE9E3`  |
| `--ink-muted`   | `#A39D95`  |
| `--ink-faint`   | `#6E6862`  |
| `--thread`      | `#8CA2DB`  |
| `--thread-hover`| `#A6B8E6`  |
| `--thread-soft` | `#28304A`  |
| `--madder`      | `#D98A63`  |
| `--madder-soft` | `#3A2A21`  |

**Rule:** every colour has its base definition on bare `:root` (light). Dark blocks only
redefine. `body` always paints an explicit `--paper` background.

---

## 3. Typography

Fonts are self-hosted via `@fontsource` packages so the app works fully offline.

| Role            | Family            | Notes                                              |
| --------------- | ----------------- | -------------------------------------------------- |
| Display / brand | **Space Grotesk** | Headings, logo wordmark, section labels, data       |
| UI              | **Inter**         | Buttons, menus, sidebar, forms — the workhorse      |
| Editor body     | **Newsreader**    | Page content in the editor — a warm reading serif   |
| Mono / code     | **JetBrains Mono**| Code blocks, custom-CSS editor, keyboard hints      |

### 3.1 Type scale (UI)

| Token       | Size / line-height | Weight | Use                              |
| ----------- | ------------------ | ------ | -------------------------------- |
| `text-2xs`  | 11px / 16px        | 500    | Micro-labels, kbd hints          |
| `text-xs`   | 12px / 18px        | 500    | Metadata, captions, timestamps   |
| `text-sm`   | 13px / 20px        | 400/500| Sidebar, menus, dense UI          |
| `text-base` | 15px / 24px        | 400    | Default UI body                  |
| `text-lg`   | 17px / 26px        | 500    | Emphasised UI, card titles        |

### 3.2 Editor content scale (Newsreader)

There are **six heading levels (H1–H6)** plus body text, forming a visibly stepped ramp:
each level is unmistakably larger than the one below it (Word-style). The scale lives in
**one single source of truth**, `apps/web/src/features/editor/headingScale.ts`, so the
editor, the read-only/preview view and every export read the *same* numbers and can never
drift apart:

- The live editor **and** the read-only view are the same `.weft-page-content` DOM (the
  `<Editor>` component with `editable={false}`), styled from the `--hN-*` custom properties
  that `headingScale.ts` publishes onto `document.head` at load. `editor.css` sets an
  absolute `font-size`/`line-height`/`font-weight`/`margin-top` per level directly from
  those tokens (not via BlockNote's fragile `--level` indirection), so the ramp is stable
  across type changes.
- Exports (`exporters.ts`) import the same object — `headingScaleExportCss()` for HTML/PDF,
  and native stepped Word heading styles for DOCX.

BlockNote's built-in heading block caps `level` at **1–3**, which is why levels 4–6 never
rendered; `features/editor/heading.ts` replaces it with a six-level block (same `type` and
prop shape, so existing content/collab/undo are untouched), keeping the `#`…`######`
markdown shortcuts and `Mod-Alt-1..6`.

Sizes are rem against the 16px document root (so 2.25rem = 36px):

| Element | Size            | Weight | Line height | Space above |
| ------- | --------------- | ------ | ----------- | ----------- |
| Title   | 40px (`--title-size`) | 600 | 48px    | —           |
| H1      | 2.25rem (36px)  | 700    | 1.2         | 2rem        |
| H2      | 1.75rem (28px)  | 700    | 1.25        | 1.6rem      |
| H3      | 1.375rem (22px) | 600    | 1.3         | 1.3rem      |
| H4      | 1.125rem (18px) | 600    | 1.4         | 1.1rem      |
| H5      | 1rem (16px)     | 600    | 1.4         | 1rem        |
| H6      | 0.875rem (14px) | 600    | 1.4         | 1rem        |
| Body    | 1rem (16px)     | 400    | 1.6         | 0.5rem      |
| Code    | 14px (JetBrains)| 400    | —           | —           |

Headings render in Space Grotesk in the default/serif and sans page fonts; in the mono page
font they follow the body face. (Note: per this scale H6 at 14px sits just below the 16px
body — the two are told apart by weight, 600 vs 400.)

### 3.3 Page font family (per-page, Notion-style)

Font family is a **page-level** setting (`Page.fontFamily`), chosen from a curated set and
persisted per page. The default preserves Weft's existing look exactly. Switching the page
font re-faces the whole page voice — title, headings and body — while the tokenised heading
**sizes** (§3.2) stay fixed, so hierarchy never depends on the chosen family.

| Key      | Page face (title / headings / body) | Label   |
| -------- | ----------------------------------- | ------- |
| `serif`  | Newsreader (default)                | Serif   |
| `sans`   | Inter                               | Sans    |
| `mono`   | JetBrains Mono                      | Mono    |

The active face is driven by a `--wf-body-font` token, switched by a
`data-page-font="serif|sans|mono"` attribute on the page container; `serif` is the no-op
default and leaves the current design untouched. The picker lives in the page action bar
(a `Type` icon). Exports (HTML/PDF/DOCX) carry the same face.

Display type uses tight tracking (`-0.02em` on titles/H1). Body uses default tracking.

### 3.4 Inline font family (per selection)

Font family is **also** available as an inline mark on a text selection, overriding the
page default (§3.3) for the marked characters only — the page face stays the document
default. It is a BlockNote style (`font`, a string value) exposed in the selection
**formatting toolbar** as a `Type`-icon dropdown: **Default / Sans / Serif / Mono**.
`Default` clears the mark and the text falls back to the page face. The three faces reuse
the exact same stacks as §3.3, so an inline `Mono` run reads identically to a `mono` page:

| Value   | Face stack                              |
| ------- | --------------------------------------- |
| `sans`  | Inter, system-ui, sans-serif            |
| `serif` | Newsreader, Georgia, serif              |
| `mono`  | 'JetBrains Mono', ui-monospace, monospace |

The dropdown reflects the active run's face; the currently-applied value is checked.

---

## 4. Spacing, radius, shadow, borders

**Spacing** — 4px base scale: `2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
Editor content column max-width defaults to **720px** (user-draggable 640–1100px; full-width toggle removes the cap).

**Radius**

| Token         | Value | Use                                   |
| ------------- | ----- | ------------------------------------- |
| `rounded-sm`  | 4px   | Chips, kbd, inline tags               |
| `rounded`     | 6px   | Buttons, inputs, menu items           |
| `rounded-md`  | 8px   | Cards, popovers                       |
| `rounded-lg`  | 12px  | Modals, cover images                  |
| `rounded-xl`  | 16px  | Large media, empty-state panels       |
| `rounded-full`| pill  | Avatars, presence dots, toggles       |

**Shadow** (soft, warm-tinted, layered)

| Token       | Value                                                          |
| ----------- | ------------------------------------------------------------- |
| `shadow-sm` | `0 1px 2px rgba(33,31,28,.05)`                                 |
| `shadow`    | `0 2px 8px rgba(33,31,28,.08)`                                 |
| `shadow-md` | `0 6px 20px rgba(33,31,28,.10)`                                |
| `shadow-lg` | `0 16px 40px rgba(33,31,28,.16)` (modals, command palette)     |

**Borders** — default `1px solid var(--line)`. Inputs/tables use `--line-strong`.
Focus ring: `0 0 0 2px var(--paper), 0 0 0 4px var(--thread)` (2px offset halo).

---

## 5. The weave (signature)

- **Indent guides:** vertical guide lines in the page tree are drawn 1px in `--line`; the
  guide for the currently-hovered subtree brightens to `--thread` at 40% opacity, so you
  can see how deep a branch runs. A hovered subtree also gets a faint `--thread-soft` wash.
- **Brand mark:** three interlaced threads forming a "W"-adjacent weave (see `packages`/
  `apps/web/public`). Stroke uses `--thread`; one crossing thread uses `--madder`.
- **Block nesting guides:** inside the editor, nested blocks draw the same 1px `--line`
  vertical guide per indent level, brightening to `--thread` at 40% when the nested
  subtree is hovered. Every block indents with **Tab** / drag-right and outdents with
  **Shift+Tab** / drag-left, for normal blocks and list items alike.
- **Cover texture:** page covers without an image fall back to a faint diagonal weave
  pattern generated from `--sunk`/`--line`.
- **Loading/logo:** threads animate in and interlace (respects `prefers-reduced-motion`).

---

## 6. Components

**Buttons**

| Variant   | Fill / text                              | Border            |
| --------- | ---------------------------------------- | ----------------- |
| Primary   | `--thread` bg, white text                | none              |
| Secondary | `--surface` bg, `--ink` text             | `--line-strong`   |
| Ghost     | transparent, `--ink-muted` → `--ink` hover | none (hover `--sunk`) |
| Danger    | `--danger` bg, white text                | none              |

Height 32px (default) / 28px (compact) / 40px (large). Radius `rounded`. Icon+label gap 8px.

**Inputs** — 32px height, `--surface` bg, `1px --line-strong`, `rounded`. Focus → thread ring.
Placeholder `--ink-faint`. Labels `text-xs` `--ink-muted` uppercase tracking `0.04em`.

**Menus / popovers / command palette** — `--surface`, `1px --line`, `rounded-md`,
`shadow-md` (palette `shadow-lg`). Item height 32px, hover `--sunk`, active `--thread-soft`
with `--thread` text. Section headers `text-2xs` `--ink-faint` uppercase.

**Sidebar** — `--sunk` background, `280px` default (resizable). Row height 30px, `text-sm`.
Hover `--surface`; active page `--thread-soft` fill + `--thread` text + 2px `--thread` left bar.
Favourites use a `--madder` star. The sidebar fills the full viewport height as a flex
column: the page tree is the only scrolling region (`min-h-0` + `overflow-y-auto`), while
the workspace switcher, search and footer (Graph / Members / Trash / user) stay anchored.
Never let the tree clip against a hard edge — long trees scroll inside their region.

- **Row actions** — each page row exposes an action cluster (`⋯` menu + `＋` add-inside)
  that is hidden by default and revealed on `group-hover` **and** `group-focus-within` so
  it is keyboard reachable. The `＋` creates a child page under that row, auto-expands the
  parent, and opens the new page for editing. Icons `--ink-faint` → `--ink` on hover, hit
  target ≥ 20px. Every row action carries an `aria-label`/`title`.

**Outline / table of contents** — a right-side rail listing the current page's headings in
document order. Fixed to the right gutter, `hidden` below `xl`, width ~220px. Rows are
`text-sm`, indented by heading level (H1 flush, H2 +12px, H3 +24px). Idle rows are
`--ink-faint`; the heading currently in view is `--ink` with a 2px `--thread` left marker
(same active language as the sidebar). Clicking a row smooth-scrolls to the heading and
flashes it (`--flash-bg`). The list updates live as headings change and collapses to
nothing when the page has no headings. Its `top` is derived from the live position of the
first content block (`.weft-page-content`), clamped to a minimum (88px) — so it starts level
with the first body line, sits on the page background below the cover image, and pins while
scrolling **without ever riding up over the cover**. When the page is editable, each row is
draggable (a `GripVertical` handle appears on hover) with a `--thread` drop line; dropping
reorders the heading's whole **section** (the heading plus following blocks up to the next
heading of equal-or-higher level) in the document, which then re-renders the outline.

**Sub-page block** — an inline child-page reference placed in the editor via the `/page`
slash command (group _Basic blocks_). It creates a real child page (nested in the sidebar
tree) and renders in the parent as a single clickable row: page icon (or a `FileText`
glyph) + title, `text-[17px]` in the body face, `--ink` with a subtle underline that
strengthens on hover; the whole row tints `--sunk` on hover, radius `rounded`. The title
tracks the child page live (renaming the child updates the block). Clicking navigates to
the child. It is a void block (`contentEditable=false`) — same interaction language as the
inline `@`-mention chip, promoted to block level.

**Cards / callouts** — `--surface`, `1px --line`, `rounded-md`. Callouts tint their
background from the chosen colour at ~10% and border at ~24%.

**Toasts** — bottom-right, `--surface`, `shadow-md`, `rounded-md`, 3px left bar in the
status colour. Auto-dismiss 4s; errors persist until dismissed.

**Modals** — centred, `--surface`, `rounded-lg`, `shadow-lg`, max-width per use (420 / 560 /
720). Backdrop `rgba(33,31,28,.36)` with slight blur. Esc + backdrop-click to close.

**Path bar** — Explorer-style breadcrumb at the top of a page. Segments are `text-sm`
`--ink-muted` chips separated by a `/` in `--ink-faint`; the last (current) segment is
`--ink`. Hovering a segment tints it `--sunk`. A copy-path button and an inline edit mode
(the whole bar becomes a single `.input` prefilled with `A / B / C`) sit at the end. Typing
a path + Enter navigates; unresolved paths show an inline `--danger` "path not found" hint
without navigating.

**Search result** — row on `--surface`, hover `--sunk`, active `--thread-soft`. Line 1: page
icon + title with the matched substring wrapped in `--mark-bg`/`--mark-ink`. Line 2: the
containing path in `--ink-faint` `text-xs` + a copy-path action. A `--ink-faint` count badge
("5 matches") expands to a list of occurrences, each an indented, clickable snippet that
jumps to that block. Jumping flashes the target block with `--flash-bg`, fading over ~1.6s.

---

## 7. Interactive states

- **Hover:** background shifts to `--sunk` (on light surfaces) or `--surface` (in sidebar).
- **Active/selected:** `--thread-soft` fill, `--thread` text/icon.
- **Focus-visible:** thread ring (§4). Never remove outlines without a replacement.
- **Disabled:** `--ink-faint` text, 60% opacity, `not-allowed` cursor.
- **Drag:** dragged row at 80% opacity with `shadow-md`; drop target shows a 2px `--thread`
  insertion line (reorder) or a `--thread-soft` wash (re-parent).
- **Locked page:** a lock chip in the header; editor becomes read-only with a faint `--sunk`
  overlay tint on the toolbar.

---

## 8. Motion

Durations: 120ms (micro / hover), 180ms (menus, toasts), 240ms (modals, drawers).
Easing: `cubic-bezier(.2,.6,.2,1)` (standard), `cubic-bezier(.4,0,.2,1)` (enter).
Reduced motion: all non-essential transitions collapse to opacity-only or none.

---

## 9. Iconography

Line icons, 1.5px stroke, from **lucide-react**, sized 16 (dense) / 18 (default) / 20 (headers).
Icons inherit `currentColor` and default to `--ink-muted`, brightening to `--ink`/`--thread`
on hover/active. Emoji (page icons) render at native colour.

---

## 10. Accessibility

- Text contrast ≥ AA (`--ink` on `--paper` ≈ 13:1; `--ink-muted` on `--paper` ≈ 4.9:1).
- All interactive elements are keyboard reachable with a visible focus ring.
- Motion respects `prefers-reduced-motion`.
- Colour is never the only signal (icons/labels accompany status colour).
- Hit targets ≥ 28px; touch targets ≥ 40px on mobile.

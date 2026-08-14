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

**The font library is a single source of truth: `features/editor/pageFonts.ts`.** Every
consumer — the picker, the page container, the HTML/PDF/DOCX exporters, the side peek —
reads it; nothing hard-codes a face. Each entry declares a `key` (persisted), a `label`,
a `group`, a CSS `stack` and a `docx` fallback name.

**Only self-hosted faces are offered.** Every family in the list ships as an
`@fontsource` package imported in `src/fonts.css` (latin subset, weights 400 + 700), so
the list can never advertise a face that silently falls back to something else — a
promise the old "Georgia" style stack could not keep on Linux. The `@font-face` rules are
declaration-only: a woff2 is fetched by the browser **only** when a page actually uses
that family, so 21 faces cost one small CSS block, not 21 downloads.

| Group     | Keys                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------- |
| **Serif** | `serif` (Newsreader — default), `lora`, `merriweather`, `source-serif`, `playfair`, `baskerville`, `garamond` |
| **Sans**  | `sans` (Inter), `roboto`, `open-sans`, `lato`, `montserrat`, `poppins`, `nunito`, `source-sans`, `work-sans`, `grotesk` |
| **Mono**  | `mono` (JetBrains Mono), `fira-code`, `source-code`, `plex-mono`                                          |

`serif` / `sans` / `mono` are the original three keys, kept verbatim so existing pages keep
their face; `serif` is still the no-op default and leaves the current design untouched.

The active face is driven by two tokens set **inline on the page container** —
`--wf-body-font` (title, headings, body) and `--wf-title-font` (the page title, which keeps
its Space Grotesk display look on the default face only). The container also keeps its
`data-page-font="<key>"` attribute as a styling hook for custom CSS. The picker lives in
the page **options panel** (§6.7) and in the action bar (`Type` icon); both list the faces
rendered in themselves, grouped, with the active one checked. Exports (HTML/PDF/DOCX)
carry the same face.

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
- **Column containers (edit-mode only):** a multi-column layout (`columnList`) draws each
  column as a distinct drop zone *while editing*, so the user can see where each column is
  and what can be dropped where. These affordances are pure editor UI — they are scoped to
  `.bn-editor[contenteditable='true']` and therefore never appear in read-only preview,
  presentation, or export (PDF/HTML), and are never stored as document content.
  - **Resting:** a 1px `--line` inset border, `rounded-sm`, with a hairline column-gap so the
    boundaries read even when columns are filled. Filled columns keep the border; empty ones
    add a faint `--sunk` wash.
  - **Empty column:** shows a centred, non-selectable hint — a small `--ink-faint` "Column N"
    label (auto-numbered via CSS counter) over a `--ink-faint` "Drop content here" line. The
    hint is a CSS pseudo-element on the empty column, so it disappears the moment any block is
    typed or dropped in and is never part of the saved document.
  - **Dragging:** while a block is being dragged, all columns brighten to signal they are drop
    zones (border → `--thread` at 40%, faint `--thread-soft` wash). The column under the
    pointer becomes the active target (solid `--thread` border + `--thread-soft` fill, hint
    reads "Drop here"). A column that cannot accept the dragged block (e.g. a `columnList`,
    which can't nest) shows the invalid state instead (`--danger` dashed border, "Can't drop
    here"), so the user knows before releasing.
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
with `--thread` text. Section headers `text-2xs` `--ink-faint` uppercase. The **search
palette's focus state** is on the whole surface, not the raw input: on `:focus-within` the
card lifts (a softer, deeper shadow) and gains a subtle `--thread/25` ring, the search icon
shifts to `--thread`, and the field divider tints `--thread/30` — a premium focus that reads
as part of the design system, never a browser input outline. The trigger button (sidebar
Search) uses a `--thread-soft` focus halo, matching the app focus language.

### 6.1 Overlay & stacking architecture

Every floating surface — menus, popovers, dropdowns, context menus, tooltips, toasts,
modals, full-screen panels and the side peek — is rendered through a **portal to
`document.body`** (`components/ui/Portal.tsx`). This is not decoration: a floating panel
rendered inline inherits the stacking context of its ancestors, and any `position: sticky`,
`backdrop-filter`/`filter`, `transform`, `opacity < 1` or `z-index` on the way up traps it
below sibling chrome (this was the real cause of the sidebar `＋`/`⋯` bleeding over the tag
popover and the History panel). Portalling lifts each overlay to the root stacking context
where a single, documented z-scale decides order:

| Token (Tailwind `z-*`) | Value       | Layer                                                   |
| ---------------------- | ----------- | ------------------------------------------------------- |
| `z-header`             | 20          | in-flow sticky page/section headers                     |
| `z-scrim-low`          | 30          | mobile sidebar backdrop, floating reopen button         |
| `z-sidebar`            | 40          | mobile sidebar drawer                                    |
| `z-peek`               | 60          | docked side-peek panel + its scrim                      |
| _(reserved)_           | 2000–4000   | **BlockNote in-editor floating UI** — see note below    |
| `z-scrim`              | 5000        | modals, dialogs, full-screen panels (portalled)         |
| `z-overlay`            | 6000        | menus, popovers, dropdowns, context menus (portalled)   |
| `z-tooltip`            | 6100        | tooltips (portalled)                                     |
| `z-toast`              | 6200        | toasts (portalled) — always on top                      |

**Reserved band 2000–4000 (BlockNote).** The editor library portals its *own* affordances
to `<body>` at hard-coded z-index — the `＋`/⠿ side menu and slash suggestion menu at 2000,
the formatting toolbar at 3000, one element at 4000. Those are **content-level** affordances,
so every app overlay must sit *above* the whole band; otherwise the editor's hover handles
bleed over an app popover (this was the real cause of the page **emoji picker** appearing
under the block `＋`/⠿ controls — not a missing z-index on the picker, but the app-overlay
band starting at 1000, *below* BlockNote's 2000). The app band therefore starts at `z-scrim`
5000. Do not place any app overlay inside 2000–4000.

**Global "an overlay is open" signal.** Z-order alone cannot hide the editor's block
handles: the BlockNote side menu (`＋` / `⠿`) lives in the **left margin gutter**, which is
horizontally *outside* every popup's rectangle, so a higher-z popover never covers it — it
just sits beside it. The fix is a suppression signal, not more z-index. Every shared overlay
primitive (`Popover`, `Menu`, `Modal`, and the command palette / search) registers itself
via `useOverlayOpen(open)` (`lib/overlaySignal.ts`), which reference-counts open overlays and
toggles `body.wf-overlay-open`. While that class is present, `editor.css` hides the block
side menu (`opacity:0; pointer-events:none`), so **no `＋`/`⠿` handle ever shows beside or
through an open popup** — Tag, page-icon Emoji, Search, and every menu/modal alike. The one
exception is the side menu's *own* `＋` convert popover, which opts out
(`registerOverlay={false}`) because it is anchored to the handle and uses BlockNote's
`freezeMenu` to stay pinned while open. This is the single, systematic rule for the whole app.

Floating overlays sit **above** scrims so a menu opened from inside a modal still lands on
top. Never introduce a raw `z-[n]`; pick a layer. **Positioning** is shared: anchored
overlays use `useAnchoredPosition` (`components/ui/floating.ts`) — `position: fixed`,
open below the trigger, flip above when there isn't room, shift horizontally to stay in
the viewport with an 8px margin, and re-measure on scroll/resize. **Dismissal** is shared
via `useDismiss`: Escape and outside-click (pointer outside both trigger and panel) close
every overlay, with the same `fade .12s` entrance. Same shadow (`shadow-md`), same radius
(`rounded-md`), same motion everywhere. Two robustness invariants keep this reliable when a
panel re-renders under its own click: (1) outside-click is judged from the mousedown's
**composed path**, not `contains(e.target)` — a menu item that swaps the panel to a sub-view
synchronously unmounts the clicked row, so by the time the document listener runs the target
is detached and `contains` would wrongly read "outside"; the path still holds the panel, so
the menu stays open. (2) `Popover` **moves focus into the panel** once it's measured (the
first frame is `visibility:hidden`, where a child's `autoFocus` no-ops) — type-ahead search
and arrow keys work, and focus stays inside the portal so Escape reaches the shared handler
instead of being swallowed by the editor the trigger lives in.

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

**Empty-page quick actions** — a getting-started affordance on a blank, editable page.
It is **editor UI, never a document block**: rendered as a `contentEditable=false` sibling
*after* the ProseMirror root, so it can't be typed into, saved, exported, or copied, and it
disappears the instant the page gains real content (or the user picks "Text" / starts
typing). It sits at the **bottom** of the editor area as a quiet quick-start band — a
hairline `--line` divider, a small "Start building" label + hint ("pick a block, press `/`
for all, or just type."), then a compact 2/4-column grid of ~8 curated cards (`--surface`,
`1px --line`, `rounded-md`, icon → `--thread` on hover) ordered write → structure → data —
so a calm editing area sits above and a fast on-ramp below, rather than a card crowding the
first line. It aligns to the body text column (`px-[54px]`, matching `.bn-editor`'s
`padding-inline`). Each card runs the **real** insert verb from the shared block registry —
the same one "/" uses — so it genuinely inserts the block.

**Content placeholder (calm canvas)** — the inline block placeholders are **focus-gated**.
BlockNote injects a placeholder on any empty block (the paragraph "Enter text or type `/`…"
only on the *focused* empty block, but heading/list types on any empty block regardless of
focus). `editor.css` suppresses every block placeholder while the editor is not focused
(`.bn-editor:not(:focus-within)`), so an unfocused page shows a clean, empty content area;
the hint reappears the moment the caret enters the editor. This keeps a new page quiet until
the writer engages with the body.

**Page header meta row** — a page's cover, icon and tags share **one horizontal row of
equal-weight ghost pills** above the title (`Add cover · Add icon · Add tag`, `text-xs`
`--ink-faint`, hover `--sunk`/`--ink`, `gap`), never stacked or overlapping. Each pill
drops out the instant its item is set — a chosen cover paints the cover slot, an icon
renders at 64px above the title, tags become chips below it — so the row only ever offers
what's still missing (and collapses to nothing when all three exist). The row is revealed on
hover/focus of the header (calm by default), but stays visible on a brand-new untitled page
so first-run users can find it. This cleanly separates page **metadata** (the row) from page
**content** (below the title).

**Cards / callouts** — `--surface`, `1px --line`, `rounded-md`. Callouts tint their
background from the chosen colour at ~10% and border at ~24%.

**Toasts** — bottom-right, `--surface`, `shadow-md`, `rounded-md`, 3px left bar in the
status colour. Auto-dismiss 4s; errors persist until dismissed.

**Modals** — centred, `--surface`, `rounded-lg`, `shadow-lg`, max-width per use (420 / 560 /
720). Backdrop `rgba(33,31,28,.36)` with slight blur. Esc + backdrop-click to close.

**Side peek** — a right-docked panel (`z-peek`) that previews another page without leaving
the current one. `--paper` background, `1px --line` left border, `shadow-lg`, slides in
(`slidein .2s`). ~46vw on desktop (clamped 440–760px), full-width on mobile with a tap-scrim.
**Non-modal on desktop** — the main view stays visible and scrollable; it closes on Esc, the
✕, or (mobile) the scrim. Content is rendered **read-only** via the same static `toHtml`
renderer the public share view uses, so a peek never opens a second collaborative editor
session. Header offers "Open as full page" and "Open in new tab".

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

### 6.2 Activity navigator & density chart

The Activity Log (`features/history/ActivityView.tsx`) is a **two-pane time
navigator**, not a flat list. Desktop = a `w-72` left rail (`--surface/40`,
`border-r --line`, own scroll) + a scrolling feed; the rail collapses on mobile
where the feed's sticky bar carries a compact quick-range menu.

- **Navigator (rail):** year tabs (active = `--thread` solid), a month grid with
  a ‹ › period stepper (active month = `--thread-soft`), and quick date presets
  (Today … This year, incl. month-straddling ranges) via a menu.
- **Density chart** = horizontal bars, one cell per day (month view) or per month
  (year view). Bar length ∝ the count of **real** change events in the cell —
  never synthetic UI events (§19 of the brief). Filled bar `--thread/55`
  (`--thread` when it's the current-context cell), empty track `--line/50`. Bars
  double as the day/month scrubber: click a day → smooth-scroll to its section,
  click a month → drill in. Granularity adapts to the window span.
- **Sticky context bar** (feed top, `--paper/90` + `backdrop-blur`) shows
  `Year / Month / Day`, updated from the top-most visible day group on scroll.
- **Filters** stay in sync with the chart: type chips (Created/Edited/Restored —
  only classes backed by durable data) + a searchable per-page popover.
- **Entry actions** (hover): Open page, Open in new tab (`/p/:id`), Copy path
  (workspace-rooted, built from the page tree) with a "Path copied" toast.

The Workspace Overview (`HomeView`) mirrors the fast-answer intent with one-click
quick-filter chips (Edited today/this week, Created this month/this year) — it
does **not** duplicate the navigator.

### 6.4 Version history panel

The Version history dialog (`features/history/HistoryPanel.tsx`) is a left **timeline
rail** + a right **word-diff pane**. The rail makes time orientation immediate:

- **Strong day sections.** Each day is a section headed by a prominent primary label
  (`Today` / `Yesterday` / weekday, `font-display text-base font-semibold --ink`) over a
  secondary full date (`text-2xs --ink-faint`) and an edit count, with a hairline rule.
  The header is sticky, so the current day stays named while scrolling. This replaces the
  old tiny grey uppercase label — Today/Yesterday now read at a glance.
- **Per-day activity ribbon.** Under each header, the day's snapshots collapse into an
  hour-by-hour bar ribbon spanning the day's active hours. Bar height ∝ the count of
  **real** snapshots in that hour (never synthetic); the busiest/selected hour is `--thread`,
  others `--thread/45`, quiet hours a faint `--line/40` track. Bars are the scrubber:
  clicking one selects that hour's latest snapshot, so an activity peak leads straight to
  *what changed* in the diff pane. End labels mark the first/last active hour.
- **Time → activity → change rows.** Each row leads with the time (`font-display`,
  tabular), then the kind (Edited / Autosave / …) and word count, and a **word-delta chip**
  (`+N` on `--diff-add-bg`, `−N` on `--diff-del-bg`, `±0` faint) derived from the real
  stored word counts — no invented change descriptions. The diff pane and Restore are
  unchanged.

### 6.3 Marquee multi-select

Rubber-band block selection (`features/editor/MarqueeSelect.tsx`) anchors in
**document coordinates** (`client + scroll`), so scrolling mid-drag never strands
the anchor or makes the selection jump. Edge auto-scroll: a rAF loop scrolls the
page container when the pointer sits within 72px of the top/bottom, at a speed
proportional to how deep it is in the hot-zone; newly revealed blocks fold into
the selection each tick. Highlights are portalled `fixed` overlays (`--thread`
16% wash + 60% ring — visible over charts/tables/images) — never classes on
BlockNote's own DOM. On release, a floating bar (Duplicate / Delete / clear)
anchors under the selection.

**Generic, type-agnostic coverage.** Selection hit-tests every *leaf* content
block — any `.bn-block[data-id]` that contains no nested block — at any depth.
This catches all registered block types (paragraph, table, chart, image,
database, …) without an enumerated per-type list, and reaches blocks **inside
columns**, not just top-level ones. Bulk delete runs the selected leaves through
`planDeletion`: a container (column layout) whose every leaf is covered collapses
to the container id (the whole layout goes), while a partial selection removes
just the covered leaves and leaves the layout intact. All deletes go through
`editor.removeBlocks`, so they're captured by the Yjs undo history like any edit.

---

### 6.5 Block side controls — Add block vs. block actions

The two editor side-menu controls (`features/editor/WeftSideMenu.tsx`) have two
clearly-separated jobs, and their tooltips say so:

- **＋ Add block** inserts a *new* block below the current one (never "turn into").
  It opens the shared **`BlockPicker`** — a fuzzy-searchable, keyboard-navigable
  (↑/↓/Enter/Home/End) list driven by `BLOCK_TYPE_DEFS`, with a **Recommended** row
  at the top. Recommendations come from real usage: `lib/blockUsage.ts` counts a
  block only when it's actually *created* (slash menu, ＋, empty-state — never on
  hover/open or "turn into"), stores counts in `localStorage`, and surfaces at most
  four, hidden until there's data so the row never dominates.
- **⠿ Handle** drags to move (native BlockNote drag, wired exactly as BlockNote's
  own `DragHandleButton`: `draggable` + `blockDragStart`) and on click opens the
  **`BlockActionMenu`** — a real action panel, not just Delete + Colour: a
  fuzzy-searchable list of Turn into / Colour / Copy link to block / Duplicate /
  Move to / Delete, with a page last-edited footer. Turn into reuses `BlockPicker`;
  Colour only appears for blocks whose schema carries colour props; Duplicate
  deep-clones children + props (tables, charts, toggles copy their data); Copy link
  reuses the existing `?b=` jump param; Move to relocates the block to another page
  via stored content. Escape steps out of a sub-view before closing the menu.

**One search engine.** `lib/fuzzy.ts` (ordered-subsequence scoring with
word-boundary / contiguity bonuses, plus a bounded-Levenshtein typo fallback so
"delte" still finds Delete) powers both menus and the action search, so search
behaves identically everywhere. Both menus open through the shared `Popover`
(portalled, viewport-flipping, Escape / outside-click) with `registerOverlay=false`
so the handle they anchor to stays put.

**Editor preferences.** App-level editor toggles live in `hooks/useEditorPrefs.ts`
— the same lightweight `zustand` + `localStorage` shape as `useTheme`, so there's one
preference pattern, not two. **Spellcheck** is surfaced in the page **options panel**
(§6.7) as a real checkbox row, toggleable repeatedly without the panel closing. The editor
applies it by setting the `spellcheck` attribute on the ProseMirror root **and** the
content wrapper: every note text field inherits it (paragraphs, headings, lists,
quotes, table cells, code, columns), plus the empty-page band beside the editor — one
switch, every editable, persisted across page switches. Page titles stay
`spellCheck={false}` regardless.

### 6.6 Dialog system

Every dialog is built on `components/ui/Modal`, so they share one look and one set
of behaviours (§6.1 portalling, plus focus management): opening moves focus into
the dialog (a `data-autofocus` element, else the panel), **Tab is trapped** inside,
and closing **returns focus** to the trigger. `ConfirmDialog` is the one styled
confirm/cancel decision — destructive variants read as destructive (warning glyph +
danger-filled button), and Escape / backdrop / Cancel always resolve to cancel,
never a silent confirm. `UnsavedChangesDialog` is the three-way close decision for a
dialog holding unsaved edits (Keep editing / Discard / Save). The **Import** dialog
(`features/editor/ImportDialog.tsx`) is a single drop-or-choose target with honest
progress/error states and only the formats Weft can actually parse (Markdown/text,
HTML, Weft JSON, CSV — the reciprocal of the exporters).

### 6.7 Page options — a persistent control panel, not a dropdown

The page **"…"** surface (`features/editor/PageOptionsPanel.tsx`) is a **control panel**,
not a menu. The distinction is behavioural and it is the rule everything else follows:

> **If a control changes something visible on the page you are looking at, using it must
> not close the panel.** You open it once, try settings, judge the result, adjust again.

Two kinds of row, and only two:

| Kind                | Examples                                             | On activate                          |
| ------------------- | ---------------------------------------------------- | ------------------------------------- |
| **Setting** (live)  | Spellcheck, Width, Font family, Lock, Full width      | applies instantly, **panel stays open** |
| **Action** (leaves) | Change cover, Custom CSS, Move to, Import, Export, Duplicate, Trash | runs, **panel closes** — it hands off to another surface |

A generic `Menu` cannot express this: `components/ui/Menu.tsx` closes on *every* item
click, which is correct for a list of commands and wrong for a list of settings. The panel
is therefore built on `Popover` (portalled, `useAnchoredPosition` + `useDismiss` per §6.1),
whose only dismissals are a genuine outside pointer-down, Escape, or an explicit close.
Clicking a checkbox, a width segment or a font row is *inside* the panel and is not a
dismissal — never re-introduce a click handler that closes the panel "just in case".

Composition, top to bottom:

- **Header** — title + a fuzzy **search field** (`lib/fuzzy.ts`, the same engine as the
  block menus) that filters every row by label, group name and hand-written keywords, and
  ranks by relevance. Search is navigation only: it never changes what a control does.
- **Grouped sections** with small uppercase labels (`Page`, `Appearance`, `Actions`,
  `Import & export`) and generous whitespace — hierarchy from type and space, not rules.
- **Controls that fit the setting.** Boolean → a real checkbox (`Checkbox` in
  `components/ui/Checkbox.tsx`, a box the user can hit, not an On/Off word). Mutually
  exclusive → a **segmented radio group** (`components/ui/SegmentedControl.tsx`,
  `role="radiogroup"`, arrow-key navigable) so the current value is visible without
  opening anything. Many exclusive options (font) → an in-place **sub-view** with a back
  affordance, the same pattern as the block-action menu.
- **Active state is unambiguous**: `--thread-soft` fill + `--thread` text, plus a check or
  a filled control — colour is never the only signal (§10).

Keyboard: `/` or typing focuses search, `↑`/`↓` move through visible rows, `Enter`
activates, `←`/`Escape` steps out of a sub-view before Escape closes the panel.

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

**File-format icons** (`components/ui/FileFormatIcon.tsx`) are the one deliberate exception
and they are a *set*, not six borrowed glyphs. lucide has no Markdown/PDF/Word marks, and
mixing a real PDF logo with a generic `FileText` would read as six different icon
languages. Instead one drawn primitive — a document sheet with a folded corner, same
1.5px stroke, same 16/18/20 sizes — carries a short format wordmark (`MD`, `TXT`, `JSON`,
`DOC`, `PDF`, `HTML`) and a per-format accent tint, so `PDF` is identifiable at a glance
while the six stay obviously one family. Accents: MD `#8a5cc4`, TXT `--ink-muted`,
JSON `#c9a227`, DOC `#3f76c4`, PDF `#c4554d`, HTML `#cc772f` — the same swatch vocabulary
as the block colour palette, with plain text left deliberately neutral.

---

## 10. Accessibility

- Text contrast ≥ AA (`--ink` on `--paper` ≈ 13:1; `--ink-muted` on `--paper` ≈ 4.9:1).
- All interactive elements are keyboard reachable with a visible focus ring.
- Motion respects `prefers-reduced-motion`.
- Colour is never the only signal (icons/labels accompany status colour).
- Hit targets ≥ 28px; touch targets ≥ 40px on mobile.

# Block menu — feature status

Every item below appears **identically in both the "/" slash menu and the "+" /
TURN INTO menu** (both are driven by the single `BLOCK_TYPE_DEFS` registry in
`apps/web/src/features/editor/blockTypes.tsx`). Verified in the running app via
browser automation: the two menus list an identical 65-item set (all 53 requested
names present), grouped Headings / Basic blocks / Media / Database / Charts /
Advanced / Inline / Import.

Legend: **Full** = complete for its scope · **Baseline** = real, working, but a
documented simplification of the full Notion feature.

## Part 1 — blocks

| Item | Status | Notes / what's missing |
|---|---|---|
| Toggle list | Full | Collapsible; nested blocks via tree children, hidden by CSS when closed |
| Highlight (callout) | Full | Tinted box + emoji marker, editable body |
| Quote | Full | |
| Divider | Full | |
| Link to page | Full | Opens the `@` page picker → inserts a page reference |
| Image / Video / Audio / Code / File | Full | Native BlockNote blocks (pre-existing) |
| Web bookmark | Baseline | Renders a link card (host + favicon); no server-side title/preview unfurl |
| Table view | Baseline | Real sample table UI; not backed by a live datastore |
| Board view | Baseline | Real kanban columns; sample data |
| Gallery view | Baseline | Real card grid; sample data |
| List view | Baseline | Real list; sample data |
| Feed view | Baseline | Real feed cards; sample data |
| Dashboard view | Baseline | Real stat tiles; sample data |
| Calendar view | Baseline | Real month grid; sample data |
| Timeline view | Baseline | Real timeline bars; sample data |
| Map view | Baseline | Map placeholder with pins; no real geodata |
| Vertical bar / Horizontal bar / Line / Donut / Number chart | Baseline | Real SVG charts; editable JSON data, not bound to a data source |
| Form | Baseline | Real interactive inputs + local submit; no backend persistence |
| Database - Inline | Baseline | Titled sample table view; no live datastore |
| Database - Full page | Baseline | Inline block labelled "full page"; does not spawn a separate DB page |
| Linked view of data source | Baseline | Sample linked view; no real source binding |
| Table of contents | Full | Live list of the document's headings; click-to-scroll |
| Block equation | Full | Real KaTeX render; click to edit LaTeX |
| Button | Baseline | Editable label + optional link target; no scripted actions |
| Breadcrumb | Baseline | Shows current page title from the tab; not the full ancestor chain |
| Tabs | Baseline | Tab bar switches; per-tab body is placeholder (custom-spec can't hold nested blocks) |
| Synced block | Baseline | Renders + editable; no cross-instance sync |
| Toggle heading 1 / 2 / 3 | Full | Collapsible headings |
| 2 / 3 / 4 / 5 columns | Baseline | Visual N-column scaffold; can't yet drop blocks into columns (BlockNote content-model limit) |
| Smart Notes | Baseline | Styled editable container; no AI |
| Code - Mermaid | Baseline | Stores + shows Mermaid source; no graph rendering (no mermaid runtime) |
| Mention a person | Baseline | Inserts a person chip (current user); no full member picker |
| Mention a page or data source | Full | Opens the `@` picker |
| Date or reminder | Full | Inserts today's date; no reminder scheduling |
| Emoji | Full | Opens the native `:` emoji picker |
| Inline equation | Full | Real KaTeX inline render |
| Import CSV | Full | Client-side parse → real table block |
| Import text & Markdown | Full | `tryParseMarkdownToBlocks` → real blocks |
| Import Zip | Baseline | Attaches the file as an embedded file block; no archive extraction |
| Import PDF | Baseline | Attaches the file as an embedded file block; no text extraction |

## Part 2 — page "…" menu (all Full)

Copy link · Copy page contents (Markdown) · Duplicate · Move to (destination
picker) · Move to trash · Lock page (pre-existing).

## Part 3 — marquee selection (Full)

Drag on empty canvas → rubber-band rectangle → intersecting blocks highlight →
Delete/Backspace removes them (`editor.removeBlocks`). Ignores drags on inline
text / the drag handle / the "+" button / controls, and only arms past a 4px
threshold, so caret placement, in-block text selection and handle-dragging are
unaffected.

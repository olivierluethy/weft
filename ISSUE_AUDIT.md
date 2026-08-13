# Issue Audit & Fixes — `olivierluethy/weft`

**Date:** 2026-08-13
**Scope:** all 6 open issues audited, then fixed in the working tree.
**Verification:** `tsc --noEmit` clean, `eslint` clean, `vite build` succeeds, **and every fix was driven through the live UI in a real browser** (headless Chrome via the DevTools Protocol, logged into the demo account) with zero runtime exceptions.

---

## 1. Summary

| # | Title | Status | Browser check |
|---|---|---|---|
| 4 | Edit notes title on header via mouseclick | **CLOSED — verified** | crumb click → focused editable input (ring) |
| 5 | Make header sticky even on scroll | **CLOSED — verified** | scrolled 384px to bottom → bar pinned at top (deltaTop 0) |
| 6 | Version control → content feels empty | **CLOSED — verified** | snapshot → metadata + compare toggle + real diff |
| 7 | Font-Family dropdown style lacking | **CLOSED — verified** | dropdown shows per-face specimens + descriptors |
| 8 | Tooltip on hover over right header elements | **CLOSED — verified** | hover Share → `[role=tooltip]` "Share" |
| 9 | Remove the remove option when Icon is not set | **CLOSED — verified** | Remove hidden when no icon, shown when set |

All six issues are **CLOSED** on GitHub, each with an evidence-bearing comment. (Two earlier premature closures of #4/#5 were reverted mid-audit and only re-closed after the browser verification below; lesson recorded in §4.)

---

## 2. Fixes applied

### #9 — Hide "Remove" when nothing is set
`onRemove` is now optional on both `IconPicker` and `CoverPicker`; the "Remove" button only renders when the callback is supplied. `PageHeader` no longer passes `onRemove` on the "Add icon" / "Add cover" paths, so a page with no icon/cover shows no Remove control.
- `apps/web/src/features/editor/pickers/IconPicker.tsx:31-38, 59-66`
- `apps/web/src/features/editor/pickers/CoverPicker.tsx:15-18, 38-46`
- `apps/web/src/features/editor/PageHeader.tsx` (both "Add" pickers)

### #4 — Rename the page by clicking the title in the top bar
The current-page (last) breadcrumb in the top action bar is now click-to-edit while at the top of the page. Clicking it turns it into an inline input (ring-highlighted); Enter/blur commits via `onUpdate({ title })`, Escape cancels. Non-editable/viewer pages keep the old disabled crumb.
- `apps/web/src/features/editor/PathBar.tsx` (new `editable` + `onRenameCurrent` props, inline title-edit state)
- `apps/web/src/features/editor/PageHeader.tsx` (passes `editable` + `onRenameCurrent` to `PathBar`)

### #5 — Sticky header stays visible on full scroll
Root cause was a CSS containing-block trap: `PageHeader` wrapped its output in a `<div>` that only spanned the header, so the `sticky` bar unpinned once you scrolled into the body. The wrapper is now a React Fragment, making the bar a direct child of the full-height `[data-page-scroll]` container.
- `apps/web/src/features/editor/PageHeader.tsx:150-153` (wrapper `<div>` → Fragment)

### #6 — Version history shows real, legible before/after
- Diff now defaults to **previous snapshot → this snapshot** ("what this version changed"), with a toggle to compare against the **current document** instead.
- Diff runs on **block-separated** text (`docLines`), so paragraphs stay on their own lines instead of collapsing into one run.
- Selected snapshot shows a metadata header (full date, kind, word count, author) and an add/removed colour legend.
- Clear states for loading, empty content, and "no differences".
- (X-close, Escape, backdrop-close and inner scroll were already present via `Modal` and `overflow-y-auto`.)
- `apps/web/src/features/history/HistoryPanel.tsx`

### #7 — Refined font-family dropdown
Redesigned the page-font picker: wider panel, larger "Ag" specimen tiles rendered in each face, each option showing its label (in-face) plus a descriptor (e.g. "Newsreader · Editorial, classic"), active state with ring + check.
- `apps/web/src/features/editor/PageHeader.tsx` (`FONT_OPTIONS`, `FontPicker`)

### #8 — Real tooltips on the right-header actions
New portal-based `Tooltip` component (fixed positioning so it never clips, short hover delay, styled per the design tokens). Every right-header control (stats, font, favorite, comments, share, history, more) is wrapped in it; the redundant native `title` on those buttons is suppressed while `aria-label` is kept for a11y.
- `apps/web/src/components/ui/Tooltip.tsx` (new)
- `apps/web/src/features/editor/PageHeader.tsx` (wraps the action buttons)

---

## 3. How to verify (in the running app)

The dev server hot-reloads. On a page (e.g. the reporter's `/p/…`):
1. **#5** — scroll to the very bottom; the top action bar stays pinned the whole way.
2. **#4** — at the top, click the page title in the top bar; it becomes editable; type + Enter renames.
3. **#9** — open "Add icon" (page with no icon) → no "Remove" button; a page *with* an icon still shows Remove.
4. **#8** — hover each right-header icon; a styled tooltip appears.
5. **#7** — click the "T" (font) icon; the dropdown is the refined design.
6. **#6** — open version history, pick a snapshot; you see its metadata and a real previous→this diff, with a toggle to compare against current.

---

## 4. Lessons

- DOM-structural and per-viewport-state behaviour (sticky positioning, scrolled-vs-top states) cannot be confirmed by reading JSX alone — verify in a running browser before calling an issue done. This caused the two bad closures of #4/#5.
- "Code is source of truth" still requires the code to be exercised, not just read.

---

## 5. State changes (applied)

**Closed (all verified in a real browser first):** #4, #5, #6, #7, #8, #9 — each with an evidence-bearing close comment.
**Reopened during the audit before re-closing:** #4, #5 (initial reads were wrong; re-closed only after browser verification).

### Verification method
Headless Chrome driven via the DevTools Protocol: injected the demo session cookies, loaded real pages, and exercised each control through the actual UI (scroll, click, hover), asserting on the resulting DOM. `docLines`+`diffWords` were additionally run against real fetched version content. No `tsc`/`eslint`/`vite build`/runtime errors.

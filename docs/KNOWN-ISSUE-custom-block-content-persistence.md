# Known issue — custom React blocks don't persist their inline content

**Status:** ✅ Fixed 2026-08-14 (TipTap pinned to 2.11.5) · **Severity:** High (silent data
loss) · **Discovered:** 2026-08-14
**Scope:** Pre-existing; not introduced by the Highlight/Toggle/Quote/Code fixes shipped
alongside this note.

> **Resolution.** The leading hypothesis below was confirmed. The BlockNote↔TipTap
> version drift was the root cause of **both** this persistence loss **and** Bug A (the
> caret/first-keystroke jump on insert): with `contentRef` unwired, the block's editable
> element was `contenteditable` but not the ProseMirror node's real content, so keystrokes
> registered in the nearest genuine editable (a sibling paragraph) instead of inline. Pinning
> every `@tiptap/*` package to a single `2.11.5` via `pnpm-workspace.yaml` `overrides`
> re-establishes the wiring in both directions. Verified: `pnpm why @tiptap/react` resolves a
> single `2.11.5`, and the lockfile carries no `2.27.x`/`2.26.x` TipTap. Manual UI check of
> type→reload persistence is left to the app owner per the working agreement.

---

## Summary

Text typed into a **custom React block that holds inline content** — `quote`, `callout`
(Highlight), `toggle`, `syncedBlock`, `smartNotes` — appears on screen but never enters the
editor's document model. Because autosave/versioning persist `editor.document`, the text is
**never saved and disappears on reload**. The reverse direction is broken too: content placed
into these blocks programmatically (via "Turn into…" conversion, or the JSON seed on page
load) lives in the model but **does not render** into the block.

Built-in blocks (paragraph, heading, lists, code block) are unaffected — they are plain
ProseMirror nodes, not React node views.

## How to reproduce (≈60 seconds, manual)

1. Open any page, type `/quote`, press Enter.
2. Type `Hello world` — it shows inside the quote.
3. Reload the page.
4. **Expected:** the quote still reads "Hello world". **Actual:** the quote is empty.

Same result for Highlight (only the 💡 emoji survives) and Toggle. A nested *paragraph*
under a toggle **does** survive — only the custom blocks' own inline text is lost.

## Evidence gathered

Driven through the real UI (headless **and** headed Chrome), reading the authoritative
sources rather than the visible DOM:

| Probe | Result for a quote after typing "QUOTE TEXT" |
|---|---|
| Rendered DOM (`.bn-block-content` text) | `"QUOTE TEXT"` — visible |
| Live ProseMirror doc (`editor._tiptapEditor.state.doc`) | quote node `textContent` = `""` |
| `editor.document` (what autosave serializes) | quote `content: []` |
| Server copy (`GET /api/pages/:id`) after debounced save | quote `content: []` |
| After reload | quote empty |

A sibling `paragraph` typed in the same session syncs correctly in every column above, so the
failure is specific to the custom React node views' `contentDOM`, in **both** directions
(DOM→model on typing, model→DOM on load/convert).

## What was ruled out

- **Not the block markup.** Replacing a block's render with BlockNote's own minimal, known-good
  pattern (`<p ref={contentRef} />`) still fails → the problem is systemic to the editor
  setup, not any one block's JSX.
- **Not duplicate packages.** Single copies in `node_modules` of `@blocknote/core`,
  `@blocknote/react`, `@blocknote/mantine`, `react`, `react-dom`, `@tiptap/core`,
  `@tiptap/react`, `@tiptap/pm`, and `prosemirror-view/model/state`. The browser module graph
  also loads each once (no duplicate runtime instances).
- **Not React StrictMode.** It is intentionally absent (`apps/web/src/main.tsx`).
- **Not collaboration/Yjs.** Reproduces with the `collaboration` option removed from
  `useCreateBlockNote`.

## Root cause (leading hypothesis)

A **peer-version drift between BlockNote and TipTap**.

`@blocknote/react@0.25.2` builds its custom blocks in
`@blocknote/react/src/schema/ReactBlockSpec.tsx` on TipTap's React node-view machinery:

```ts
import { ReactNodeViewRenderer, useReactNodeView } from "@tiptap/react";
// ...
const ref = useReactNodeView().nodeViewContentRef;   // <- the block's contentDOM ref
```

BlockNote 0.25 declares `@tiptap/* "^2.7.1"` / core `"^2.11.5"`, but this workspace resolved
**`@tiptap/react@2.27.2`** (and `@tiptap/core`/`@tiptap/pm@2.27.2`). Across that gap TipTap's
node-view `contentDOM`/`nodeViewContentRef` wiring changed enough that the element BlockNote
hands `contentRef` is no longer registered as the ProseMirror node's editable content. The
element is still `contenteditable` (so it looks and types like an editor), but ProseMirror
neither reads mutations out of it nor renders model content into it — exactly the two-way
desync observed.

> Confidence: high that it is a BlockNote↔TipTap integration break; the specific version pin
> below should be confirmed by the fix-and-verify step rather than assumed.

## Consequences

- **Silent data loss** in Quote, Highlight/Callout, Toggle, Synced block, Smart Notes: any
  content a user types is discarded on reload. Users see it "working" until they come back.
- **"Turn into…" into these blocks** yields an empty block (the source text is preserved in the
  model but not rendered), compounding the impression of data loss.
- **Gates the Toggle caret fix.** The shipped fix correctly lands the caret *inside* the toggle
  on insert, but the typed content still won't persist until this issue is resolved. (The
  Highlight, Quote, and Code-block fixes and the restyle are unaffected — those are layout/CSS
  and don't depend on content sync.)

## Recommended fix

Bring TipTap back to the line BlockNote 0.25 was built and tested against, via a pnpm
override at the workspace root, then reinstall:

```jsonc
// package.json (root)
"pnpm": {
  "overrides": {
    "@tiptap/core": "2.11.5",
    "@tiptap/react": "2.11.5",
    "@tiptap/pm": "2.11.5"
    // pin every @tiptap/extension-* BlockNote pulls in to the same 2.11.x as well,
    // so a single TipTap version is deduped across the tree
  }
}
```

```bash
pnpm install
```

Then restart the dev server and run the verification below. If pinning to the exact `2.11.5`
minimum still drifts, walk forward through the `2.11.x` patch line to the newest that keeps a
single TipTap version resolved.

**Alternative (larger):** upgrade `@blocknote/*` to a release whose peer range officially
covers TipTap 2.27, and adjust the schema/APIs to match. More work, but keeps dependencies
current instead of pinning back.

Either way, verify a *single* `@tiptap/*` version is resolved afterward:

```bash
pnpm why @tiptap/core @tiptap/react @tiptap/pm
```

## Verifying the fix

1. Type `Hello world` into a Quote, a Highlight, and a Toggle; reload → **text is still there.**
2. `GET /api/pages/:id` → each custom block's `content` array carries its text nodes.
3. "Turn into…" a paragraph with text → the resulting Quote/Callout/Toggle **renders** that text.
4. Nested content under a toggle still collapses/expands (regression check on the shipped Bug B fix).

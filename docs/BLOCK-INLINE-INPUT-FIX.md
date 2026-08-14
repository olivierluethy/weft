# Post-mortem — "typed text jumps to the next line" in Toggle, Highlight & Quote

**Date:** 2026-08-14 · **Area:** block editor (BlockNote) · **Severity:** High (three
block types effectively unusable for inline text) · **Status:** Fixed

---

## 1. The state before the fix

When a user opened the `/` slash menu and inserted a **Toggle list**, **Highlight**
(the light-bulb callout), or **Quote** block, the empty block appeared correctly — but
the moment they started typing, the text landed on the *next* line instead of inline
inside the block. They had to click back into the block by hand to type in it. For a
Quote this made the block nearly unusable; for Toggle and Highlight it broke the
expected "insert → type" flow that every other block type has.

### Which blocks worked, which didn't, and how each behaved

| Block | Kind | Behaviour on insert-then-type |
|---|---|---|
| Paragraph | built-in | ✅ text inline |
| Numbered list | built-in | ✅ text inline |
| Bullet list | built-in | ✅ text inline |
| Checklist | built-in | ✅ text inline; Enter adds another item |
| **Highlight / Callout** | **custom React** | ❌ text drops to the next line |
| **Toggle list / Toggle heading** | **custom React** | ❌ text drops to the next line |
| **Quote** | **custom React** | ❌ text drops to the next line |
| Divider / Table of contents | custom React, `content:'none'` | ✅ correctly move the cursor to the next block (no inline text of their own) |

The split is not "some custom blocks vs others" — it is **built-in blocks vs custom
React blocks that hold inline content**. "Highlight" and "Callout" are in fact the same
block type (`callout`); the slash item labelled *Highlight* inserts a `callout`. The
reason a callout could *look* like it worked in some sessions is that the **"+" / "Turn
into" side-menu path** already had a caret fix (see §5), so a callout created that way
behaved, while the same block created from the `/` menu did not. That asymmetry is the
whole story.

## 2. Why the bug survived so long / what made it hard to pin down

- **It looked like a per-block styling problem.** Each block has bespoke JSX (a
  `blockquote`, a flex row with an emoji, a flex row with a chevron button), so the
  natural assumption was that one block's DOM was malformed. It wasn't — the three share
  no markup, yet fail identically.
- **The caret *is* placed correctly in the document model.** For an empty block,
  BlockNote's `setTextCursorPosition(block, 'start')` and `'end'` resolve to the *same*
  position, and `insertOrUpdateBlock` does call it. Inspecting the model after insert
  shows the selection sitting inside the new block — so "the caret is wrong" looks false.
  The failure is on the **DOM** side, one layer below where anyone naturally looks.
- **A previous fix masked half of it.** The "+" convert path was given an explicit
  re-focus, so callouts inserted that way worked. That made the bug intermittent and easy
  to misattribute ("callout works, so the block markup must be fine / the other blocks
  must be individually broken").
- **A separate, real bug sat on top.** Custom-block inline content also wasn't persisting
  (a BlockNote↔TipTap version drift, fixed earlier by pinning TipTap to 2.11.5). That
  fixed *persistence* and the general `contentRef` wiring, but it did **not** address the
  insert-time caret placement — so after that fix the blocks saved their text yet *still*
  dropped the first keystroke to the next line, which is exactly what a "definitive fix"
  had to finish.

## 3. How we confirmed the problem still persisted

The user drove the running app and reported, concretely, that Toggle, Highlight and Quote
still pushed the first typed characters onto a new line while the built-in list blocks and
a convert-created callout did not. That behavioural split — built-in vs custom-inline, and
slash-inserted vs convert-inserted — is the fingerprint that pointed at the insertion path
rather than the block markup.

## 4. Root cause

Custom blocks in BlockNote are **React node views**. TipTap mounts a React node view's
editable element (its `contentDOM`) **asynchronously** — one React commit *after* the
underlying ProseMirror node is created. Built-in blocks are different: they build their
`contentDOM` **synchronously** inside `renderHTML`, so it exists the instant the node does.

The slash-menu insert runs `insertOrUpdateBlock(editor, { type })`, which:

1. converts the empty paragraph to the new block type, then
2. **synchronously** calls `editor.setTextCursorPosition(newBlock)`.

For a built-in block, step 2 lands on a `contentDOM` that already exists — the caret is
in the block, typing is inline. For a **custom React block**, step 2 runs *before* the
node view has mounted its editable, so ProseMirror has no DOM element to map the model
selection onto. On top of that, the click happened inside the slash-menu **popover**, which
holds DOM focus at that moment. When the menu closes and focus returns to the editor, the
browser resolves the selection to the nearest realised editable position — the following
block/line — and the first keystroke goes there. Hence "text jumps to the next line," only
for custom blocks that carry inline content, only from the synchronous `/` path.

This is why the three blocks fail together despite sharing no markup, why built-in blocks
are immune, and why the same callout created from the "+" menu (which re-focuses after an
`await`, i.e. after the commit) behaves.

## 5. What actually resolved it

At the shared slash-insertion source (`insertBlockType`, `blockTypes.tsx`), after
`insertOrUpdateBlock` returns the new block, we re-assert the caret **on the next animation
frame** — once the React node view has committed its editable — and hand focus back to the
editor:

```ts
function focusInsertedInlineBlock(editor, blockId) {
  requestAnimationFrame(() => {
    try {
      editor.focus();
      editor.setTextCursorPosition(blockId, 'end');
    } catch { /* block gone or not a text block */ }
  });
}
```

It is applied **only** to Weft's custom blocks that hold inline content — guarded by
`def.spec.type in weftCustomBlockSpecs` **and** `editor.schema.blockSchema[type].content
=== 'inline'`. Built-in blocks (paragraph, bullet/numbered/checklist, heading) and
`content:'none'` blocks (Divider, Table of contents) are deliberately excluded: the former
already place the caret correctly, and the latter must keep moving the cursor to the next
block. This mirrors the logic the "+" convert path (`Editor.tsx` `handleBlockConvert`)
already uses successfully.

## 6. Why this is the correct, definitive solution — not a workaround

- **It fixes the actual mechanism.** The defect is a *timing* mismatch between when the
  caret is set (synchronously) and when a custom node view's editable exists (a frame
  later). Re-asserting the caret after the commit addresses that mechanism directly; it is
  the standard, necessary sequencing for asynchronously-mounted node views, not a cosmetic
  patch.
- **It aligns the broken path with the already-correct one.** The "+" convert path already
  worked precisely because it re-focuses after the commit. We brought the `/` path into
  line with it instead of inventing a new mechanism — exactly the "make the broken blocks
  behave like the working ones" requirement.
- **It is at the shared source, once.** One guarded call covers Toggle, Highlight/Callout,
  Quote and any future custom inline block, rather than three per-block hacks.
- **It cannot regress the working blocks.** The guard means built-in blocks and
  `content:'none'` blocks never enter the new code path, so Numbered/Bullet/Checklist,
  callout-via-convert, the Divider fix, and cover images are all untouched.
- **It is not a focus/`preventDefault` kludge.** No event is swallowed, no keystroke is
  intercepted, no DOM is hand-mutated. We use BlockNote's own public `setTextCursorPosition`
  API on the frame the editable becomes real — which is the point at which any correct
  implementation could place the caret at all.

## 7. Files touched

- `apps/web/src/features/editor/blockTypes.tsx` — `focusInsertedInlineBlock` helper +
  guarded call in `insertBlockType`'s `simple` case.

## 7a. Correction — the real root cause was the DOM selection, not mount timing

Sections 4–6 above blamed *async mount timing* and two successive fixes tried to beat it
by re-asserting `editor.setTextCursorPosition` — first after a single
`requestAnimationFrame`, then on every frame until the model caret "landed". **Both were
wrong.** Driving the real app headlessly (Chrome via CDP, inserting each block and typing a
character *with nothing between the menu click and the keystroke*, like a fast user) showed
the actual mechanism, and it is not what re-asserting the model caret can fix:

- On insert, BlockNote's **model** selection *is* already inside the new block — the block
  even carries `data-is-empty-and-focused="true"`. The content element exists within a
  frame. So "the editable hasn't mounted yet / the model caret is wrong" is false.
- What is wrong is the **browser DOM selection**. For an *empty* custom React node view,
  ProseMirror never syncs the DOM caret into the content element; the DOM selection strands
  at the block-container boundary (`DIV.bn-block`, offset 1), *outside* the editable.
- `editor.setTextCursorPosition` **cannot move the DOM caret there** — on one frame or on
  twenty. Re-asserting the model caret is a no-op for this failure, which is why the
  first typed character, arriving at that boundary, spawned a **new block** (the CDP repro
  literally produced a second, empty callout above the one holding the text).
- A **mouse click** fixed it for users because a click drops a *native DOM caret* into the
  content element. That is the whole content of the workaround.

**The fix does programmatically what the click does:** once the node view has committed,
drop a **collapsed DOM `Range`** into the block's empty content element and let ProseMirror
adopt it (kept alongside `setTextCursorPosition` so model/undo state stays in agreement).
Verified end-to-end with instant typing across repeated runs: Highlight, Quote **and**
Toggle all land the text inline in a single block, while built-in blocks (Bullet List) and
`content:'none'` blocks (Divider) are untouched by the call-site guard.

```ts
// after the node view mounts, mirror a click: place a real DOM caret in the content hole
const hole = /* empty, editable content element inside the block's .bn-block-content */;
editor.focus();
editor.setTextCursorPosition(blockId, 'end');   // model caret (undo/history)
const range = document.createRange();
range.selectNodeContents(hole);
range.collapse(true);
const sel = window.getSelection();
sel.removeAllRanges();
sel.addRange(range);                            // browser caret — the part that was missing
```

**Lesson:** the two earlier "definitive" writeups asserted success from the block *looking*
right; neither was confirmed by actually typing a character. The bug was only understood
once the exact user interaction (insert → immediate keystroke) was reproduced and the live
DOM selection inspected.

## 8. Follow-ups (optional)

- If a future upgrade makes BlockNote mount custom node views synchronously, this
  re-assertion becomes a harmless no-op and could be removed.
- Consider giving the custom blocks' editable elements BlockNote's own `bn-inline-content`
  class for full parity with built-in blocks (placeholder styling, etc.). Not required for
  the fix; left out here to avoid unverified visual changes.

# Post-mortem: "All headings render at the same size"

**Component:** block editor (BlockNote) heading levels
**Symptom:** setting a block to Heading 1 / 2 / 3 / … produced no visible change — every
heading looked identical, in the wrong (serif) font.
**Time to fix:** three rounds over a long stretch, most of it spent fixing the *wrong* things.
**Real root cause:** a single CSS declaration that pinned the heading **text** to the body size.
**Status:** fixed (branch `feat/heading-hierarchy`, PR #3).

This document is deliberately blunt about the mistakes made along the way, because the
interesting part of this bug is not the one-line fix — it's *why it stayed hidden for so long,
including through two rounds where I confidently declared it "fixed" and it wasn't.*

---

## 1. What the user saw

> "When I select text and set it to Heading 1, then Heading 2 or 3, they look identical."

And, after two attempted fixes:

> "Well, but inside of the frontend I don't see the difference between heading 1 and heading 2.
> Everything just looks the same. Check inside of the localhost using Playwright and check it
> out for yourself."

That last sentence is the one that actually solved the bug. More on that below.

---

## 2. Background: how a BlockNote heading is built in the DOM

You cannot understand this bug without the DOM shape. BlockNote does **not** render a heading
as a plain `<h1>`. A heading block looks like this:

```
.bn-block-outer
└─ .bn-block
   └─ .bn-block-content   [data-content-type="heading"] [data-level="2"]   ← the "block"
      └─ .bn-inline-content                                                 ← the TEXT lives here
         └─ "This is Heading 2"
```

Two facts that matter enormously:

1. The **level** (`data-level`) lives on `.bn-block-content` (the *wrapper*).
2. The **text** you actually see lives one level deeper, in `.bn-inline-content` (the *child*).

Almost everything that went wrong flows from conflating those two elements.

There is also a third-party detail: BlockNote's own stylesheet sizes headings with a CSS
variable, and only defines it for **three** levels:

```css
[data-content-type=heading]            { --level: 3em; }   /* default = H1 */
[data-content-type=heading][data-level="2"] { --level: 2em; }
[data-content-type=heading][data-level="3"] { --level: 1.3em; }
.bn-block-content[data-content-type=heading] { font-size: var(--level); font-weight: 700; }
```

There is no rule for levels 4–6, and the built-in heading block hard-caps `level` at `[1,2,3]`.
So "6 levels" was never going to work out of the box — that part was real and had to be solved.
But it was a *distraction* from the actual rendering bug.

---

## 3. The investigation, round by round

### Round 1 — build the feature (and unknowingly plant the bug)

The task was a full 6-level type scale with a single source of truth. I did a lot of correct
work here:

- Discovered BlockNote's heading caps `level` at `[1,2,3]`, so I wrote a custom 6-level heading
  block (`features/editor/heading.ts`).
- Created `features/editor/headingScale.ts` as the single source of truth and injected the scale
  as `--hN-*` CSS custom properties.
- Rewrote the heading rules in `editor.css` to size each level from those tokens.

All of that worked. But it sat on top of a base rule that had been in the file the whole time
and that I copied forward without questioning:

```css
/* editor.css — the line that was the real bug, hiding in plain sight */
.weft-page-content .bn-block-content,
.weft-page-content .bn-inline-content {         /* ← note: BOTH selectors */
  font-family: var(--wf-body-font);
  font-size: var(--body-size);                  /* ← 16px, set on the TEXT element */
  line-height: var(--body-lh);
  color: var(--ink);
}
```

My heading rules set `font-size: 2.25rem` on `.bn-block-content[...heading...]` — the *wrapper*.
But this base rule set `font-size: 16px` **directly on `.bn-inline-content`** — the *text*.
That is the whole bug. I just didn't know it yet, because I never suspected a line I hadn't
written in this task.

### Round 2 — two real problems, one fake "fix", and a false positive

The user reported two things: (a) only Heading 4/5/6 were selectable, and (b) everything still
rendered the same size.

**Bug (a) was real and I found its true cause.** Replacing the built-in heading block broke a
BlockNote guard:

```ts
// @blocknote/core — checkDefaultBlockTypeInSchema
return editor.schema.blockSchema[type] === defaultBlockSchema[type];   // REFERENCE equality
```

BlockNote only shows its default Heading 1/2/3 slash-menu and toolbar items when the heading
block in the schema is *the exact same object* as its built-in one. My custom block is a
different object → the check fails → BlockNote silently drops all of its heading UI. Only the
Heading 4/5/6 items I'd added by hand survived. Good find, correct fix (provide all six items
myself).

**Bug (b) is where I went wrong.** I convinced myself it was fixed, twice, with two independent
pieces of "evidence" that were both flawed:

1. **A static CSS repro that lied.** I built a standalone HTML file with BlockNote's real
   stylesheet + our `editor.css` + the tokens, to prove the cascade produced 36/28/22/18/16/14.
   It did. But I had written the mock DOM with the text placed **directly inside
   `.bn-block-content`** — I omitted the `.bn-inline-content` child. So my repro literally could
   not reproduce the bug, because the bug is *the child overriding the parent*, and my repro had
   no child. A green result from a test that can't fail is worse than no test.

2. **A live measurement of the wrong element.** I then drove the real app headlessly and
   measured the computed `font-size` — of `.bn-block-content`:

   ```
   H1: font-size=36px  H2: 28px  H3: 22px  H4: 18px  H5: 16px  H6: 14px   ✅ (but meaningless)
   ```

   The wrapper *did* have the right size. I saw those numbers, matched them to the spec, and
   declared victory. I never measured `.bn-inline-content` — the element that actually holds the
   text the user looks at.

So I shipped a correct fix for Bug (a), a wrong "all clear" for Bug (b), and told the user it was
done. It wasn't.

### Round 3 — the screenshot that broke the illusion

The user pushed back a third time and said, in effect, *stop measuring, look at it*:

> "Everything just looks the same. Check inside of the localhost using Playwright and check it
> out for yourself."

So this time I drove the app the way a *user* does — created the headings interactively and
**took a screenshot and actually looked at it.** The screenshot showed four "headings" that were
all roughly the same size and all in the serif body font. My computed-style numbers said 36px;
my eyes (and the pixels) said ~16px. When the instrument and reality disagree, the instrument is
measuring the wrong thing.

That forced the obvious next question I should have asked in round 2: *if the block is 36px but
the text is small, what size is the text element?* One measurement of the right node settled it:

```
lvl 1:  blockContentSize=36px   INLINEsize=16px   ← the text is 16px, not 36px
lvl 2:  blockContentSize=28px   INLINEsize=16px
lvl 3:  blockContentSize=22px   INLINEsize=16px
lvl 4:  blockContentSize=18px   INLINEsize=16px
```

There it was. The wrapper scaled perfectly; the text never moved.

---

## 4. The real root cause

CSS **inheritance is the weakest source of a value.** A parent's `font-size` only reaches a
child if the child has *no declaration of its own* for that property. It has nothing to do with
selector specificity across elements — an inherited value loses to *any* direct declaration on
the element, however weak.

Our base rule put a direct declaration on the text element:

```css
.weft-page-content .bn-inline-content { font-size: var(--body-size); }   /* 16px, always */
```

So the cascade for the H1 text was:

```
.bn-block-content[heading]   font-size: 2.25rem   ← set, but this is the PARENT
   └─ .bn-inline-content     font-size: 16px       ← the text element has its OWN value → WINS
         └─ "This is Heading 1"   renders at 16px
```

The heading size was applied to a box whose child text refused to inherit it. **No token, no
custom block, and no cascade order could ever have fixed this**, because none of them were the
problem — the text element was overriding all of them with its own hard-coded 16px. The same
line also pinned the font-*family*, which is why headings rendered in the serif body face
instead of Space Grotesk.

This is why it "would have never worked": every other part of the system (the six-level block,
the token injection, the slash menu, the specificity of the heading rules) was **actually
correct**. They were all sizing the wrong element. The one line that mattered had been in the
file since before this task and was never the thing I was looking at.

---

## 5. Why I didn't find it sooner (the honest part)

Three failures, in order of how much they cost:

1. **I never suspected pre-existing code.** I treated "my new code" as the search space and the
   old base rule as background furniture. The bug was in the furniture.
2. **My verification measured a proxy, not the thing.** "Computed `font-size` on
   `.bn-block-content` = 36px" is not the same claim as "the text is 36px," but I let the first
   stand in for the second. They differ by exactly one DOM level — and that level *was the bug*.
3. **My repro was shaped to pass.** I simplified the DOM in the harness and removed the very
   node (`.bn-inline-content`) whose behavior was in question. A test that omits the failure
   condition will always be green.

The meta-lesson: **for a visual bug, the ground truth is the rendered pixels.** A screenshot
would have exposed this in round 2 in ten seconds. Computed-style numbers are only trustworthy
once you've proven you're reading them off the element the user actually sees.

---

## 6. The fix

Size the block, and let the text inherit it — never give the text its own competing value.

```css
/* Before — pins the text (and font) to body regardless of heading level */
.weft-page-content .bn-block-content,
.weft-page-content .bn-inline-content {
  font-family: var(--wf-body-font);
  font-size: var(--body-size);
  line-height: var(--body-lh);
  color: var(--ink);
}

/* After — block is the only sizing surface; inline text follows it */
.weft-page-content .bn-block-content {
  font-family: var(--wf-body-font);
  font-size: var(--body-size);
  line-height: var(--body-lh);
  color: var(--ink);
}
.weft-page-content .bn-inline-content {
  font: inherit;     /* family + size + weight + line-height all inherit from the block */
  color: inherit;
}
```

`font: inherit` makes the text element take *whatever its block computes* — body size for a
paragraph, `2.25rem` for an H1, `1.75rem` for an H2, and so on. The heading rules (which set the
size on `.bn-block-content` per level) now reach the text unchanged.

### Verified — by measuring the text element, and by looking

```
lvl 1:  inlineSize=36px  weight=700  font="Space Grotesk"
lvl 2:  inlineSize=28px  weight=700  font="Space Grotesk"
lvl 3:  inlineSize=22px  weight=600  font="Space Grotesk"
lvl 4:  inlineSize=18px  weight=600  font="Space Grotesk"
```

And the screenshot finally showed a real, stepped hierarchy: H1 ≫ H2 ≫ H3 ≫ H4, in Space
Grotesk, with the body paragraph clearly smaller and in the serif face.

---

## 7. The full list of things that were actually wrong (and got fixed)

For the record, three genuinely separate defects were fixed across the rounds. Only the last one
was the "all the same size" bug; the first two were real but were not what the user kept seeing.

| # | Defect | Root cause | Fix |
|---|--------|-----------|-----|
| 1 | Only 3 heading levels possible | BlockNote's built-in heading caps `level` at `[1,2,3]` | Custom 6-level heading block (`heading.ts`) |
| 2 | Only H4–H6 selectable; H1–H3 gone | Swapping the block broke BlockNote's reference-equality `checkDefaultBlockTypeInSchema` guard, hiding its default heading UI | Emit all six heading items ourselves (slash menu + a custom toolbar switch) |
| 3 | **Every heading renders at 16px** | Base rule set `font-size` directly on `.bn-inline-content` (the text), overriding the per-level size set on `.bn-block-content` (the wrapper) | Size `.bn-block-content` only; `.bn-inline-content { font: inherit }` |

---

## 8. Takeaways for the next person

- **BlockNote headings have two layers.** `data-level` and your size rules go on
  `.bn-block-content`; the text is in `.bn-inline-content`. Never set a competing `font-size` or
  `font-family` on the inline layer, or it wins over the block's size by inheritance rules.
- **Inheritance is the weakest cascade source.** A direct declaration on an element always beats
  a value it would otherwise inherit — specificity doesn't enter into it across elements.
- **Verify against the rendered output for anything visual.** Screenshot first; measure computed
  styles second, and only on the exact node the user sees.
- **A passing test proves nothing if it can't reproduce the failure.** My CSS repro omitted the
  `.bn-inline-content` child — the one variable under test — so its green was worthless.
- **Don't exempt inherited/old code from the search.** The bug lived in a line that predated the
  task and that I kept scrolling past because "I didn't write that."

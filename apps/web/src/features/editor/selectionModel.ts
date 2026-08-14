// Imported from `prosemirror-state` directly — the SAME single resolved copy
// BlockNote's editor state is built from (see multilineBlocks.ts). A Selection
// class from a second prosemirror copy would not interoperate with that state.
import { TextSelection } from 'prosemirror-state';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Everything the selection toolbar needs to *know* and *do* about a text
 * selection, with no React in it — so the rules can be reasoned about (and
 * reused) independently of the surface that renders them.
 *
 * Three jobs:
 *
 * 1. **Read the truth about a range.** BlockNote's `getActiveStyles()` reports
 *    the marks at the *end* of the selection (`$to.marks()`), which is exactly
 *    wrong for a toolbar: select "normal **bold** normal" and it says "not bold"
 *    while half the run is bold. `scanSelection` instead walks every text node in
 *    the range and measures how many characters each mark actually covers, which
 *    is what makes an honest on / off / **mixed** state possible (§18 of the
 *    brief, docs/STYLEGUIDE.md §6.8).
 *
 * 2. **Keep the selection.** The classic rich-text bug is: select text → click a
 *    toolbar control → the browser moves the selection to the control → the
 *    formatting lands somewhere else. Two defences, and we use both. Buttons
 *    cancel their own `mousedown` so the selection never moves in the first
 *    place; and every verb below runs through `runOnSelection`, which re-asserts
 *    a recorded ProseMirror range before acting. That covers the case a
 *    `preventDefault` can't: a popover (link field, colour grid, block search)
 *    that legitimately takes focus.
 *
 * 3. **Act on it.** Inline styles, links and clear-formatting are applied as
 *    ProseMirror transactions over the recorded range, so partial selections stay
 *    partial and the block structure is never touched.
 */

export interface PmRange {
  from: number;
  to: number;
}

type AnyEditor = any;

/** The live ProseMirror view behind a BlockNote editor. */
function viewOf(editor: AnyEditor): any | null {
  return editor?._tiptapEditor?.view ?? editor?.prosemirrorView ?? null;
}

/** The current ProseMirror selection as a plain range, or `null`. */
export function currentRange(editor: AnyEditor): PmRange | null {
  const view = viewOf(editor);
  if (!view) return null;
  const sel = view.state.selection;
  // CellSelection and friends expose `ranges`; take the outer bounds.
  const from = Math.min(...sel.ranges.map((r: any) => r.$from.pos));
  const to = Math.max(...sel.ranges.map((r: any) => r.$to.pos));
  return Number.isFinite(from) && Number.isFinite(to) ? { from, to } : null;
}

/** Clamp a recorded range to a document that may have changed under it. */
function clamp(range: PmRange, docSize: number): PmRange {
  const from = Math.max(0, Math.min(range.from, docSize));
  const to = Math.max(from, Math.min(range.to, docSize));
  return { from, to };
}

/**
 * Put the editor's selection back where the user left it, then run `fn`.
 *
 * `range` is the snapshot the toolbar recorded while it was visible. If the live
 * selection already matches it — the normal case, because ProseMirror keeps its
 * state selection even while the editor is blurred — nothing is dispatched and
 * `fn` runs against an untouched editor. Only a genuine divergence triggers a
 * `TextSelection` restore, so an action fired from a popover still lands on the
 * original characters.
 *
 * **It deliberately does not focus the editor.** Every command below dispatches
 * a transaction, which ProseMirror applies (and renders) whether or not the view
 * has focus. Grabbing focus would rip it out of the panel the user is standing
 * in — and repeatable pickers (colour, font) exist precisely so you can try
 * three values in a row without reselecting anything.
 */
export function runOnSelection<T>(
  editor: AnyEditor,
  range: PmRange | null,
  fn: () => T,
): T | undefined {
  const view = viewOf(editor);
  if (!view) return undefined;
  if (range) {
    const { from, to } = clamp(range, view.state.doc.content.size);
    const sel = view.state.selection;
    if (sel.from !== from || sel.to !== to) {
      try {
        view.dispatch(
          view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)),
        );
      } catch {
        /* the range no longer addresses text (block replaced) — act on the live one */
      }
    }
  }
  return fn();
}

/**
 * Where the selection sits on screen, measured from ProseMirror rather than from
 * `window.getSelection()` — the toolbar has to stay glued to the text even while
 * the browser's focus (and therefore its DOM selection) is inside one of the
 * toolbar's own panels. Same maths as tiptap's `posToDOMRect`.
 */
export function measureSelectionRect(
  editor: AnyEditor,
  range: PmRange | null,
): { top: number; bottom: number; left: number; right: number } | null {
  const view = viewOf(editor);
  if (!view || !range) return null;
  try {
    const { from, to } = clamp(range, view.state.doc.content.size);
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to, -1);
    return {
      top: Math.min(start.top, end.top),
      bottom: Math.max(start.bottom, end.bottom),
      left: Math.min(start.left, end.left),
      right: Math.max(start.right, end.right),
    };
  } catch {
    return null;
  }
}

// ── Reading the selection ───────────────────────────────────────────────────

export interface MarkState {
  /** Every selected character carries this mark. */
  active: boolean;
  /** Some — but not all — selected characters carry it (§18). */
  mixed: boolean;
  /** For string-valued styles (colour, font): the value, or `null` when the
   *  selection mixes several values. */
  value: string | null;
}

export interface SelectionScan {
  /** Characters of real text inside the range (0 for an empty selection). */
  length: number;
  /** Per mark name: characters covered, and the distinct values seen. */
  marks: Record<string, { covered: number; values: Set<string> }>;
}

const EMPTY_SCAN: SelectionScan = { length: 0, marks: {} };

/**
 * Measure mark coverage across the whole selection — the basis for on / off /
 * mixed. Counts characters, not nodes, so a two-character bold run inside a
 * hundred-character selection reads as "mixed", not "bold".
 */
export function scanSelection(editor: AnyEditor, range: PmRange | null): SelectionScan {
  const view = viewOf(editor);
  if (!view || !range) return EMPTY_SCAN;
  const { from, to } = clamp(range, view.state.doc.content.size);
  if (to <= from) return EMPTY_SCAN;

  const scan: SelectionScan = { length: 0, marks: {} };
  view.state.doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (!node.isText) return;
    const covered = Math.min(pos + node.nodeSize, to) - Math.max(pos, from);
    if (covered <= 0) return;
    scan.length += covered;
    for (const mark of node.marks) {
      const name = mark.type.name;
      const entry = (scan.marks[name] ??= { covered: 0, values: new Set<string>() });
      entry.covered += covered;
      const value = mark.attrs?.stringValue;
      if (typeof value === 'string') entry.values.add(value);
    }
  });
  return scan;
}

/** Resolve one mark's on / off / mixed state out of a scan. */
export function markState(scan: SelectionScan, name: string): MarkState {
  const entry = scan.marks[name];
  if (!entry || scan.length === 0) return { active: false, mixed: false, value: null };
  const active = entry.covered >= scan.length;
  const values = [...entry.values];
  return {
    active,
    mixed: entry.covered > 0 && !active,
    value: values.length === 1 ? values[0]! : null,
  };
}

/**
 * The blocks whose text the selection actually touches, innermost first — the
 * unit a block transformation applies to (§17). Walks the ProseMirror tree for
 * `blockContent` nodes in range and reads the id off their `blockContainer`
 * parent, so nested list items and blocks inside columns are found exactly as
 * they appear on screen.
 */
export function selectedBlockIds(editor: AnyEditor, range: PmRange | null): string[] {
  const view = viewOf(editor);
  if (!view) return [];
  const r = range ?? currentRange(editor);
  if (!r) return [];
  const { from, to } = clamp(r, view.state.doc.content.size);
  const ids: string[] = [];
  view.state.doc.nodesBetween(from, to, (node: any, _pos: number, parent: any) => {
    if (node.type?.spec?.group !== 'blockContent') return;
    const id = parent?.attrs?.id;
    if (typeof id === 'string' && id && !ids.includes(id)) ids.push(id);
  });
  return ids;
}

/** The live BlockNote blocks for `selectedBlockIds` (skipping any that vanished). */
export function selectedBlocks(editor: AnyEditor, range: PmRange | null): any[] {
  return selectedBlockIds(editor, range)
    .map((id) => {
      try {
        return editor.getBlock(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ── Acting on the selection ─────────────────────────────────────────────────

/** Mark names that count as *inline formatting* — everything Clear formatting
 *  resets. Read off the live schema so a style added later is covered for free;
 *  `link` is deliberately not a style in BlockNote and survives (§12). */
export function styleMarkNames(editor: AnyEditor): string[] {
  return Object.keys(editor?.schema?.styleSchema ?? {});
}

/** Toggle a boolean inline style over the selection. A **mixed** selection turns
 *  fully on first (the expected "make all of this bold"), matching every editor
 *  the user has met. */
export function toggleBooleanStyle(
  editor: AnyEditor,
  range: PmRange | null,
  name: string,
  state: MarkState,
): void {
  runOnSelection(editor, range, () => {
    if (state.active) editor.removeStyles({ [name]: true });
    else editor.addStyles({ [name]: true });
  });
}

/** Set (or clear, with `null`) a string-valued inline style — colour, font. */
export function setStringStyle(
  editor: AnyEditor,
  range: PmRange | null,
  name: string,
  value: string | null,
): void {
  runOnSelection(editor, range, () => {
    const view = viewOf(editor);
    const markType = view?.state?.schema?.marks?.[name];
    // Always strip the old value first: `setMark` on a range that already has a
    // different value would otherwise leave two marks stacked on the same run.
    if (markType && view) {
      const { from, to } = clamp(range ?? currentRange(editor)!, view.state.doc.content.size);
      view.dispatch(view.state.tr.removeMark(from, to, markType));
    }
    if (value) editor.addStyles({ [name]: value });
  });
}

/**
 * Strip every inline style from the selection, leaving the block type, the block
 * structure and any links intact (§12). One transaction, so it is a single undo.
 */
export function clearInlineFormatting(editor: AnyEditor, range: PmRange | null): void {
  runOnSelection(editor, range, () => {
    const view = viewOf(editor);
    if (!view) return;
    const r = range ?? currentRange(editor);
    if (!r) return;
    const { from, to } = clamp(r, view.state.doc.content.size);
    if (to <= from) return;
    const tr = view.state.tr;
    for (const name of styleMarkNames(editor)) {
      const markType = view.state.schema.marks[name];
      if (markType) tr.removeMark(from, to, markType);
    }
    if (tr.docChanged || tr.steps.length) view.dispatch(tr);
  });
}

// ── Links ───────────────────────────────────────────────────────────────────

export interface LinkInfo {
  href: string;
  /** The full extent of the link mark under the selection (may exceed it). */
  from: number;
  to: number;
  text: string;
}

/** The link (if any) the selection sits inside or overlaps, with its full range —
 *  so "Remove link" removes the whole link, not just the selected slice. */
export function linkInSelection(editor: AnyEditor, range: PmRange | null): LinkInfo | null {
  const view = viewOf(editor);
  if (!view) return null;
  const r = range ?? currentRange(editor);
  if (!r) return null;
  const { from, to } = clamp(r, view.state.doc.content.size);
  const linkType = view.state.schema.marks.link;
  if (!linkType) return null;

  let href = '';
  let start = -1;
  let end = -1;
  view.state.doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (!node.isText || start >= 0) return;
    const mark = node.marks.find((m: any) => m.type === linkType);
    if (!mark) return;
    href = String(mark.attrs.href ?? '');
    // Grow out to the mark's real boundaries: a link can span several text
    // nodes (one per differing style run), so removing it must cover them all.
    const $pos = view.state.doc.resolve(pos);
    const parentStart = $pos.start();
    const runs: { from: number; to: number; linked: boolean }[] = [];
    $pos.parent.forEach((child: any, offset: number) => {
      const f = parentStart + offset;
      runs.push({
        from: f,
        to: f + child.nodeSize,
        linked:
          child.isText &&
          child.marks.some((m: any) => m.type === linkType && m.attrs.href === href),
      });
    });
    const at = runs.findIndex((r) => r.from <= pos && pos < r.to);
    if (at < 0) {
      start = pos;
      end = pos + node.nodeSize;
      return;
    }
    let lo = at;
    while (lo > 0 && runs[lo - 1]!.linked) lo--;
    let hi = at;
    while (hi < runs.length - 1 && runs[hi + 1]!.linked) hi++;
    start = runs[lo]!.from;
    end = runs[hi]!.to;
  });

  if (start < 0) return null;
  return { href, from: start, to: end, text: view.state.doc.textBetween(start, end) };
}

/**
 * Link the selection. When the display text is unchanged we add the mark in
 * place, which **preserves the inline formatting already on the run** — unlike
 * BlockNote's `createLink`, which rewrites the range as plain text. When the user
 * genuinely edits the text, we fall back to replacing it (formatting can't be
 * carried onto characters that no longer exist).
 */
export function applyLink(
  editor: AnyEditor,
  range: PmRange | null,
  url: string,
  text?: string,
): void {
  if (!url.trim()) return;
  const href = normaliseUrl(url);
  runOnSelection(editor, range, () => {
    const view = viewOf(editor);
    if (!view) return;
    const r = currentRange(editor);
    if (!r) return;
    const { from, to } = clamp(r, view.state.doc.content.size);
    const current = view.state.doc.textBetween(from, to);
    const linkType = view.state.schema.marks.link;
    if (!linkType) return;
    if (!text || text === current) {
      const tr = view.state.tr.removeMark(from, to, linkType);
      tr.addMark(from, to, linkType.create({ href }));
      view.dispatch(tr);
    } else {
      editor.createLink(href, text);
    }
  });
}

/** Remove the link under the selection, across its whole extent. */
export function removeLink(editor: AnyEditor, range: PmRange | null): void {
  const info = linkInSelection(editor, range);
  runOnSelection(editor, range, () => {
    const view = viewOf(editor);
    if (!view) return;
    const linkType = view.state.schema.marks.link;
    if (!linkType) return;
    const r = info ?? clamp(range ?? currentRange(editor)!, view.state.doc.content.size);
    view.dispatch(view.state.tr.removeMark(r.from, r.to, linkType));
  });
}

/** Accept what people actually paste. A bare domain becomes `https://`; an
 *  address becomes `mailto:`; anything already carrying a scheme is left alone. */
export function normaliseUrl(input: string): string {
  const url = input.trim();
  if (!url) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  if (url.startsWith('/') || url.startsWith('#')) return url;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
  return `https://${url}`;
}

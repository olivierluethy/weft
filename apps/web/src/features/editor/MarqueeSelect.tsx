import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Trash2, X } from 'lucide-react';

type Box = { left: number; top: number; width: number; height: number };
type Rect2 = { left: number; top: number; right: number; bottom: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = any;

const THRESHOLD = 4; // px of movement before a click becomes a marquee drag
const EDGE = 72; // px hot-zone at each viewport edge that triggers auto-scroll
const MAX_SPEED = 24; // px per animation frame at the very edge

function intersects(a: Rect2, b: DOMRect) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = { id: string; children?: Block[] } & Record<string, any>;

/** Leaf block ids under a block (itself if it has no children). */
function leafIds(block: Block): string[] {
  if (block.children && block.children.length) return block.children.flatMap(leafIds);
  return [block.id];
}

/**
 * Turn a flat set of selected LEAF ids into the minimal set of blocks to remove.
 * A container (e.g. a column layout) whose every leaf is selected collapses to
 * the container id — so deleting a fully-covered columns block removes the whole
 * layout, while a partial selection deletes just the covered leaves and leaves
 * the layout intact. Recurses so nested containers are handled at every depth.
 */
function planDeletion(blocks: Block[], selected: Set<string>): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.children && b.children.length) {
      const leaves = leafIds(b);
      if (leaves.length && leaves.every((id) => selected.has(id))) out.push(b.id);
      else out.push(...planDeletion(b.children, selected));
    } else if (selected.has(b.id)) {
      out.push(b.id);
    }
  }
  return out;
}

/**
 * Photoshop-style rubber-band selection of editor blocks, with edge auto-scroll
 * so a selection can extend far past the visible viewport on a long page.
 *
 * **Coordinate model (the crux).** The drag anchor is stored in *document*
 * coordinates (`clientX/Y + scroll`), NOT viewport coordinates. The live
 * endpoint is the pointer's viewport position. Every frame we convert the anchor
 * back to the viewport for the CURRENT scroll offset, so the marquee rectangle
 * grows with the document — scrolling never leaves the anchor stranded and the
 * selection never "jumps". Blocks are still hit-tested with their live viewport
 * rects, so blocks that scroll above/below the fold stay selected because their
 * document position is inside the anchor→endpoint span.
 *
 * **Auto-scroll.** While a drag is active and the pointer sits within `EDGE` px
 * of the scroll container's top/bottom, a rAF loop scrolls the container at a
 * speed proportional to how deep into the hot-zone the pointer is (gentle near
 * the boundary, fast at the very edge). New blocks entering the viewport are
 * folded into the selection on each tick — even with the mouse held still.
 *
 * Highlights are portalled overlays (not classes on block DOM) because
 * BlockNote's React reconciler overwrites attributes it owns. A plain click (no
 * movement past THRESHOLD) clears any selection and is left untouched, so caret
 * placement, in-block text selection, and block-handle dragging keep working.
 */
export function MarqueeSelect({ editor }: { editor: AnyEditor }) {
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [highlights, setHighlights] = useState<Box[]>([]);
  const selectedIds = useRef<string[]>([]);
  // Drag anchor in DOCUMENT coordinates (viewport + scroll at mousedown).
  const anchor = useRef<{ x: number; y: number } | null>(null);
  // Last known pointer position in VIEWPORT coordinates (drives endpoint + edge).
  const pointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const drag = useRef<{ active: boolean } | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const root = (editor.domElement ?? document.querySelector('.weft-page-content')) as HTMLElement | null;
    const container = (root?.closest('[data-page-scroll]') ?? root) as HTMLElement | null;
    if (!container) return;

    // Every *leaf* content block, at any nesting depth. A block is selectable
    // when it holds no nested block of its own — so real content (paragraph,
    // heading, table, chart, image, database, …) is included whether it sits at
    // the top level or inside a column, while structural wrappers (columnList /
    // column) are skipped in favour of the blocks they contain. This is what
    // makes the marquee generic: any block registered in the schema is caught,
    // not an enumerated list of types.
    const selectableBlocks = (): HTMLElement[] => {
      const editorEl = container.querySelector('.bn-editor');
      if (!editorEl) return [];
      return [...editorEl.querySelectorAll('.bn-block[data-id]')].filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && !el.querySelector('.bn-block[data-id]'),
      );
    };

    const clearSelection = () => {
      selectedIds.current = [];
      setHighlights([]);
    };

    const boxOf = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });

    // Recompute the marquee rect + intersecting blocks for the CURRENT scroll
    // offset. Called on pointer move AND on every auto-scroll frame, so the
    // selection tracks the content even while the pointer is held still.
    const recompute = () => {
      const a = anchor.current;
      if (!a || !drag.current?.active) return;
      // Anchor's live viewport position = document anchor − current scroll.
      const ax = a.x - container.scrollLeft;
      const ay = a.y - container.scrollTop;
      const px = pointer.current.x;
      const py = pointer.current.y;
      const m: Rect2 = {
        left: Math.min(ax, px),
        top: Math.min(ay, py),
        right: Math.max(ax, px),
        bottom: Math.max(ay, py),
      };
      setMarquee({ left: m.left, top: m.top, width: m.right - m.left, height: m.bottom - m.top });
      const ids: string[] = [];
      const boxes: Box[] = [];
      for (const el of selectableBlocks()) {
        const r = el.getBoundingClientRect();
        if (intersects(m, r)) {
          const id = el.getAttribute('data-id');
          if (id) { ids.push(id); boxes.push(boxOf(r)); }
        }
      }
      selectedIds.current = ids;
      setHighlights(boxes);
    };

    // Auto-scroll velocity from the pointer's distance into an edge hot-zone.
    const edgeVelocity = (y: number, top: number, bottom: number): number => {
      if (y < top + EDGE) return -MAX_SPEED * Math.min(1, (top + EDGE - y) / EDGE);
      if (y > bottom - EDGE) return MAX_SPEED * Math.min(1, (y - (bottom - EDGE)) / EDGE);
      return 0;
    };

    const tick = () => {
      if (!drag.current?.active) { raf.current = null; return; }
      const rect = container.getBoundingClientRect();
      const v = edgeVelocity(pointer.current.y, rect.top, rect.bottom);
      if (v !== 0) {
        const max = container.scrollHeight - container.clientHeight;
        const next = Math.max(0, Math.min(max, container.scrollTop + v));
        if (next !== container.scrollTop) {
          container.scrollTop = next;
          recompute(); // content moved under a still pointer → fold in new blocks
        }
      }
      raf.current = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      const s = drag.current;
      if (!s) return;
      pointer.current = { x: e.clientX, y: e.clientY };
      const a = anchor.current!;
      if (!s.active) {
        const ax = a.x - container.scrollLeft;
        const ay = a.y - container.scrollTop;
        if (Math.hypot(e.clientX - ax, e.clientY - ay) < THRESHOLD) return;
        s.active = true;
        document.body.style.userSelect = 'none';
        if (raf.current == null) raf.current = requestAnimationFrame(tick);
      }
      e.preventDefault();
      recompute();
    };

    const onUp = () => {
      const s = drag.current;
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      drag.current = null;
      anchor.current = null;
      if (raf.current != null) { cancelAnimationFrame(raf.current); raf.current = null; }
      document.body.style.userSelect = '';
      setMarquee(null);
      // Keep the highlight + selectedIds so the group can be deleted / acted on.
      // Hand BlockNote a matching native selection too (best-effort) so its
      // toolbar / group operations line up.
      if (s?.active && selectedIds.current.length) {
        try {
          editor.setSelection(selectedIds.current[0], selectedIds.current[selectedIds.current.length - 1]);
          editor.setForceSelectionVisible?.(true);
        } catch { /* older API — overlay + our own actions still work */ }
      }
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      // Clicks on the floating bar are portalled to <body> (outside `container`),
      // so they never reach this handler — the selection survives while its
      // actions are used. Any click on in-editor text / controls is a fresh
      // interaction and clears the prior marquee selection.
      if (
        t.closest(
          '.bn-inline-content, .bn-side-menu, .bn-button, [data-weft-plus], a, button, input, textarea, select',
        )
      ) {
        clearSelection();
        return;
      }
      clearSelection(); // a fresh interaction drops any prior marquee selection
      anchor.current = { x: e.clientX + container.scrollLeft, y: e.clientY + container.scrollTop };
      pointer.current = { x: e.clientX, y: e.clientY };
      drag.current = { active: false };
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
    };

    const onKey = (e: KeyboardEvent) => {
      if (!selectedIds.current.length) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        e.stopPropagation();
        try {
          const ids = planDeletion(editor.document as Block[], new Set(selectedIds.current));
          if (ids.length) editor.removeBlocks(ids);
        } catch { /* no-op */ }
        clearSelection();
      } else if (e.key === 'Escape') {
        clearSelection();
      }
    };

    const reposition = () => {
      // During an active drag `recompute` owns the highlights (and reads the live
      // scroll offset); skip here to avoid double work / flicker.
      if (drag.current?.active || !selectedIds.current.length) return;
      const byId = new Map(selectableBlocks().map((el) => [el.getAttribute('data-id'), el]));
      const boxes: Box[] = [];
      for (const id of selectedIds.current) {
        const el = byId.get(id);
        if (el) boxes.push(boxOf(el.getBoundingClientRect()));
      }
      setHighlights(boxes);
    };

    container.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    container.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      container.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      container.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      if (raf.current != null) cancelAnimationFrame(raf.current);
      document.body.style.userSelect = '';
    };
  }, [editor]);

  const clear = () => {
    selectedIds.current = [];
    setHighlights([]);
  };

  const duplicate = () => {
    const ids = selectedIds.current;
    if (!ids.length) return;
    try {
      const copies = ids
        .map((id) => editor.getBlock(id))
        .filter(Boolean)
        // Strip ids so BlockNote mints fresh ones instead of colliding.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ id: _omit, ...rest }: { id: string }) => rest);
      if (copies.length) editor.insertBlocks(copies, ids[ids.length - 1], 'after');
    } catch { /* best-effort */ }
    clear();
  };

  const remove = () => {
    try {
      const ids = planDeletion(editor.document as Block[], new Set(selectedIds.current));
      if (ids.length) editor.removeBlocks(ids);
    } catch { /* no-op */ }
    clear();
  };

  // Union of highlight boxes → anchor the floating action bar just below it.
  const union = highlights.length
    ? highlights.reduce(
        (u, h) => ({
          left: Math.min(u.left, h.left),
          top: Math.min(u.top, h.top),
          right: Math.max(u.right, h.left + h.width),
          bottom: Math.max(u.bottom, h.top + h.height),
        }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
      )
    : null;
  const showBar = !marquee && !!union && highlights.length > 0;

  return createPortal(
    <>
      {highlights.map((h, i) => (
        <div
          key={i}
          data-marquee-highlight
          className="pointer-events-none fixed z-[80] rounded-md"
          style={{
            left: h.left,
            top: h.top,
            width: h.width,
            height: h.height,
            // Visible over any block — including charts / tables / images that
            // carry their own busy backgrounds: a clear thread ring plus a light
            // wash, never so faint it disappears on complex content.
            background: 'color-mix(in srgb, var(--thread) 16%, transparent)',
            boxShadow: '0 0 0 2px color-mix(in srgb, var(--thread) 60%, transparent)',
          }}
        />
      ))}
      {marquee && (
        <div
          className="pointer-events-none fixed z-[90] rounded-sm border border-thread bg-thread/10"
          style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}
        />
      )}
      {showBar && union && (
        <div
          data-marquee-bar
          className="fixed z-[95] flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-lg"
          style={{
            left: Math.min(Math.max((union.left + union.right) / 2, 120), window.innerWidth - 120),
            top: Math.min(union.bottom + 8, window.innerHeight - 52),
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className="px-2 text-xs font-medium tabular-nums text-ink-muted">
            {highlights.length} selected
          </span>
          <span className="mx-0.5 h-4 w-px bg-line" />
          <button
            onClick={duplicate}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-muted transition hover:bg-sunk hover:text-ink"
            title="Duplicate blocks"
          >
            <Copy size={13} /> Duplicate
          </button>
          <button
            onClick={remove}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-danger transition hover:bg-danger-soft"
            title="Delete blocks (Del)"
          >
            <Trash2 size={13} /> Delete
          </button>
          <button
            onClick={clear}
            className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition hover:bg-sunk hover:text-ink"
            title="Clear selection (Esc)"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </>,
    document.body,
  );
}

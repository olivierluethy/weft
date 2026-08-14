import { useLayoutEffect, useRef, useState } from 'react';
import { BLOCK_TYPE_DEFS, insertBlockType, type BlockTypeCtx } from './blockTypes';

/** True when the document is effectively blank — nothing, or a single empty
 * paragraph. Used to decide whether to offer the empty-state quick actions. */
export function isBlocksEmpty(blocks: unknown): boolean {
  if (!Array.isArray(blocks) || blocks.length === 0) return true;
  if (blocks.length > 1) return false;
  const b = blocks[0] as { type?: string; content?: unknown[]; children?: unknown[] };
  return (
    b?.type === 'paragraph' &&
    (!b.content || b.content.length === 0) &&
    (!b.children || b.children.length === 0)
  );
}

// A small, curated set — deliberately not the full block menu (that stays behind
// "/"). Ordered write → structure → data so the row reads as a gentle on-ramp.
const QUICK_ACTIONS: { key: string; label: string }[] = [
  { key: 'paragraph', label: 'Text' },
  { key: 'heading_1', label: 'Heading' },
  { key: 'check_list', label: 'To-do' },
  { key: 'quote', label: 'Quote' },
  { key: 'highlight', label: 'Highlight' },
  { key: 'table', label: 'Table' },
  { key: 'columns_2', label: 'Columns' },
  { key: 'db_inline', label: 'Database' },
];

const defByKey = (key: string) => BLOCK_TYPE_DEFS.find((d) => d.key === key);

/**
 * Getting-started affordance shown on an empty, editable page. It is pure editor
 * UI — rendered as a sibling of the ProseMirror root with `contentEditable=false`,
 * so it is never a document block: it can't be typed into, saved, exported, or
 * copied. Each action runs the *real* insert verb from the shared block registry
 * (the same one the "/" menu uses), and the whole affordance disappears the
 * moment the document gains real content (the caller stops rendering it).
 *
 * Positioned just below the first line so it complements — rather than replaces —
 * BlockNote's own inline placeholder and the "/" workflow.
 */
export function EmptyState({
  editor,
  ctx,
  onDismiss,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any;
  ctx: BlockTypeCtx;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  // Anchor beneath the first block so the card tracks the content, not a guess.
  useLayoutEffect(() => {
    const measure = () => {
      const pm: HTMLElement | undefined = editor?._tiptapEditor?.view?.dom;
      const parent = ref.current?.offsetParent as HTMLElement | null;
      const firstBlock = pm?.querySelector('.bn-block-outer');
      if (!parent || !firstBlock) return;
      const fb = firstBlock.getBoundingClientRect();
      const pr = parent.getBoundingClientRect();
      setTop(fb.bottom - pr.top + 10);
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [editor]);

  const pick = async (key: string) => {
    const def = defByKey(key);
    if (!def) return;
    editor.focus();
    try {
      const first = editor.document?.[0];
      if (first?.id) editor.setTextCursorPosition(first.id, 'end');
    } catch {
      /* structure shifted — insert verb still targets the cursor block */
    }
    if (key === 'paragraph') {
      onDismiss(); // "Text" = just start writing on the existing line
      return;
    }
    await insertBlockType(def, ctx);
  };

  return (
    <div
      ref={ref}
      contentEditable={false}
      suppressContentEditableWarning
      style={{ position: 'absolute', top: top ?? 0, left: 0, right: 0, visibility: top === null ? 'hidden' : 'visible' }}
      className="pointer-events-auto select-none animate-[fade_.18s_ease]"
      // Belt-and-braces: never let this UI end up in copied document HTML.
      data-weft-ui="empty-state"
    >
      <div className="max-w-[560px]">
        <p className="mb-2 px-0.5 text-xs font-medium text-ink-faint">
          Start building — pick a block, press <span className="kbd">/</span> for all, or just
          type.
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {QUICK_ACTIONS.map(({ key, label }) => {
            const def = defByKey(key);
            if (!def) return null;
            const Icon = def.Icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => void pick(key)}
                className="group flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-2 text-left text-sm text-ink-muted transition hover:border-line-strong hover:bg-sunk hover:text-ink"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-faint transition group-hover:text-thread">
                  <Icon size={16} />
                </span>
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

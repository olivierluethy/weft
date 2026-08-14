import { createReactBlockSpec } from '@blocknote/react';
import { ChevronRight, Quote as QuoteIcon, RefreshCw, Sparkles, Home } from 'lucide-react';

/** Horizontal divider. */
export const Divider = createReactBlockSpec(
  { type: 'divider', propSchema: {}, content: 'none' },
  {
    render: () => (
      <div className="py-2" contentEditable={false}>
        <hr className="border-0 border-t border-line-strong" />
      </div>
    ),
  },
);

/** Blockquote — editable inline content with a left rule. */
export const Quote = createReactBlockSpec(
  { type: 'quote', propSchema: {}, content: 'inline' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ contentRef }: any) => (
      <blockquote className="my-1 flex gap-2 border-l-[3px] border-thread pl-3 text-ink-muted">
        <span contentEditable={false} className="mt-1 shrink-0"><QuoteIcon size={14} className="text-thread/60" /></span>
        <div ref={contentRef} className="flex-1 italic" />
      </blockquote>
    ),
  },
);

/** Highlight / callout — tinted box with an emoji marker and editable body. */
export const Callout = createReactBlockSpec(
  { type: 'callout', propSchema: { emoji: { default: '💡' } }, content: 'inline' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, contentRef }: any) => (
      <div className="my-1 flex gap-2.5 rounded-md border border-line bg-thread-soft/50 px-3 py-2">
        <span className="select-none text-lg leading-tight" contentEditable={false}>{block.props.emoji}</span>
        <div ref={contentRef} className="flex-1 text-ink" />
      </div>
    ),
  },
);

/** Toggle list / toggle heading. `level` 0 = plain toggle list, 1–3 = toggle heading.
 * Nested blocks live in the tree children and are hidden via CSS when collapsed
 * (see editor.css `.wf-toggle[data-open="false"]`). */
export const Toggle = createReactBlockSpec(
  { type: 'toggle', propSchema: { open: { default: true }, level: { default: 0 } }, content: 'inline' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor, contentRef }: any) => {
      const open = block.props.open as boolean;
      const level = block.props.level as number;
      const sizeCls = level === 1 ? 'text-2xl font-semibold' : level === 2 ? 'text-xl font-semibold' : level === 3 ? 'text-lg font-semibold' : '';
      return (
        <div className="wf-toggle flex items-start gap-1" data-open={open ? 'true' : 'false'}>
          <button
            type="button"
            contentEditable={false}
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => editor.updateBlock(block, { props: { open: !open } })}
            className="mt-0.5 shrink-0 rounded p-0.5 text-ink-faint transition hover:bg-sunk hover:text-ink"
          >
            <ChevronRight size={16} className={open ? 'rotate-90 transition-transform' : 'transition-transform'} />
          </button>
          <div ref={contentRef} className={`flex-1 ${sizeCls}`} />
        </div>
      );
    },
  },
);

/** Table of contents — live list of the document's headings. */
export const TableOfContents = createReactBlockSpec(
  { type: 'tableOfContents', propSchema: {}, content: 'none' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ editor }: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const heads = (editor.document as any[]).filter((b) => b.type === 'heading');
      return (
        <div className="my-1 rounded-md border border-line bg-surface px-3 py-2" contentEditable={false}>
          <div className="mb-1 flex items-center justify-between text-2xs font-semibold uppercase tracking-wide text-ink-faint">
            <span>Table of contents</span>
            <button className="text-ink-faint hover:text-ink" onClick={() => editor.updateBlock(editor.getTextCursorPosition().block, {})} aria-label="Refresh">
              <RefreshCw size={12} />
            </button>
          </div>
          {heads.length === 0 ? (
            <p className="text-xs text-ink-faint">No headings yet.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {heads.map((h) => {
                const text = (h.content ?? []).map((n: { text?: string }) => n.text ?? '').join('') || 'Untitled';
                return (
                  <li key={h.id}>
                    <button
                      className="truncate text-left text-sm text-ink-muted hover:text-thread"
                      style={{ paddingLeft: `${((h.props?.level ?? 1) - 1) * 12}px` }}
                      onClick={() => {
                        document.querySelector(`[data-id="${CSS.escape(h.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      {text}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    },
  },
);

/** Breadcrumb — page path trail. Baseline: derives the current title from the tab. */
export const Breadcrumb = createReactBlockSpec(
  { type: 'breadcrumb', propSchema: {}, content: 'none' },
  {
    render: () => {
      const title = document.title.replace(/\s*[·|–-]\s*Weft.*$/i, '') || 'Current page';
      return (
        <nav className="my-1 flex items-center gap-1 text-sm text-ink-muted" contentEditable={false}>
          <Home size={13} className="text-ink-faint" />
          <ChevronRight size={12} className="text-ink-faint" />
          <span className="text-ink">{title}</span>
        </nav>
      );
    },
  },
);

/** Synced block — bordered container. Baseline: renders content; no cross-page sync. */
export const SyncedBlock = createReactBlockSpec(
  { type: 'syncedBlock', propSchema: {}, content: 'inline' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ contentRef }: any) => (
      <div className="my-1 rounded-md border-l-[3px] border-madder bg-madder-soft/30 px-3 py-2">
        <div className="mb-1 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-madder" contentEditable={false}>
          <RefreshCw size={11} /> Synced
        </div>
        <div ref={contentRef} className="text-ink" />
      </div>
    ),
  },
);

/** Smart Notes — an AI-notes styled container (baseline: editable note area). */
export const SmartNotes = createReactBlockSpec(
  { type: 'smartNotes', propSchema: {}, content: 'inline' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ contentRef }: any) => (
      <div className="my-1 rounded-md border border-line bg-surface px-3 py-2">
        <div className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-thread" contentEditable={false}>
          <Sparkles size={12} /> Smart Notes
        </div>
        <div ref={contentRef} className="text-ink" />
      </div>
    ),
  },
);

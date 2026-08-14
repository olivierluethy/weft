import { createReactBlockSpec } from '@blocknote/react';
import { ChevronRight, RefreshCw, Sparkles, Home } from 'lucide-react';

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

/** Blockquote — a woven thread-rule down the left and a serif italic body.
 * `min-h-[1lh]` keeps the empty editable content one line tall so the caret
 * always has a target on insert (see contentBlocks Bug A note on the toggle). */
export const Quote = createReactBlockSpec(
  { type: 'quote', propSchema: {}, content: 'inline' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ contentRef }: any) => (
      <blockquote className="my-1.5 border-l-[3px] border-thread/70 py-0.5 pl-4">
        <div ref={contentRef} className="min-h-[1lh] text-[1.05em] italic leading-relaxed text-ink-muted" />
      </blockquote>
    ),
  },
);

/** Highlight / callout — a clean, quiet card with an emoji marker and an
 * editable body. Warm neutral surface with a hairline border (STYLEGUIDE §
 * cards/callouts); the emoji sits on the first line of the text. */
export const Callout = createReactBlockSpec(
  { type: 'callout', propSchema: { emoji: { default: '💡' } }, content: 'inline' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, contentRef }: any) => (
      <div className="my-1.5 flex gap-3 rounded-lg border border-line bg-sunk px-4 py-3">
        <span className="select-none text-[1.15em] leading-[1.5]" contentEditable={false}>{block.props.emoji}</span>
        <div ref={contentRef} className="min-h-[1lh] min-w-0 flex-1 leading-relaxed text-ink" />
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
      // Font size lives on the wrapper so the chevron (sized in `em`) scales with
      // the heading level and its top-margin aligns to the first text line.
      return (
        <div className={`wf-toggle my-0.5 flex items-start gap-1.5 ${sizeCls}`} data-open={open ? 'true' : 'false'}>
          <button
            type="button"
            contentEditable={false}
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => editor.updateBlock(block, { props: { open: !open } })}
            className="mt-[0.15em] flex shrink-0 items-center justify-center rounded p-0.5 text-ink-faint transition hover:bg-sunk hover:text-ink"
          >
            <ChevronRight
              className={`h-[0.9em] max-h-6 w-[0.9em] max-w-6 ${open ? 'rotate-90' : ''} transition-transform`}
            />
          </button>
          <div ref={contentRef} className="min-h-[1lh] min-w-0 flex-1" />
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
        <div ref={contentRef} className="min-h-[1lh] text-ink" />
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
        <div ref={contentRef} className="min-h-[1lh] text-ink" />
      </div>
    ),
  },
);

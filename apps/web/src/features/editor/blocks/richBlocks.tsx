import { useState } from 'react';
import { createReactBlockSpec, createReactInlineContentSpec } from '@blocknote/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Link2, MousePointerClick } from 'lucide-react';

// ── KaTeX helpers ────────────────────────────────────────────────────────────
function katexHtml(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex || '', { throwOnError: false, displayMode });
  } catch {
    return latex;
  }
}

/** Block-level equation. Renders real KaTeX; click to edit the LaTeX source. */
export const Equation = createReactBlockSpec(
  { type: 'equation', propSchema: { latex: { default: 'E = mc^2' } }, content: 'none' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor }: any) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [editing, setEditing] = useState(false);
      const latex = block.props.latex as string;
      const commit = (v: string) => editor.updateBlock(block, { props: { latex: v } });
      if (editing && editor.isEditable) {
        return (
          <div className="my-1 rounded-md border border-line bg-sunk p-2">
            <textarea
              autoFocus
              defaultValue={latex}
              onBlur={(e) => { commit(e.target.value); setEditing(false); }}
              className="w-full resize-y bg-transparent font-mono text-sm text-ink outline-none"
              rows={2}
            />
          </div>
        );
      }
      return (
        <div
          onClick={() => editor.isEditable && setEditing(true)}
          className="my-1 cursor-text overflow-x-auto rounded-md px-2 py-1.5 text-center hover:bg-sunk"
          dangerouslySetInnerHTML={{ __html: katexHtml(latex, true) }}
        />
      );
    },
  },
);

/** Inline equation — renders KaTeX inside a line of text. */
export const InlineEquation = createReactInlineContentSpec(
  { type: 'inlineEquation', propSchema: { latex: { default: 'x^2' } }, content: 'none' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ inlineContent }: any) => (
      <span
        contentEditable={false}
        className="mx-0.5 align-middle"
        dangerouslySetInnerHTML={{ __html: katexHtml(inlineContent.props.latex, false) }}
      />
    ),
  },
);

/** Mermaid diagram source. Real baseline: stores + shows the source, syntax-styled.
 * Graphical rendering needs the mermaid runtime (documented partial). */
export const Mermaid = createReactBlockSpec(
  { type: 'mermaid', propSchema: { code: { default: 'graph TD;\n  A-->B;\n  A-->C;' } }, content: 'none' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor }: any) => {
      const code = block.props.code as string;
      return (
        <div className="my-1 overflow-hidden rounded-md border border-line bg-sunk">
          <div className="flex items-center gap-1.5 border-b border-line px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
            Mermaid
          </div>
          <textarea
            defaultValue={code}
            readOnly={!editor.isEditable}
            onBlur={(e) => editor.updateBlock(block, { props: { code: e.target.value } })}
            className="w-full resize-y bg-transparent p-2 font-mono text-xs text-ink outline-none"
            rows={Math.min(10, code.split('\n').length + 1)}
          />
        </div>
      );
    },
  },
);

/** Web bookmark — paste a URL, renders a link card. */
export const Bookmark = createReactBlockSpec(
  { type: 'bookmark', propSchema: { url: { default: '' } }, content: 'none' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor }: any) => {
      const url = block.props.url as string;
      let host = '';
      try { host = url ? new URL(url).host : ''; } catch { host = ''; }
      if (!url && editor.isEditable) {
        return (
          <div className="my-1 flex items-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-2 text-sm text-ink-faint">
            <Link2 size={15} />
            <input
              autoFocus
              placeholder="Paste a link and press Enter…"
              className="flex-1 bg-transparent outline-none placeholder:text-ink-faint"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  editor.updateBlock(block, { props: { url: (e.target as HTMLInputElement).value.trim() } });
                }
              }}
            />
          </div>
        );
      }
      return (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          contentEditable={false}
          className="my-1 flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 no-underline transition hover:bg-sunk"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-sunk">
            {host ? (
              <img
                src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
                alt=""
                className="h-4 w-4"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            ) : (
              <Link2 size={15} className="text-ink-muted" />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-ink">{host || url}</span>
            <span className="truncate text-xs text-ink-faint">{url}</span>
          </span>
        </a>
      );
    },
  },
);

/** Button — a labelled action button. Baseline: edit label + optional link target. */
export const ActionButton = createReactBlockSpec(
  { type: 'weftButton', propSchema: { label: { default: 'Button' }, href: { default: '' } }, content: 'none' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor }: any) => {
      const { label, href } = block.props as { label: string; href: string };
      const click = () => {
        if (href) window.open(href, '_blank', 'noreferrer');
      };
      return (
        <div className="my-1 flex items-center gap-2" contentEditable={false}>
          <button
            type="button"
            onClick={click}
            className="inline-flex items-center gap-1.5 rounded-md bg-thread px-3 py-1.5 text-sm font-medium text-white transition hover:bg-thread-hover"
          >
            <MousePointerClick size={14} />
            {label || 'Button'}
          </button>
          {editor.isEditable && (
            <input
              defaultValue={label}
              onBlur={(e) => editor.updateBlock(block, { props: { label: e.target.value } })}
              className="w-28 rounded border border-line bg-surface px-1.5 py-0.5 text-xs text-ink-muted outline-none"
              placeholder="label"
              aria-label="Button label"
            />
          )}
        </div>
      );
    },
  },
);

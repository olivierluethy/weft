import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Link2, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normaliseUrl } from './selectionModel';

/**
 * Add / edit / remove the link on a text selection.
 *
 * A two-field form rather than a bare prompt, because a link has two halves the
 * writer cares about: where it goes and what it reads as. The address is
 * forgiving — `weft.app`, `hello@weft.app` and `/p/abc` all resolve to something
 * sensible (`normaliseUrl`) so nobody has to type `https://` to be understood.
 *
 * Remove and Open only appear when there is a link to remove or open, so the
 * panel never offers a control that would do nothing (§26).
 */
export function LinkEditor({
  initialUrl,
  initialText,
  onSubmit,
  onRemove,
  onCancel,
}: {
  initialUrl: string;
  initialText: string;
  onSubmit: (url: string, text: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlRef.current?.select();
  }, []);

  const editing = !!initialUrl;
  const valid = url.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    onSubmit(normaliseUrl(url), text);
  };

  return (
    // The command panel draws the surface; this is only its contents.
    <div
      className="w-full"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        }
        if (e.key === 'Escape') onCancel();
      }}
    >
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Link2 size={14} className="shrink-0 text-ink-faint" />
        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">
          {editing ? 'Edit link' : 'Add link'}
        </p>
      </div>

      <div className="flex flex-col gap-2 p-3">
        <label className="flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
            Address
          </span>
          <input
            ref={urlRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="weft.app/docs"
            aria-label="Link address"
            spellCheck={false}
            className="h-8 rounded border border-line-strong bg-surface px-2 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-thread focus-visible:shadow-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-wide text-ink-muted">Text</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Link text"
            aria-label="Link text"
            className="h-8 rounded border border-line-strong bg-surface px-2 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-thread focus-visible:shadow-none"
          />
        </label>

        <div className="mt-1 flex items-center gap-1.5">
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className={cn(
              'h-8 rounded px-3 text-sm font-medium transition',
              valid
                ? 'bg-thread text-white hover:bg-thread-hover'
                : 'cursor-not-allowed bg-sunk text-ink-faint',
            )}
          >
            {editing ? 'Update link' : 'Add link'}
          </button>

          {editing && (
            <>
              <button
                type="button"
                onClick={onRemove}
                title="Remove link"
                aria-label="Remove link"
                className="flex h-8 w-8 items-center justify-center rounded text-ink-muted transition hover:bg-danger-soft hover:text-danger"
              >
                <Unlink size={15} />
              </button>
              <a
                href={normaliseUrl(initialUrl)}
                target="_blank"
                rel="noreferrer"
                title="Open link"
                aria-label="Open link"
                className="flex h-8 w-8 items-center justify-center rounded text-ink-muted transition hover:bg-sunk hover:text-ink"
              >
                <ExternalLink size={15} />
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

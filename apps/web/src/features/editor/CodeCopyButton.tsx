import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Copy-to-clipboard control for BlockNote code blocks.
 *
 * BlockNote's code block has no copy affordance. Rather than fight its NodeView
 * DOM, this mounts a single floating button (portalled to `body`) that anchors to
 * the top-right of whichever code block the pointer is over — the language pill
 * sits top-left, so the two never collide. Clicking copies the block's full text
 * (read from the document model, so multi-line code and hard breaks come through
 * verbatim) and flips to a "Copied" state for ~1.4s, matching Notion's UX. */

const MARGIN = 8;
const COPIED_MS = 1400;

type Anchor = { el: HTMLElement; blockId: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function blockText(editor: any, blockId: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const find = (blocks: any[]): any => {
    for (const b of blocks) {
      if (b.id === blockId) return b;
      if (b.children?.length) {
        const hit = find(b.children);
        if (hit) return hit;
      }
    }
    return undefined;
  };
  const block = find(editor.document);
  if (block && Array.isArray(block.content)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return block.content.map((c: any) => (c.type === 'text' ? c.text : '')).join('');
  }
  return '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CodeCopyButton({ editor }: { editor: any }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const copiedTimer = useRef<number | null>(null);

  // Track the code block under the pointer; keep the button up while the pointer
  // is over the block or the button itself, hide otherwise.
  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      const t = e.target as HTMLElement | null;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (t && btnRef.current?.contains(t)) return; // stay while hovering the button
        const block = t?.closest('[data-content-type="codeBlock"]') as HTMLElement | null;
        const blockId = block?.closest('.bn-block[data-id]')?.getAttribute('data-id') ?? null;
        if (block && blockId) {
          setAnchor((prev) => (prev?.el === block ? prev : { el: block, blockId }));
        } else {
          setAnchor(null);
        }
      });
    };
    document.addEventListener('pointermove', onMove as EventListener, true);
    return () => {
      document.removeEventListener('pointermove', onMove as EventListener, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const compute = useCallback(() => {
    if (!anchor) return;
    const r = anchor.el.getBoundingClientRect();
    const bw = btnRef.current?.offsetWidth ?? 64;
    setCoords({ top: r.top + MARGIN, left: r.right - bw - MARGIN });
  }, [anchor]);

  useLayoutEffect(() => {
    if (!anchor) {
      setCoords(null);
      return;
    }
    setCopied(false);
    compute();
    const raf = requestAnimationFrame(compute);
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [anchor, compute]);

  useEffect(
    () => () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  const onCopy = useCallback(async () => {
    if (!anchor) return;
    const text = blockText(editor, anchor.blockId) || anchor.el.querySelector('code')?.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API blocked (insecure context / permissions): fall back to a
      // temporary textarea + execCommand so copy still works.
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        return; // give up silently rather than throw in an event handler
      }
    }
    setCopied(true);
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  }, [anchor, editor]);

  if (!anchor) return null;

  return createPortal(
    <button
      ref={btnRef}
      type="button"
      onClick={onCopy}
      aria-label={copied ? 'Copied' : 'Copy code'}
      style={{
        position: 'fixed',
        top: coords?.top ?? 0,
        left: coords?.left ?? 0,
        visibility: coords ? 'visible' : 'hidden',
      }}
      className={cn(
        'z-overlay flex items-center gap-1 rounded-md border px-2 py-1 text-2xs font-medium transition-colors',
        copied
          ? 'border-thread/40 bg-surface text-thread'
          : 'border-line bg-surface/80 text-ink-muted hover:border-line-strong hover:bg-surface hover:text-ink',
      )}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>,
    document.body,
  );
}

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Searchable language picker for BlockNote code blocks.
 *
 * BlockNote renders the code block's language control as a native `<select>`.
 * editor.css turns it into a legible pill (Bug C), but a native `<select>`
 * can't filter-as-you-type, and its list of supported languages is long. This
 * component intercepts the pill's click in the capture phase, suppresses the
 * native listbox, and opens a portal popover with a search box instead.
 *
 * It reads the option list straight off the intercepted `<select>`, so it always
 * mirrors BlockNote's exact supported-language set and labels — nothing to keep
 * in sync. The chosen language is written back through the canonical
 * `editor.updateBlock` API, which re-applies Shiki highlighting and persists via
 * the normal autosave/collab path. The `<select>` stays in the DOM as the
 * visible current-language pill; only its dropdown is replaced. */
type Lang = { value: string; label: string };
type OpenState = { blockId: string; select: HTMLSelectElement; options: Lang[]; current: string };

const GAP = 4;
const MARGIN = 8;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CodeLanguagePicker({ editor }: { editor: any }) {
  const [state, setState] = useState<OpenState | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setState(null);
    setCoords(null);
  }, []);

  // Intercept mousedown on a code block's language <select> (capture phase, so we
  // preempt the browser opening the native listbox) and open our popover instead.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const select = target?.closest('select') as HTMLSelectElement | null;
      if (!select || !select.closest('[data-content-type="codeBlock"]')) return;
      const blockId = select.closest('.bn-block[data-id]')?.getAttribute('data-id');
      if (!blockId) return;
      e.preventDefault();
      e.stopPropagation();
      const options: Lang[] = Array.from(select.options).map((o) => ({
        value: o.value,
        label: o.textContent?.trim() || o.value,
      }));
      setQuery('');
      setActive(Math.max(0, options.findIndex((o) => o.value === select.value)));
      setState({ blockId, select, options, current: select.value });
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, []);

  const filtered = useMemo(() => {
    if (!state) return [];
    const q = query.trim().toLowerCase();
    if (!q) return state.options;
    return state.options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [state, query]);

  useEffect(() => setActive(0), [query]);

  const pick = useCallback(
    (lang: Lang | undefined) => {
      if (!lang || !state) return;
      try {
        editor.updateBlock(state.blockId, { props: { language: lang.value } });
      } catch {
        /* block was removed while the popover was open */
      }
      close();
    },
    [editor, state, close],
  );

  // Anchor the popover under the pill and keep it there while the page scrolls.
  const compute = useCallback(() => {
    if (!state) return;
    const r = state.select.getBoundingClientRect();
    const panel = panelRef.current;
    const pw = panel?.offsetWidth ?? 224;
    const ph = panel?.offsetHeight ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = r.bottom + GAP;
    if (ph && top + ph > vh - MARGIN && r.top - GAP - ph > MARGIN) top = r.top - GAP - ph;
    if (ph) top = Math.max(MARGIN, Math.min(top, vh - ph - MARGIN));
    let left = r.left;
    if (pw) left = Math.max(MARGIN, Math.min(left, vw - pw - MARGIN));
    setCoords({ top, left });
  }, [state]);

  useLayoutEffect(() => {
    if (!state) return;
    compute();
    const raf = requestAnimationFrame(compute);
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [state, compute]);

  useEffect(() => {
    if (state) inputRef.current?.focus();
  }, [state]);

  // Outside click + Escape close. Clicks on a code-block select are owned by the
  // capture handler above, so ignore them here to avoid a close/reopen race.
  useEffect(() => {
    if (!state) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (panelRef.current?.contains(t)) return;
      if (t.closest?.('[data-content-type="codeBlock"] select')) return;
      close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [state, close]);

  // Keep the active option scrolled into view during keyboard navigation.
  useEffect(() => {
    if (!state) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, state]);

  if (!state) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(filtered[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      style={{
        position: 'fixed',
        top: coords?.top ?? 0,
        left: coords?.left ?? 0,
        visibility: coords ? 'visible' : 'hidden',
      }}
      className="z-[100] flex max-h-[min(320px,60vh)] w-56 flex-col overflow-hidden rounded-md border border-line bg-surface shadow-md animate-[fade_.12s_ease]"
    >
      <div className="flex items-center gap-1.5 border-b border-line px-2 py-1.5">
        <Search size={13} className="shrink-0 text-ink-faint" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search language…"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-ink-faint">No matching language</p>
        ) : (
          filtered.map((o, i) => (
            <button
              key={o.value}
              type="button"
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm transition',
                i === active ? 'bg-thread-soft text-thread' : 'text-ink hover:bg-sunk',
              )}
            >
              <span className="truncate">{o.label}</span>
              {o.value === state.current && <Check size={14} className="shrink-0 text-thread" />}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}

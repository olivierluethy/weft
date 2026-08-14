import { useMemo, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fuzzyFilter, fuzzyScoreMany } from '@/lib/fuzzy';
import { PAGE_FONTS, pageFont, pageFontsByGroup, type PageFontDef } from './pageFonts';

/**
 * The font picker, used at both scales: the Font sub-view of the page options
 * panel (§6.7, the only place the *page* face can be changed) and the formatting
 * toolbar's per-selection font mark (§3.4, with `clearable` for its extra
 * "Default" state). One list means the same 21 faces, the same search and the
 * same specimens whichever scale you are working at.
 *
 * Every face renders **in itself**: the specimen, the name and the group line
 * all use the font they offer, which is the only honest way to choose type.
 * With 21 faces the list needs a filter, so it carries the shared fuzzy search
 * (`lib/fuzzy.ts`) over name, group and keywords — "geometric", "code" and
 * "mono" all find something sensible.
 *
 * Picking a face **does not close anything**. That is the whole point: you try
 * Lora, look at the page, try Poppins, look again. The caller decides when the
 * surface goes away.
 */
export function FontList({
  value,
  editable,
  onPick,
  autoFocus = true,
  clearable = false,
  clearLabel = 'Default',
  clearHint = 'Follow the page font',
  className,
}: {
  value: string | null | undefined;
  editable: boolean;
  /** Called with a font key, or `''` when the (optional) clear row is picked. */
  onPick: (key: string) => void;
  autoFocus?: boolean;
  /**
   * Adds a "Default" row that clears the value instead of setting a face. Used
   * by the inline mark (§3.4), where "no face" is a real, meaningful choice —
   * the text falls back to whatever the page is set to. The page-level picker
   * has no such state: a page always has a face.
   */
  clearable?: boolean;
  clearLabel?: string;
  clearHint?: string;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  // With a clear row, an empty value means "Default" and must not resolve to
  // the page default face — that would tick the wrong row.
  const active = clearable && !value ? '' : pageFont(value).key;

  const groups = useMemo(() => {
    const matches = fuzzyFilter<PageFontDef>(PAGE_FONTS, query, (f) => [
      f.label,
      f.group,
      f.desc,
      ...(f.keywords ?? []),
    ]);
    // Grouping is dropped while searching: a relevance-ordered list is the
    // point of searching, and re-grouping would scatter the best matches.
    return query.trim() ? [{ group: null, fonts: matches }] : pageFontsByGroup(matches);
  }, [query]);

  const showClear =
    clearable &&
    (!query.trim() ||
      fuzzyScoreMany(query, [clearLabel, 'default', 'page font', 'none', 'clear', 'reset']) !== null);

  const total = groups.reduce((n, g) => n + g.fonts.length, 0) + (showClear ? 1 : 0);

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 focus-within:border-thread/30">
        <Search size={14} className="shrink-0 text-ink-faint" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search fonts…"
          aria-label="Search fonts"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:shadow-none"
        />
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {total === 0 && (
          <p className="px-2 py-6 text-center text-sm text-ink-faint">No font matches.</p>
        )}

        {showClear && (
          <button
            type="button"
            data-panel-row
            data-font-key=""
            role="radio"
            aria-checked={active === ''}
            disabled={!editable}
            onClick={() => onPick('')}
            className={cn(
              'mb-1 flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition',
              'disabled:cursor-not-allowed disabled:opacity-60',
              active === '' ? 'bg-thread-soft' : 'hover:bg-sunk',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed text-lg leading-none',
                active === ''
                  ? 'border-thread/40 bg-surface text-thread'
                  : 'border-line-strong bg-paper text-ink-faint',
              )}
            >
              Ag
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span
                className={cn(
                  'truncate text-sm font-semibold',
                  active === '' ? 'text-thread' : 'text-ink',
                )}
              >
                {clearLabel}
              </span>
              <span className="truncate text-2xs text-ink-faint">{clearHint}</span>
            </span>
            {active === '' && <Check size={16} className="shrink-0 text-thread" />}
          </button>
        )}

        {groups.map((g) => (
          <div key={g.group ?? 'results'} className="mb-1 last:mb-0">
            {g.group && (
              <p className="px-2 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                {g.group}
              </p>
            )}
            {g.fonts.map((font) => {
              const isActive = font.key === active;
              return (
                <button
                  key={font.key}
                  type="button"
                  data-panel-row
                  data-font-key={font.key}
                  role="radio"
                  aria-checked={isActive}
                  disabled={!editable}
                  onClick={() => onPick(font.key)}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    isActive ? 'bg-thread-soft' : 'hover:bg-sunk',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-lg leading-none',
                      isActive
                        ? 'border-thread/40 bg-surface text-thread'
                        : 'border-line-strong bg-paper text-ink',
                    )}
                    style={{ fontFamily: font.stack }}
                  >
                    Ag
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        'truncate text-sm font-semibold',
                        isActive ? 'text-thread' : 'text-ink',
                      )}
                      style={{ fontFamily: font.stack }}
                    >
                      {font.label}
                    </span>
                    <span className="truncate text-2xs text-ink-faint">{font.desc}</span>
                  </span>
                  {isActive && <Check size={16} className="shrink-0 text-thread" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

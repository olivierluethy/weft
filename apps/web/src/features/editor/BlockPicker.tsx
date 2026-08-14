import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fuzzyFilter } from '@/lib/fuzzy';
import { getRecommendedKeys } from '@/lib/blockUsage';
import { BLOCK_TYPE_DEFS, matchesBlock, type BlockTypeDef } from './blockTypes';

/**
 * The block chooser shared by the "+" add-block menu and the six-dots "Turn into"
 * submenu. One surface, one search engine, one keyboard model — so the two never
 * drift and a person learns the interaction once.
 *
 * - **Search** is fuzzy and typo-tolerant (`lib/fuzzy.ts`), matching a block's
 *   title and its aliases; results are relevance-ranked. A blank query shows the
 *   full, grouped registry.
 * - **Recommended** (add-block only) surfaces the blocks this person actually
 *   creates most (`lib/blockUsage.ts`) — a short row that never dominates, and is
 *   hidden while searching or until there's real usage to show.
 * - **Keyboard**: ↑/↓ move, Enter picks, Home/End jump, Escape closes (handled by
 *   the Popover). The search field holds focus throughout.
 *
 * It renders only the panel body; positioning, portalling and dismissal come from
 * the `Popover` it's placed inside.
 */
export function BlockPicker({
  onPick,
  defs = BLOCK_TYPE_DEFS,
  activeBlock,
  showRecommended = false,
  title,
  hint,
  placeholder = 'Search blocks…',
}: {
  onPick: (def: BlockTypeDef) => void;
  defs?: BlockTypeDef[];
  /** When set, the block currently matching a def gets an active check (turn-into). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeBlock?: any;
  showRecommended?: boolean;
  title?: string;
  hint?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Sections rendered top-to-bottom. Each section carries its defs; a single flat
  // list of defs (in render order) drives keyboard selection so the index always
  // lines up with what's on screen.
  const sections = useMemo(() => {
    const q = query.trim();
    if (q) {
      const ranked = fuzzyFilter(defs, q, (d) => [d.title, ...d.aliases]);
      return ranked.length ? [{ name: '', defs: ranked }] : [];
    }
    const out: { name: string; defs: BlockTypeDef[] }[] = [];
    if (showRecommended) {
      const available = new Set(defs.map((d) => d.key));
      const recKeys = getRecommendedKeys(available);
      const recDefs = recKeys
        .map((k) => defs.find((d) => d.key === k))
        .filter((d): d is BlockTypeDef => !!d);
      if (recDefs.length) out.push({ name: 'Recommended', defs: recDefs });
    }
    // All blocks, grouped in registry order.
    const groups: { name: string; defs: BlockTypeDef[] }[] = [];
    for (const def of defs) {
      let g = groups.find((x) => x.name === def.group);
      if (!g) {
        g = { name: def.group, defs: [] };
        groups.push(g);
      }
      g.defs.push(def);
    }
    return [...out, ...groups];
  }, [defs, query, showRecommended]);

  const flatDefs = useMemo(() => sections.flatMap((s) => s.defs), [sections]);

  // Reset the highlight to the top whenever the visible set changes.
  useEffect(() => {
    setSelected(0);
  }, [query]);

  // Keep the highlighted row in view within the scroll area.
  useEffect(() => {
    rowRefs.current[selected]?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const pickAt = (i: number) => {
    const def = flatDefs[i];
    if (def) onPick(def);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, flatDefs.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelected(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSelected(flatDefs.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pickAt(selected);
    }
    // Escape bubbles to the Popover's dismiss handler.
  };

  let flatIndex = -1; // running index across sections, aligned with flatDefs

  return (
    <div className="flex max-h-[min(420px,74vh)] w-72 flex-col overflow-hidden rounded-md border border-line bg-surface shadow-md">
      {(title || hint) && (
        <div className="border-b border-line px-3 pb-2 pt-2.5">
          {title && (
            <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
          )}
          {hint && <p className="mt-1 text-2xs leading-snug text-ink-faint">{hint}</p>}
        </div>
      )}

      {/* Search field — the whole row lifts on focus (§6 palette focus language). */}
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 focus-within:border-thread/30">
        <Search size={14} className="shrink-0 text-ink-faint" />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:shadow-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-1" role="listbox">
        {flatDefs.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-faint">No blocks match “{query.trim()}”.</p>
        ) : (
          sections.map((section) => (
            <div key={section.name || 'results'}>
              {section.name && (
                <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                  {section.name}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {section.defs.map((def) => {
                  flatIndex += 1;
                  const i = flatIndex;
                  const Icon = def.Icon;
                  const active = activeBlock ? matchesBlock(def, activeBlock) : false;
                  const highlighted = i === selected;
                  return (
                    <button
                      key={`${section.name}:${def.key}`}
                      ref={(el) => (rowRefs.current[i] = el)}
                      role="option"
                      aria-selected={highlighted}
                      data-block-key={def.key}
                      onMouseEnter={() => setSelected(i)}
                      onMouseDown={(e) => {
                        // Keep the editor selection while we insert/convert.
                        e.preventDefault();
                        onPick(def);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition',
                        highlighted ? 'bg-thread-soft' : 'hover:bg-sunk',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                          active || highlighted
                            ? 'border-thread/40 bg-surface text-thread'
                            : 'border-line-strong bg-paper text-ink-muted',
                        )}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span
                          className={cn(
                            'truncate text-sm font-medium',
                            highlighted ? 'text-thread' : 'text-ink',
                          )}
                        >
                          {def.title}
                        </span>
                        <span className="truncate text-2xs text-ink-faint">{def.subtext}</span>
                      </span>
                      {active && <Check size={15} className="shrink-0 text-thread" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

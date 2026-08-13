import { useEffect, useRef } from 'react';
import type { DefaultReactSuggestionItem, SuggestionMenuProps } from '@blocknote/react';
import { cn } from '@/lib/utils';

/** Weft slash menu.
 *
 * BlockNote positions this element (flip + shift + size middleware), so it opens
 * upward when there isn't room below. On top of that we give it a hard
 * `max-height` and an internal scroll area, so every category (Headings, Basic
 * blocks, Advanced, Media…) stays reachable no matter where the cursor sits —
 * including the very bottom of the page. Styling follows docs/STYLEGUIDE.md §6
 * (menus / popovers). */
export function SlashMenu({
  items,
  selectedIndex,
  onItemClick,
}: SuggestionMenuProps<DefaultReactSuggestionItem>) {
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep the keyboard-selected row scrolled into view within our scroll area.
  useEffect(() => {
    if (selectedIndex == null) return;
    rowRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-md border border-line bg-surface p-3 text-sm text-ink-faint shadow-md">
        No matching blocks
      </div>
    );
  }

  // Preserve BlockNote's item order while grouping by category, so the flat
  // `selectedIndex` still lines up with the rendered rows.
  const groups: { name: string; entries: { item: DefaultReactSuggestionItem; index: number }[] }[] = [];
  items.forEach((item, index) => {
    const name = item.group ?? '';
    let group = groups.find((g) => g.name === name);
    if (!group) {
      group = { name, entries: [] };
      groups.push(group);
    }
    group.entries.push({ item, index });
  });

  return (
    <div
      className="flex max-h-[min(360px,70vh)] w-72 flex-col overflow-y-auto overscroll-contain rounded-md border border-line bg-surface p-1 shadow-md"
      role="listbox"
    >
      {groups.map((group) => (
        <div key={group.name || 'ungrouped'}>
          {group.name && (
            <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
              {group.name}
            </p>
          )}
          {group.entries.map(({ item, index }) => {
            const active = index === selectedIndex;
            return (
              <button
                key={index}
                ref={(el) => (rowRefs.current[index] = el)}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  // Prevent the editor from losing selection before the insert.
                  e.preventDefault();
                  onItemClick?.(item);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition',
                  active ? 'bg-thread-soft text-thread' : 'text-ink hover:bg-sunk',
                )}
              >
                {item.icon && (
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center',
                      active ? 'text-thread' : 'text-ink-muted',
                    )}
                  >
                    {item.icon}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{item.title}</span>
                  {item.subtext && (
                    <span className="truncate text-xs text-ink-faint">{item.subtext}</span>
                  )}
                </span>
                {item.badge && <span className="kbd shrink-0">{item.badge}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

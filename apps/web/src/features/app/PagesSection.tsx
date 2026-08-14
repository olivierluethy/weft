import { useState } from 'react';
import { ChevronRight, Plus, MoreHorizontal, ArrowDownUp, Check } from 'lucide-react';
import type { PageTreeNode } from '@weft/shared';
import { cn } from '@/lib/utils';
import { Menu } from '@/components/ui/Menu';
import { Tooltip } from '@/components/ui/Tooltip';
import { PageTree, type SortMode } from './PageTree';
import { useCreatePage } from './useCreatePage';

const SORT_LABEL: Record<SortMode, string> = {
  manual: 'Manual',
  title: 'Title (A–Z)',
  edited: 'Last edited',
};

/** The "Pages" navigation group: a hover-revealed control cluster (new
 * top-level page, sort, collapse) over the page tree. Collapse and sort mode
 * persist locally so the navigation feels like a stable workspace surface. */
export function PagesSection({
  nodes,
  onOpenPeek,
}: {
  nodes: PageTreeNode[];
  onOpenPeek?: (pageId: string) => void;
}) {
  const createPage = useCreatePage();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('weft-pages-collapsed') === '1',
  );
  const [sortMode, setSortMode] = useState<SortMode>(
    () => (localStorage.getItem('weft-pages-sort') as SortMode) || 'manual',
  );

  const setCollapsedPersist = (v: boolean) => {
    setCollapsed(v);
    localStorage.setItem('weft-pages-collapsed', v ? '1' : '0');
  };
  const setSortPersist = (v: SortMode) => {
    setSortMode(v);
    localStorage.setItem('weft-pages-sort', v);
  };

  return (
    <div className="mt-1">
      <div className="group/section flex items-center rounded pr-0.5">
        <button
          onClick={() => setCollapsedPersist(!collapsed)}
          className="flex min-w-0 flex-1 items-center gap-1 rounded px-2 py-1.5 text-left text-2xs font-semibold uppercase tracking-wide text-ink-faint transition hover:text-ink-muted"
          aria-expanded={!collapsed}
        >
          <ChevronRight
            size={12}
            className={cn(
              'shrink-0 transition-transform duration-150',
              !collapsed && 'rotate-90',
            )}
          />
          <span className="truncate">Pages</span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
          <Menu
            align="end"
            trigger={
              <button
                aria-label="Sort and manage pages"
                className="flex h-6 w-6 items-center justify-center rounded text-ink-faint transition hover:bg-surface hover:text-ink"
              >
                <MoreHorizontal size={15} />
              </button>
            }
            items={[
              { label: 'Sort', divider: false, disabled: true, icon: <ArrowDownUp size={14} /> },
              ...(Object.keys(SORT_LABEL) as SortMode[]).map((m) => ({
                label: SORT_LABEL[m],
                icon:
                  sortMode === m ? (
                    <Check size={14} className="text-thread" />
                  ) : (
                    <span className="inline-block h-3.5 w-3.5" />
                  ),
                onClick: () => setSortPersist(m),
              })),
              { divider: true, label: '' },
              {
                label: collapsed ? 'Expand section' : 'Collapse section',
                icon: <ChevronRight size={14} className={collapsed ? '' : 'rotate-90'} />,
                onClick: () => setCollapsedPersist(!collapsed),
              },
            ]}
          />
          <Tooltip label="New page">
            <button
              onClick={() => void createPage()}
              aria-label="New top-level page"
              className="flex h-6 w-6 items-center justify-center rounded text-ink-faint transition hover:bg-surface hover:text-ink"
            >
              <Plus size={15} />
            </button>
          </Tooltip>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-0.5">
          <PageTree nodes={nodes} sortMode={sortMode} onOpenPeek={onOpenPeek} />
        </div>
      )}
    </div>
  );
}

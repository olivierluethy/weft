import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Clock,
  Star,
  LayoutTemplate,
  ArrowUpDown,
  CalendarRange,
  Activity as ActivityIcon,
} from 'lucide-react';
import {
  formatDistanceToNow,
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import type { WorkspaceOverviewPage } from '@weft/shared';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from './workspace';
import { useWorkspaceOverview } from '@/lib/queries';
import { Logo } from '@/components/Logo';
import { Popover } from '@/components/ui/Popover';
import { Menu } from '@/components/ui/Menu';
import { PageIcon } from '@/features/editor/pickers/IconPicker';
import { TemplatePicker } from './TemplatePicker';
import { useCreatePage } from './useCreatePage';
import { cn } from '@/lib/utils';

type SortKey =
  | 'edited-desc'
  | 'edited-asc'
  | 'created-desc'
  | 'created-asc'
  | 'name'
  | 'size';

type DateKey = 'all' | 'today' | 'week' | 'month' | 'year';

const SORT_LABELS: Record<SortKey, string> = {
  'edited-desc': 'Last edited',
  'edited-asc': 'Oldest edited',
  'created-desc': 'Newest created',
  'created-asc': 'Oldest created',
  name: 'Name',
  size: 'Size',
};

const DATE_LABELS: Record<DateKey, string> = {
  all: 'Any time',
  today: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
};

/** Which timestamp the date filter and its label refer to, derived from the
 * active sort so "Created + This week" reads as "created this week" and
 * "Last edited + This year" as "edited this year". */
function dateBasis(sort: SortKey): 'created' | 'edited' {
  return sort === 'created-desc' || sort === 'created-asc' ? 'created' : 'edited';
}

function rangeStart(key: DateKey): number | null {
  const now = new Date();
  switch (key) {
    case 'today':
      return startOfDay(now).getTime();
    case 'week':
      return startOfWeek(now, { weekStartsOn: 1 }).getTime();
    case 'month':
      return startOfMonth(now).getTime();
    case 'year':
      return startOfYear(now).getTime();
    default:
      return null;
  }
}

export function HomeView() {
  const { user, workspaces } = useAuth();
  const { workspaceId } = useWorkspace();
  const { data: pages, isLoading } = useWorkspaceOverview(workspaceId);
  const navigate = useNavigate();
  const createPage = useCreatePage();
  const ws = workspaces.find((w) => w.id === workspaceId);

  const [sort, setSort] = useState<SortKey>(
    () => (localStorage.getItem('weft-overview-sort') as SortKey) || 'edited-desc',
  );
  const [dateFilter, setDateFilter] = useState<DateKey>(
    () => (localStorage.getItem('weft-overview-date') as DateKey) || 'all',
  );
  const setSortPersist = (s: SortKey) => {
    setSort(s);
    localStorage.setItem('weft-overview-sort', s);
  };
  const setDatePersist = (d: DateKey) => {
    setDateFilter(d);
    localStorage.setItem('weft-overview-date', d);
  };

  const basis = dateBasis(sort);

  const visible = useMemo(() => {
    const all = pages ?? [];
    const since = rangeStart(dateFilter);
    const filtered =
      since == null
        ? all
        : all.filter((p) => {
            const t = new Date(basis === 'created' ? p.createdAt : p.updatedAt).getTime();
            return t >= since;
          });
    const cmp: Record<SortKey, (a: WorkspaceOverviewPage, b: WorkspaceOverviewPage) => number> = {
      'edited-desc': (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
      'edited-asc': (a, b) => +new Date(a.updatedAt) - +new Date(b.updatedAt),
      'created-desc': (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      'created-asc': (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
      name: (a, b) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled'),
      size: (a, b) => b.wordCount - a.wordCount,
    };
    return [...filtered].sort(cmp[sort]);
  }, [pages, sort, dateFilter, basis]);

  const favorites = (pages ?? []).filter((p) => p.isFavorite).slice(0, 6);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-14 sm:px-8">
        {/* Greeting + activity entry point */}
        <div className="mb-10 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
                {greeting}, {user?.name.split(' ')[0]}
              </h1>
              <p className="text-sm text-ink-muted">{ws?.name}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/activity')}
            className="btn btn-secondary h-auto shrink-0 px-3 py-2"
            title="See everything you've changed, over time"
          >
            <ActivityIcon size={16} /> <span className="hidden sm:inline">View activity</span>
          </button>
        </div>

        <div className="mb-10 flex gap-2">
          <button
            onClick={() => void createPage()}
            className="flex flex-1 items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-3 text-left text-sm text-ink-muted transition hover:border-thread hover:text-thread"
          >
            <Plus size={18} /> Create a new page
          </button>
          <Popover
            align="end"
            trigger={
              <button className="btn btn-secondary h-auto px-3">
                <LayoutTemplate size={16} /> Templates
              </button>
            }
          >
            {(close) => (
              <TemplatePicker
                workspaceId={workspaceId ?? ''}
                onPick={(id) => {
                  void createPage({ templateId: id });
                  close();
                }}
              />
            )}
          </Popover>
        </div>

        {favorites.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
              <Star size={15} className="fill-madder text-madder" /> Favorites
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {favorites.map((p) => (
                <FavoriteCard key={p.id} p={p} onClick={() => navigate(`/p/${p.id}`)} />
              ))}
            </div>
          </section>
        )}

        {/* All pages, with metadata + sort/filter */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
              <Clock size={15} /> All pages
              {pages && (
                <span className="rounded-full bg-sunk px-1.5 py-0.5 text-2xs font-medium text-ink-faint">
                  {visible.length}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1.5">
              <Menu
                align="end"
                trigger={
                  <button className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-muted transition hover:bg-sunk hover:text-ink">
                    <ArrowUpDown size={13} /> {SORT_LABELS[sort]}
                  </button>
                }
                items={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
                  label: SORT_LABELS[k],
                  checked: sort === k,
                  onClick: () => setSortPersist(k),
                }))}
              />
              <Menu
                align="end"
                trigger={
                  <button
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition hover:bg-sunk hover:text-ink',
                      dateFilter === 'all'
                        ? 'border-line text-ink-muted'
                        : 'border-thread/40 bg-thread-soft text-thread',
                    )}
                  >
                    <CalendarRange size={13} />
                    {dateFilter === 'all'
                      ? 'Any time'
                      : `${basis === 'created' ? 'Created' : 'Edited'}: ${DATE_LABELS[dateFilter]}`}
                  </button>
                }
                items={(Object.keys(DATE_LABELS) as DateKey[]).map((k) => ({
                  label: DATE_LABELS[k],
                  checked: dateFilter === k,
                  onClick: () => setDatePersist(k),
                }))}
              />
            </div>
          </div>

          {/* Column headers (sm+) */}
          <div className="mb-1 hidden items-center gap-3 px-4 text-2xs font-medium uppercase tracking-wide text-ink-faint sm:flex">
            <span className="flex-1">Page</span>
            <span className="w-20 text-right">Size</span>
            <span className="w-28 text-right">Created</span>
            <span className="w-28 text-right">Last edited</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {isLoading ? (
              <p className="px-4 py-6 text-sm text-ink-faint">Loading pages…</p>
            ) : visible.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-faint">
                {(pages ?? []).length === 0
                  ? 'No pages yet — create your first one above.'
                  : 'No pages match this filter.'}
              </p>
            ) : (
              visible.map((p) => (
                <PageRow key={p.id} p={p} onClick={() => navigate(`/p/${p.id}`)} />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function pageGlyph(p: WorkspaceOverviewPage, size: number) {
  return p.icon ? (
    <PageIcon icon={p.icon} size={size} />
  ) : (
    <FileText size={size} className="text-ink-faint" />
  );
}

function sizeLabel(words: number): string {
  if (words === 0) return 'Empty';
  return `${words.toLocaleString()} word${words === 1 ? '' : 's'}`;
}

function FavoriteCard({ p, onClick }: { p: WorkspaceOverviewPage; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card flex flex-col gap-2 p-3.5 text-left transition hover:-translate-y-px hover:shadow-md"
    >
      <span className="text-xl">{pageGlyph(p, 20)}</span>
      <span className="truncate text-sm font-medium text-ink">{p.title || 'Untitled'}</span>
      <span className="text-xs text-ink-faint">
        Edited {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
      </span>
    </button>
  );
}

function PageRow({ p, onClick }: { p: WorkspaceOverviewPage; onClick: () => void }) {
  const created = format(new Date(p.createdAt), 'MMM d, yyyy');
  const editedRel = formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true });
  const editedAbs = format(new Date(p.updatedAt), "MMM d, yyyy · HH:mm");
  return (
    <button
      onClick={onClick}
      className="card group flex items-center gap-3 px-4 py-2.5 text-left transition hover:border-line-strong hover:shadow-sm"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base">
        {pageGlyph(p, 18)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink group-hover:text-thread">
          {p.title || 'Untitled'}
        </div>
        {/* Compact metadata line for narrow viewports */}
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-2xs text-ink-faint sm:hidden">
          <span>{sizeLabel(p.wordCount)}</span>
          <span>Created {created}</span>
          <span>Edited {editedRel}</span>
        </div>
      </div>
      <span className="hidden w-20 shrink-0 text-right text-xs tabular-nums text-ink-muted sm:block">
        {sizeLabel(p.wordCount)}
      </span>
      <span className="hidden w-28 shrink-0 text-right text-xs text-ink-muted sm:block">
        {created}
      </span>
      <span
        className="hidden w-28 shrink-0 text-right text-xs text-ink-muted sm:block"
        title={editedAbs}
      >
        {editedRel}
      </span>
    </button>
  );
}

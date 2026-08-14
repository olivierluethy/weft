import { useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { Table2, Kanban, LayoutGrid, List, Rss, LayoutDashboard, Calendar, GanttChart, Map, Database as DbIcon } from 'lucide-react';

// Shared sample rows so every database view shows real, consistent content.
const ROWS = [
  { name: 'Draft proposal', status: 'In progress', tag: 'Docs', date: 'Aug 12' },
  { name: 'Ship v1', status: 'Todo', tag: 'Release', date: 'Aug 20' },
  { name: 'User interviews', status: 'Done', tag: 'Research', date: 'Aug 08' },
  { name: 'Design review', status: 'In progress', tag: 'Design', date: 'Aug 15' },
];
const STATUS_COLORS: Record<string, string> = {
  Todo: 'bg-sunk text-ink-muted',
  'In progress': 'bg-thread-soft text-thread',
  Done: 'bg-ok-soft text-ok',
};

const VIEW_META: Record<string, { icon: typeof Table2; label: string }> = {
  table: { icon: Table2, label: 'Table view' },
  board: { icon: Kanban, label: 'Board view' },
  gallery: { icon: LayoutGrid, label: 'Gallery view' },
  list: { icon: List, label: 'List view' },
  feed: { icon: Rss, label: 'Feed view' },
  dashboard: { icon: LayoutDashboard, label: 'Dashboard view' },
  calendar: { icon: Calendar, label: 'Calendar view' },
  timeline: { icon: GanttChart, label: 'Timeline view' },
  map: { icon: Map, label: 'Map view' },
};

function Pill({ s }: { s: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-2xs font-medium ${STATUS_COLORS[s] ?? 'bg-sunk text-ink-muted'}`}>{s}</span>;
}

function ViewBody({ view }: { view: string }) {
  switch (view) {
    case 'board':
      return (
        <div className="flex gap-2 overflow-x-auto">
          {['Todo', 'In progress', 'Done'].map((col) => (
            <div key={col} className="w-40 shrink-0 rounded-md bg-sunk/60 p-1.5">
              <div className="mb-1 px-1 text-2xs font-semibold uppercase text-ink-faint">{col}</div>
              {ROWS.filter((r) => r.status === col).map((r) => (
                <div key={r.name} className="mb-1 rounded border border-line bg-surface px-2 py-1 text-xs text-ink">{r.name}</div>
              ))}
            </div>
          ))}
        </div>
      );
    case 'gallery':
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ROWS.map((r) => (
            <div key={r.name} className="rounded-md border border-line bg-surface p-2">
              <div className="mb-2 h-12 rounded bg-sunk" />
              <div className="truncate text-xs font-medium text-ink">{r.name}</div>
              <div className="mt-1"><Pill s={r.status} /></div>
            </div>
          ))}
        </div>
      );
    case 'list':
      return (
        <ul className="flex flex-col divide-y divide-line">
          {ROWS.map((r) => (
            <li key={r.name} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-ink">{r.name}</span>
              <Pill s={r.status} />
            </li>
          ))}
        </ul>
      );
    case 'feed':
      return (
        <div className="flex flex-col gap-2">
          {ROWS.map((r) => (
            <div key={r.name} className="rounded-md border border-line bg-surface p-2.5">
              <div className="text-sm font-medium text-ink">{r.name}</div>
              <div className="mt-0.5 flex items-center gap-2 text-2xs text-ink-faint"><Pill s={r.status} /><span>{r.date}</span></div>
            </div>
          ))}
        </div>
      );
    case 'dashboard':
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[['Total', ROWS.length], ['Done', ROWS.filter((r) => r.status === 'Done').length], ['Active', ROWS.filter((r) => r.status === 'In progress').length], ['Todo', ROWS.filter((r) => r.status === 'Todo').length]].map(([k, v]) => (
            <div key={k as string} className="rounded-md border border-line bg-surface p-2 text-center">
              <div className="text-2xl font-semibold text-ink">{v as number}</div>
              <div className="text-2xs uppercase text-ink-faint">{k as string}</div>
            </div>
          ))}
        </div>
      );
    case 'calendar': {
      const days = Array.from({ length: 28 }, (_, i) => i + 1);
      const marks: Record<number, string> = { 8: 'Done', 12: 'In progress', 15: 'In progress', 20: 'Todo' };
      return (
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => (
            <div key={d} className="aspect-square rounded border border-line p-1 text-2xs text-ink-faint">
              {d}
              {marks[d] && <div className="mt-0.5 h-1 rounded" style={{ background: 'var(--thread)' }} />}
            </div>
          ))}
        </div>
      );
    }
    case 'timeline':
      return (
        <div className="flex flex-col gap-1.5">
          {ROWS.map((r, i) => (
            <div key={r.name} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs text-ink-muted">{r.name}</span>
              <div className="h-3 rounded bg-thread" style={{ marginLeft: `${i * 18}px`, width: `${60 + i * 10}px` }} />
            </div>
          ))}
        </div>
      );
    case 'map':
      return (
        <div className="relative h-40 overflow-hidden rounded-md bg-sunk">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          {[[30, 40], [55, 25], [70, 60], [45, 70]].map((p, i) => (
            <span key={i} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-full rounded-full border-2 border-white bg-madder" style={{ left: `${p[0]}%`, top: `${p[1]}%` }} />
          ))}
        </div>
      );
    case 'table':
    default:
      return (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-2xs uppercase text-ink-faint">
              <th className="border-b border-line px-2 py-1 font-medium">Name</th>
              <th className="border-b border-line px-2 py-1 font-medium">Status</th>
              <th className="border-b border-line px-2 py-1 font-medium">Tag</th>
              <th className="border-b border-line px-2 py-1 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.name}>
                <td className="border-b border-line px-2 py-1 text-ink">{r.name}</td>
                <td className="border-b border-line px-2 py-1"><Pill s={r.status} /></td>
                <td className="border-b border-line px-2 py-1 text-ink-muted">{r.tag}</td>
                <td className="border-b border-line px-2 py-1 text-ink-muted">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

/** Database view block. One block type, param by `view` prop → 9 real sample views.
 * Baseline: sample data, not backed by a live editable data source. */
export const DataView = createReactBlockSpec(
  { type: 'dataView', propSchema: { view: { default: 'table', values: Object.keys(VIEW_META) } }, content: 'none' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block }: any) => {
      const meta = VIEW_META[block.props.view as string] ?? VIEW_META.table!;
      const Icon = meta.icon;
      return (
        <div className="my-1 rounded-md border border-line bg-surface p-2.5" contentEditable={false}>
          <div className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
            <Icon size={13} /> {meta.label}
          </div>
          <ViewBody view={block.props.view as string} />
        </div>
      );
    },
  },
);

/** Database container (inline / full-page / linked). Baseline: titled table view. */
export const DatabaseBlock = createReactBlockSpec(
  { type: 'database', propSchema: { mode: { default: 'inline', values: ['inline', 'full', 'linked'] }, title: { default: 'Untitled database' } }, content: 'none' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor }: any) => {
      const mode = block.props.mode as string;
      const label = mode === 'full' ? 'Database · full page' : mode === 'linked' ? 'Linked data source' : 'Database · inline';
      return (
        <div className="my-1 rounded-md border border-line bg-surface p-2.5" contentEditable={false}>
          <div className="mb-2 flex items-center gap-1.5">
            <DbIcon size={14} className="text-thread" />
            <input
              defaultValue={block.props.title}
              readOnly={!editor.isEditable}
              onBlur={(e) => editor.updateBlock(block, { props: { title: e.target.value } })}
              className="flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
            />
            <span className="text-2xs uppercase text-ink-faint">{label}</span>
          </div>
          <ViewBody view="table" />
        </div>
      );
    },
  },
);

/** Form block — real, locally interactive fields. Baseline: no backend submission. */
export const FormBlock = createReactBlockSpec(
  { type: 'weftForm', propSchema: {}, content: 'none' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: () => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [sent, setSent] = useState(false);
      return (
        <form
          className="my-1 flex max-w-sm flex-col gap-2 rounded-md border border-line bg-surface p-3"
          contentEditable={false}
          onSubmit={(e) => { e.preventDefault(); setSent(true); }}
        >
          <div className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Form</div>
          <input required placeholder="Your name" className="rounded border border-line bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-thread" />
          <input type="email" required placeholder="Email" className="rounded border border-line bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-thread" />
          <label className="flex items-center gap-1.5 text-xs text-ink-muted"><input type="checkbox" /> Subscribe</label>
          <button type="submit" className="self-start rounded-md bg-thread px-3 py-1 text-sm font-medium text-white hover:bg-thread-hover">
            {sent ? 'Submitted ✓' : 'Submit'}
          </button>
        </form>
      );
    },
  },
);

/** Tabs — switchable tabs. Baseline: tab bar switches; per-tab body is placeholder text. */
export const Tabs = createReactBlockSpec(
  { type: 'tabs', propSchema: { labels: { default: 'Tab 1,Tab 2,Tab 3' } }, content: 'none' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block }: any) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [active, setActive] = useState(0);
      const labels = (block.props.labels as string).split(',');
      return (
        <div className="my-1 rounded-md border border-line bg-surface" contentEditable={false}>
          <div className="flex gap-1 border-b border-line px-1 pt-1">
            {labels.map((l, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`rounded-t px-3 py-1 text-sm ${i === active ? 'border-b-2 border-thread font-medium text-thread' : 'text-ink-muted hover:text-ink'}`}
              >
                {l.trim()}
              </button>
            ))}
          </div>
          <div className="p-3 text-sm text-ink-muted">Content of “{labels[active]?.trim()}”.</div>
        </div>
      );
    },
  },
);

/** Columns — visual N-column layout. Baseline: scaffold; block-nesting into columns pending. */
export const Columns = createReactBlockSpec(
  { type: 'columns', propSchema: { count: { default: 2 } }, content: 'none' },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block }: any) => {
      const count = Math.max(2, Math.min(5, block.props.count as number));
      return (
        <div className="my-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }} contentEditable={false}>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="min-h-16 rounded-md border border-dashed border-line-strong p-2 text-xs text-ink-faint">Column {i + 1}</div>
          ))}
        </div>
      );
    },
  },
);

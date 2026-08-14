import { useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { Table2, Kanban, LayoutGrid, List, Rss, LayoutDashboard, Calendar, GanttChart, Map, Database as DbIcon } from 'lucide-react';
import { EditableTable, EditableGallery } from './dataModel';

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

/** Render the block's data as the requested view. Table & Gallery are fully editable;
 * other view variants fall back to the editable table (same data-backed model) so all
 * data stays editable regardless of the chosen visualisation. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ViewBody({ view, block, editor }: { view: string; block: any; editor: any }) {
  if (view === 'gallery') return <EditableGallery block={block} editor={editor} />;
  return <EditableTable block={block} editor={editor} />;
}

/** Database view block. One block type, param by `view` prop. Table & Gallery are
 * fully editable and data-backed (rows/columns in the `data` JSON prop, persisted via
 * Yjs); other view variants fall back to the same editable table. */
export const DataView = createReactBlockSpec(
  {
    type: 'dataView',
    propSchema: { view: { default: 'table', values: Object.keys(VIEW_META) }, data: { default: '' } },
    content: 'none',
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: ({ block, editor }: any) => {
      const meta = VIEW_META[block.props.view as string] ?? VIEW_META.table!;
      const Icon = meta.icon;
      return (
        <div className="my-1 rounded-md border border-line bg-surface p-2.5" contentEditable={false}>
          <div className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
            <Icon size={13} /> {meta.label}
          </div>
          <ViewBody view={block.props.view as string} block={block} editor={editor} />
        </div>
      );
    },
  },
);

/** Database container (inline / full-page / linked). Titled, fully-editable table. */
export const DatabaseBlock = createReactBlockSpec(
  {
    type: 'database',
    propSchema: {
      mode: { default: 'inline', values: ['inline', 'full', 'linked'] },
      title: { default: 'Untitled database' },
      data: { default: '' },
    },
    content: 'none',
  },
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
          <ViewBody view="table" block={block} editor={editor} />
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

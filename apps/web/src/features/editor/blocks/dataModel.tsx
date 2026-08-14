import { Plus, Trash2, Type, ChevronDown, Hash, CheckSquare, Calendar, Tag } from 'lucide-react';
import { useState } from 'react';

/**
 * Shared, editable data model for Weft's data blocks (Database + Gallery views).
 *
 * WHY — the `database` / `dataView` blocks used to render a hard-coded sample array
 * (`content:'none'`, no editing), so anything a user "added" was static. This module
 * makes them data-driven: the rows/columns live in the block's own `data` prop as
 * JSON, so every edit is persisted through BlockNote → Yjs → backend like any other
 * block content (local-first, no separate datastore). The rendered table/gallery is
 * derived from that single source of truth.
 */

export type ColType = 'text' | 'select' | 'number' | 'checkbox' | 'date';
export interface Col {
  id: string;
  name: string;
  type: ColType;
}
export interface Row {
  id: string;
  cells: Record<string, string>; // colId -> stringified value
}
export interface TableData {
  cols: Col[];
  rows: Row[];
}

const COL_TYPE_META: Record<ColType, { icon: typeof Type; label: string }> = {
  text: { icon: Type, label: 'Text' },
  select: { icon: Tag, label: 'Select' },
  number: { icon: Hash, label: 'Number' },
  checkbox: { icon: CheckSquare, label: 'Checkbox' },
  date: { icon: Calendar, label: 'Date' },
};

const SELECT_CHIP_COLORS = [
  'bg-thread-soft text-thread',
  'bg-ok-soft text-ok',
  'bg-sunk text-ink-muted',
  'bg-madder-soft text-madder',
];
function chipColor(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return SELECT_CHIP_COLORS[h % SELECT_CHIP_COLORS.length]!;
}

const uid = (p: string): string =>
  `${p}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.floor(performance.now()).toString(36)}`;

/** A stable, fixed-id default table so empty blocks render consistently (no random
 * ids drifting between renders) until the user makes a real edit. Mirrors the
 * Name/Status/Priority example from the task. */
export function seedData(): TableData {
  return {
    cols: [
      { id: 'c-name', name: 'Name', type: 'text' },
      { id: 'c-status', name: 'Status', type: 'select' },
      { id: 'c-priority', name: 'Priority', type: 'select' },
    ],
    rows: [
      { id: 'r-1', cells: { 'c-name': 'Task A', 'c-status': 'Open', 'c-priority': 'High' } },
      { id: 'r-2', cells: { 'c-name': 'Task B', 'c-status': 'Done', 'c-priority': 'Low' } },
    ],
  };
}

function parse(raw: unknown): TableData {
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const d = JSON.parse(raw);
      if (Array.isArray(d?.cols) && Array.isArray(d?.rows)) return d as TableData;
    } catch {
      /* fall through to seed */
    }
  }
  return seedData();
}

/** Read the block's table data and get mutators that persist via `updateBlock`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDataModel(block: any, editor: any) {
  const data = parse(block.props?.data);
  const commit = (next: TableData) =>
    editor.updateBlock(block, { props: { data: JSON.stringify(next) } });

  const ops = {
    data,
    setCell(rowId: string, colId: string, value: string) {
      commit({
        ...data,
        rows: data.rows.map((r) =>
          r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r,
        ),
      });
    },
    addRow() {
      commit({ ...data, rows: [...data.rows, { id: uid('r'), cells: {} }] });
    },
    deleteRow(rowId: string) {
      commit({ ...data, rows: data.rows.filter((r) => r.id !== rowId) });
    },
    addCol() {
      const n = data.cols.length + 1;
      commit({ ...data, cols: [...data.cols, { id: uid('c'), name: `Property ${n}`, type: 'text' }] });
    },
    renameCol(colId: string, name: string) {
      commit({ ...data, cols: data.cols.map((c) => (c.id === colId ? { ...c, name } : c)) });
    },
    setColType(colId: string, type: ColType) {
      commit({ ...data, cols: data.cols.map((c) => (c.id === colId ? { ...c, type } : c)) });
    },
    deleteCol(colId: string) {
      commit({
        cols: data.cols.filter((c) => c.id !== colId),
        rows: data.rows.map((r) => {
          const { [colId]: _drop, ...rest } = r.cells;
          return { ...r, cells: rest };
        }),
      });
    },
  };
  return ops;
}

// ── Cell editor ──────────────────────────────────────────────────────────────
function CellInput({
  col,
  value,
  editable,
  onCommit,
}: {
  col: Col;
  value: string;
  editable: boolean;
  onCommit: (v: string) => void;
}) {
  if (col.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={value === 'true'}
        disabled={!editable}
        onChange={(e) => onCommit(e.target.checked ? 'true' : 'false')}
        className="h-3.5 w-3.5 accent-thread"
      />
    );
  }
  // Uncontrolled (defaultValue + commit on blur/Enter) so typing never loses focus
  // to a re-render. `key` reseeds the input when the underlying value changes
  // structurally (e.g. new row).
  const input = (
    <input
      key={value}
      defaultValue={value}
      readOnly={!editable}
      inputMode={col.type === 'number' ? 'decimal' : undefined}
      onBlur={(e) => e.target.value !== value && onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      placeholder="Empty"
      className="w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
    />
  );
  if (col.type === 'select' && value) {
    return (
      <span className={`inline-flex items-center rounded px-1.5 py-px text-xs font-medium ${chipColor(value)}`}>
        {input}
      </span>
    );
  }
  return input;
}

// ── Column header with a type / delete menu ───────────────────────────────────
function ColHeader({
  col,
  editable,
  ops,
}: {
  col: Col;
  editable: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ops: any;
}) {
  const [open, setOpen] = useState(false);
  const Icon = COL_TYPE_META[col.type].icon;
  return (
    <div className="relative flex items-center gap-1">
      <Icon size={12} className="shrink-0 text-ink-faint" />
      <input
        key={col.name}
        defaultValue={col.name}
        readOnly={!editable}
        onBlur={(e) => e.target.value !== col.name && ops.renameCol(col.id, e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="min-w-0 flex-1 bg-transparent text-2xs font-semibold uppercase tracking-wide text-ink-faint outline-none"
      />
      {editable && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded p-0.5 text-ink-faint opacity-0 transition hover:bg-sunk hover:text-ink group-hover/col:opacity-100"
          aria-label="Column options"
        >
          <ChevronDown size={12} />
        </button>
      )}
      {open && (
        <div className="absolute right-0 top-5 z-10 w-36 rounded-md border border-line bg-surface p-1 shadow-md">
          <p className="px-2 py-1 text-2xs uppercase text-ink-faint">Type</p>
          {(Object.keys(COL_TYPE_META) as ColType[]).map((t) => {
            const M = COL_TYPE_META[t];
            const TIcon = M.icon;
            return (
              <button
                key={t}
                type="button"
                onClick={() => { ops.setColType(col.id, t); setOpen(false); }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-sunk ${col.type === t ? 'text-thread' : 'text-ink'}`}
              >
                <TIcon size={13} /> {M.label}
              </button>
            );
          })}
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            onClick={() => { ops.deleteCol(col.id); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-madder hover:bg-madder-soft/40"
          >
            <Trash2 size={13} /> Delete property
          </button>
        </div>
      )}
    </div>
  );
}

// ── Editable table ────────────────────────────────────────────────────────────
export function EditableTable({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor,
}: {
  block: any;
  editor: any;
}) {
  const ops = useDataModel(block, editor);
  const editable = editor.isEditable !== false;
  const { cols, rows } = ops.data;

  return (
    <div className="overflow-x-auto" contentEditable={false}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            {cols.map((c) => (
              <th key={c.id} className="group/col min-w-[8rem] px-2 py-1.5 text-left align-middle font-normal">
                <ColHeader col={c} editable={editable} ops={ops} />
              </th>
            ))}
            {editable && (
              <th className="w-9 px-1 py-1.5">
                <button
                  type="button"
                  onClick={ops.addCol}
                  aria-label="Add property"
                  className="flex h-6 w-6 items-center justify-center rounded text-ink-faint transition hover:bg-sunk hover:text-ink"
                >
                  <Plus size={14} />
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="group border-b border-line/60 hover:bg-sunk/40">
              {cols.map((c) => (
                <td key={c.id} className="px-2 py-1 align-middle">
                  <CellInput
                    col={c}
                    value={r.cells[c.id] ?? ''}
                    editable={editable}
                    onCommit={(v) => ops.setCell(r.id, c.id, v)}
                  />
                </td>
              ))}
              {editable && (
                <td className="w-9 px-1 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => ops.deleteRow(r.id)}
                    aria-label="Delete row"
                    className="rounded p-1 text-ink-faint opacity-0 transition hover:bg-madder-soft/40 hover:text-madder group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <button
          type="button"
          onClick={ops.addRow}
          className="mt-1 flex items-center gap-1.5 rounded px-2 py-1 text-sm text-ink-faint transition hover:bg-sunk hover:text-ink"
        >
          <Plus size={14} /> New row
        </button>
      )}
    </div>
  );
}

// ── Editable gallery (cards from the same model) ──────────────────────────────
export function EditableGallery({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  block,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor,
}: {
  block: any;
  editor: any;
}) {
  const ops = useDataModel(block, editor);
  const editable = editor.isEditable !== false;
  const { cols, rows } = ops.data;
  const titleCol = cols[0];
  const restCols = cols.slice(1);

  return (
    <div contentEditable={false}>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))' }}>
        {rows.map((r) => (
          <div key={r.id} className="group relative flex flex-col gap-1.5 rounded-lg border border-line bg-paper p-2.5">
            {editable && (
              <button
                type="button"
                onClick={() => ops.deleteRow(r.id)}
                aria-label="Delete card"
                className="absolute right-1 top-1 rounded p-1 text-ink-faint opacity-0 transition hover:bg-madder-soft/40 hover:text-madder group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            )}
            {titleCol && (
              <div className="pr-5 text-sm font-semibold text-ink">
                <CellInput
                  col={titleCol}
                  value={r.cells[titleCol.id] ?? ''}
                  editable={editable}
                  onCommit={(v) => ops.setCell(r.id, titleCol.id, v)}
                />
              </div>
            )}
            {restCols.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 text-xs">
                <span className="shrink-0 text-ink-faint">{c.name}</span>
                <CellInput
                  col={c}
                  value={r.cells[c.id] ?? ''}
                  editable={editable}
                  onCommit={(v) => ops.setCell(r.id, c.id, v)}
                />
              </div>
            ))}
          </div>
        ))}
        {editable && (
          <button
            type="button"
            onClick={ops.addRow}
            className="flex min-h-[5rem] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong text-sm text-ink-faint transition hover:border-thread hover:text-thread"
          >
            <Plus size={16} /> New
          </button>
        )}
      </div>
    </div>
  );
}

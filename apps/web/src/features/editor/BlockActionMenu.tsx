import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeftRight,
  Palette,
  Link2,
  Copy,
  CornerUpRight,
  Trash2,
  Search,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fuzzyFilter } from '@/lib/fuzzy';
import { BlockPicker } from './BlockPicker';
import type { BlockTypeCtx, BlockTypeDef } from './blockTypes';
import {
  blockSupportsColor,
  copyBlockLink,
  deleteBlock,
  duplicateBlock,
  moveBlockToPage,
} from './blockActions';

/* eslint-disable @typescript-eslint/no-explicit-any */

type View = 'root' | 'turnInto' | 'color' | 'moveTo';

interface ActionDef {
  key: string;
  label: string;
  icon: ReactNode;
  keywords: string[];
  danger?: boolean;
  submenu?: View;
  run?: () => void;
}

// BlockNote's colour names → a representative swatch. Setting the block's
// textColor / backgroundColor prop is all BlockNote needs to render the colour.
const COLORS: { name: string; swatch: string }[] = [
  { name: 'default', swatch: 'transparent' },
  { name: 'gray', swatch: '#9b9691' },
  { name: 'brown', swatch: '#a3835f' },
  { name: 'red', swatch: '#c4554d' },
  { name: 'orange', swatch: '#cc772f' },
  { name: 'yellow', swatch: '#c9a227' },
  { name: 'green', swatch: '#4f9d69' },
  { name: 'blue', swatch: '#3f76c4' },
  { name: 'purple', swatch: '#8a5cc4' },
  { name: 'pink', swatch: '#c45c93' },
];

function relativeTime(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * The six-dots block-action menu (§12–33). A real Notion-style action panel, not
 * just Delete + Colour: a fuzzy-searchable action list at the root, with Turn
 * into / Colour / Move to opening in place as sub-views. Reuses the shared
 * `BlockPicker` for Turn into so its search and keyboard model are identical to
 * the "+" menu. Positioning, portalling and outside-click come from the
 * `Popover` this renders inside; Escape steps back out of a sub-view before
 * closing the whole menu.
 */
export function BlockActionMenu({
  block,
  ctx,
  tree,
  onConvert,
  pageUpdatedAt,
  close,
}: {
  block: any;
  ctx: BlockTypeCtx;
  tree: { id: string; title: string; icon?: string | null }[];
  onConvert: (block: any, def: BlockTypeDef) => void;
  pageUpdatedAt?: string;
  close: () => void;
}) {
  const [view, setView] = useState<View>('root');
  const canColor = useMemo(() => blockSupportsColor(ctx.editor, block), [ctx.editor, block]);
  const rootRef = useRef<HTMLDivElement>(null);

  // Escape handling, owned by the panel itself. We listen in the *capture* phase
  // on the panel element so it fires before any descendant (search input, editor)
  // can stop the event — the shared document-level dismiss never sees Escape here
  // because something between the focused field and `document` stops it mid-bubble.
  // A sub-view steps back to the root; the root closes the whole menu.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (view !== 'root') {
        e.preventDefault();
        setView('root');
      } else {
        close();
      }
    };
    el.addEventListener('keydown', onKey, true);
    return () => el.removeEventListener('keydown', onKey, true);
  }, [view, close]);

  const actions = useMemo<ActionDef[]>(() => {
    const list: ActionDef[] = [
      {
        key: 'turnInto',
        label: 'Turn into',
        icon: <ArrowLeftRight size={16} />,
        keywords: ['convert', 'change', 'transform', 'type'],
        submenu: 'turnInto',
      },
    ];
    if (canColor) {
      list.push({
        key: 'color',
        label: 'Color',
        icon: <Palette size={16} />,
        keywords: ['colour', 'highlight', 'background', 'text color'],
        submenu: 'color',
      });
    }
    list.push(
      {
        key: 'copyLink',
        label: 'Copy link to block',
        icon: <Link2 size={16} />,
        keywords: ['link', 'anchor', 'url', 'share'],
        run: () => void copyBlockLink(ctx.pageId, block).then(close),
      },
      {
        key: 'duplicate',
        label: 'Duplicate',
        icon: <Copy size={16} />,
        keywords: ['copy', 'clone'],
        run: () => {
          duplicateBlock(ctx.editor, block);
          close();
        },
      },
      {
        key: 'moveTo',
        label: 'Move to',
        icon: <CornerUpRight size={16} />,
        keywords: ['move', 'relocate', 'page'],
        submenu: 'moveTo',
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: <Trash2 size={16} />,
        keywords: ['remove', 'trash', 'del'],
        danger: true,
        run: () => {
          deleteBlock(ctx.editor, block);
          close();
        },
      },
    );
    return list;
  }, [canColor, ctx, block, close]);

  return (
    <div
      ref={rootRef}
      className="flex max-h-[min(440px,76vh)] w-72 flex-col overflow-hidden rounded-md border border-line bg-surface shadow-md"
    >
      {view === 'root' && (
        <RootView
          actions={actions}
          onRun={(a) => (a.submenu ? setView(a.submenu) : a.run?.())}
          pageUpdatedAt={pageUpdatedAt}
        />
      )}

      {view === 'turnInto' && (
        <SubShell title="Turn into" onBack={() => setView('root')}>
          <BlockPicker
            activeBlock={block}
            placeholder="Turn into…"
            onPick={(def) => {
              onConvert(block, def);
              close();
            }}
          />
        </SubShell>
      )}

      {view === 'color' && (
        <SubShell title="Color" onBack={() => setView('root')}>
          <ColorView
            block={block}
            onPick={(prop, value) => {
              try {
                ctx.editor.updateBlock(block, { props: { [prop]: value } });
              } catch {
                /* prop unsupported — ignore */
              }
              close();
            }}
          />
        </SubShell>
      )}

      {view === 'moveTo' && (
        <SubShell title="Move to" onBack={() => setView('root')}>
          <MoveToView
            tree={tree}
            currentPageId={ctx.pageId}
            onPick={(target) => {
              void moveBlockToPage(ctx, block, target).then(close);
            }}
          />
        </SubShell>
      )}
    </div>
  );
}

/** Root view: search field + keyboard-navigable action list + last-edited footer. */
function RootView({
  actions,
  onRun,
  pageUpdatedAt,
}: {
  actions: ActionDef[];
  onRun: (a: ActionDef) => void;
  pageUpdatedAt?: string;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filtered = useMemo(
    () => fuzzyFilter(actions, query, (a) => [a.label, ...a.keywords]),
    [actions, query],
  );

  useEffect(() => setSelected(0), [query]);
  useEffect(() => {
    rowRefs.current[selected]?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const a = filtered[selected];
      if (a) onRun(a);
    }
  };

  const rel = relativeTime(pageUpdatedAt);

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 focus-within:border-thread/30">
        <Search size={14} className="shrink-0 text-ink-faint" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search actions…"
          aria-label="Search actions"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:shadow-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-1" role="listbox">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-faint">No actions match.</p>
        ) : (
          filtered.map((a, i) => (
            <button
              key={a.key}
              ref={(el) => (rowRefs.current[i] = el)}
              role="option"
              aria-selected={i === selected}
              onMouseEnter={() => setSelected(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onRun(a);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition',
                a.danger
                  ? i === selected
                    ? 'bg-danger-soft text-danger'
                    : 'text-danger hover:bg-danger-soft'
                  : i === selected
                    ? 'bg-thread-soft text-thread'
                    : 'text-ink hover:bg-sunk',
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">{a.icon}</span>
              <span className="flex-1 truncate">{a.label}</span>
              {a.submenu && <ChevronRight size={14} className="shrink-0 opacity-60" />}
            </button>
          ))
        )}
      </div>

      {rel && (
        <div className="border-t border-line px-3 py-2 text-2xs text-ink-faint">
          Page last edited {rel}
        </div>
      )}
    </>
  );
}

/** Shared header + body chrome for a sub-view, with a Back control. */
function SubShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 border-b border-line px-2.5 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-ink-faint transition hover:text-ink"
      >
        <ChevronLeft size={14} /> {title}
      </button>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

/** Colour sub-view: text colour + background swatches. */
function ColorView({
  block,
  onPick,
}: {
  block: any;
  onPick: (prop: 'textColor' | 'backgroundColor', value: string) => void;
}) {
  const curText = block.props?.textColor ?? 'default';
  const curBg = block.props?.backgroundColor ?? 'default';
  const Swatches = ({
    prop,
    current,
  }: {
    prop: 'textColor' | 'backgroundColor';
    current: string;
  }) => (
    <div className="flex flex-wrap gap-1.5">
      {COLORS.map((c) => (
        <button
          key={c.name}
          title={c.name}
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(prop, c.name);
          }}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md border transition',
            current === c.name ? 'border-thread' : 'border-line-strong hover:border-ink-faint',
          )}
          style={
            prop === 'backgroundColor'
              ? { background: c.name === 'default' ? 'var(--surface)' : c.swatch }
              : undefined
          }
        >
          {prop === 'textColor' ? (
            <span
              className="text-sm font-semibold"
              style={{ color: c.name === 'default' ? 'var(--ink)' : c.swatch }}
            >
              A
            </span>
          ) : (
            current === c.name && <Check size={13} className="text-white mix-blend-difference" />
          )}
        </button>
      ))}
    </div>
  );
  return (
    <div className="space-y-3 p-3">
      <div>
        <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint">Text</p>
        <Swatches prop="textColor" current={curText} />
      </div>
      <div>
        <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
          Background
        </p>
        <Swatches prop="backgroundColor" current={curBg} />
      </div>
    </div>
  );
}

/** Move-to sub-view: fuzzy page picker. */
function MoveToView({
  tree,
  currentPageId,
  onPick,
}: {
  tree: { id: string; title: string; icon?: string | null }[];
  currentPageId: string;
  onPick: (target: { id: string; title: string }) => void;
}) {
  const [query, setQuery] = useState('');
  const pages = useMemo(
    () => tree.filter((p) => p.id !== currentPageId),
    [tree, currentPageId],
  );
  const filtered = useMemo(
    () => fuzzyFilter(pages, query, (p) => p.title || 'Untitled').slice(0, 50),
    [pages, query],
  );

  return (
    <div className="flex max-h-[340px] flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 focus-within:border-thread/30">
        <Search size={14} className="shrink-0 text-ink-faint" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Move to page…"
          aria-label="Move to page"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:shadow-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-faint">No pages found.</p>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick({ id: p.id, title: p.title });
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-ink transition hover:bg-sunk"
            >
              <span className="shrink-0 text-sm">{p.icon || '📄'}</span>
              <span className="truncate">{p.title || 'Untitled'}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

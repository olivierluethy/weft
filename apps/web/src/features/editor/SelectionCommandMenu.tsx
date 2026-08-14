import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutList, Search, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fuzzyFilter } from '@/lib/fuzzy';
import { BlockPicker } from './BlockPicker';
import { FontList } from './FontList';
import { InlineColorMenu } from './InlineColorMenu';
import { LinkEditor } from './LinkEditor';
import { MoveToList } from './MoveToList';
import { moveBlockToPage } from './blockActions';
import { pageFont } from './pageFonts';
import { paletteColor } from './palette';
import type { BlockTypeDef } from './blockTypes';
import {
  INLINE_FORMATS,
  activeTurnIntoDef,
  inlineExtras,
  primaryTurnIntoDefs,
  selectionActions,
  shortcutLabel,
  turnIntoDefs,
  type SelectionApi,
} from './selectionCommands';
import type { MarkState } from './selectionModel';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SelectionView =
  | 'root'
  | 'turnInto'
  | 'textColor'
  | 'highlight'
  | 'font'
  | 'link'
  | 'moveTo';

/**
 * One panel behind every control on the selection toolbar.
 *
 * The brief's hardest requirement is not any single command — it is that block
 * transformation and inline formatting stop feeling like two products (§4, §29).
 * So they live in **one searchable list**: type "heading" and you get the three
 * heading transformations; type "highlight" and you get the inline mark; type
 * "delte" and the shared fuzzy matcher still finds Delete. Sections (Format /
 * Turn into / Actions) keep the two ideas legible without separating them.
 *
 * Every toolbar control opens *this* component with a different `initialView`,
 * so the colour grid reached from the toolbar's colour button and the one
 * reached by searching "highlight" are the same grid, and a back arrow always
 * leads to the full command list. Nothing here implements editing: it calls the
 * `SelectionApi` verbs, which call the editor's own commands.
 *
 * Keyboard: type to search, ↑/↓ move, Enter runs, Home/End jump, Escape steps
 * out of a sub-view before closing the panel. Escape is owned in the **capture**
 * phase on the panel element — an editor-hosted overlay never sees it otherwise
 * (docs/STYLEGUIDE.md §6.1).
 */
export function SelectionCommandMenu({
  api,
  close,
  initialView = 'root',
}: {
  api: SelectionApi;
  close: () => void;
  initialView?: SelectionView;
}) {
  const [view, setView] = useState<SelectionView>(initialView);
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={rootRef}
      data-weft-selection-menu
      className="flex max-h-[min(460px,72vh)] w-[288px] flex-col overflow-hidden rounded-md border border-line bg-surface shadow-md"
    >
      {view === 'root' && <RootView api={api} close={close} onView={setView} />}

      {view === 'turnInto' && (
        <SubShell title="Turn into" onBack={() => setView('root')}>
          <BlockPicker
            chrome={false}
            defs={turnIntoDefs(api.editor, api.blocks.length)}
            activeBlock={api.blocks[0]}
            placeholder="Turn into…"
            onPick={(def) => {
              api.convert(def);
              close();
            }}
          />
        </SubShell>
      )}

      {(view === 'textColor' || view === 'highlight') && (
        <SubShell title="Color" onBack={() => setView('root')}>
          <InlineColorMenu
            text={api.textColor}
            highlight={api.highlight}
            onPick={(kind, value) => api.setColor(kind, value)}
          />
        </SubShell>
      )}

      {view === 'font' && (
        <SubShell title="Font" onBack={() => setView('root')}>
          <FontList
            clearable
            clearLabel="Default"
            clearHint="Follow the page font"
            value={api.font.mixed ? '' : (api.font.value ?? '')}
            editable={api.editor.isEditable}
            onPick={(key) => api.setFont(key)}
            className="max-h-[340px]"
          />
        </SubShell>
      )}

      {view === 'link' && (
        <LinkEditor
          initialUrl={api.link?.href ?? ''}
          initialText={api.link?.text ?? selectedText(api)}
          onSubmit={(url, text) => {
            api.setLink(url, text);
            close();
          }}
          onRemove={() => {
            api.clearLink();
            close();
          }}
          onCancel={close}
        />
      )}

      {view === 'moveTo' && (
        <SubShell title="Move to" onBack={() => setView('root')}>
          <MoveToList
            tree={api.tree}
            currentPageId={api.ctx.pageId}
            onPick={(target) => {
              const blocks = api.blocks;
              void (async () => {
                for (const b of blocks) {
                  // eslint-disable-next-line no-await-in-loop
                  await moveBlockToPage(api.ctx, b, target);
                }
                close();
              })();
            }}
          />
        </SubShell>
      )}
    </div>
  );
}

function selectedText(api: SelectionApi): string {
  try {
    return api.editor.getSelectedText() ?? '';
  } catch {
    return '';
  }
}

// ── Root: the one command list ──────────────────────────────────────────────

interface MenuRow {
  key: string;
  label: string;
  Icon: LucideIcon;
  keywords: string[];
  section: string;
  /** Right-aligned hint: a shortcut, a current value, "Mixed". */
  hint?: string;
  chevron?: boolean;
  danger?: boolean;
  /** Toggle indicator for the boolean marks. */
  state?: MarkState;
  /** Ticked (the block already is this type). */
  active?: boolean;
  run: () => void;
}

function RootView({
  api,
  close,
  onView,
}: {
  api: SelectionApi;
  close: () => void;
  onView: (v: SelectionView) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeDef = activeTurnIntoDef(api.blocks);
  const blockCount = api.blocks.length;

  const formatRows = useMemo<MenuRow[]>(() => {
    const marks = INLINE_FORMATS.map((f): MenuRow => {
      const state = api.stateOf(f.style);
      return {
        key: `fmt:${f.style}`,
        label: f.label,
        Icon: f.Icon,
        keywords: f.keywords,
        section: 'Format',
        hint: state.mixed ? 'Mixed' : shortcutLabel(f.shortcut),
        state,
        run: () => {
          api.toggle(f.style);
        },
      };
    });
    const extras = inlineExtras(() => {
      api.clearFormatting();
      close();
    }).map((x): MenuRow => {
      const hint =
        x.key === 'textColor'
          ? colourHint(api.textColor)
          : x.key === 'highlight'
            ? colourHint(api.highlight)
            : x.key === 'font'
              ? fontHint(api.font)
              : x.key === 'link'
                ? api.link?.href
                : undefined;
      return {
        key: `fmt:${x.key}`,
        label: x.key === 'link' && api.link ? 'Edit link' : x.label,
        Icon: x.Icon,
        keywords: x.keywords,
        section: 'Format',
        hint: hint ? truncate(hint) : undefined,
        chevron: !!x.panel,
        run: () => (x.panel ? onView(x.panel) : x.run?.()),
      };
    });
    return [...marks, ...extras];
  }, [api, close, onView]);

  const convertRow = (def: BlockTypeDef): MenuRow => ({
    key: `turn:${def.key}`,
    label: def.title,
    Icon: def.Icon,
    keywords: [...def.aliases, 'turn into', 'convert', 'block type'],
    section: 'Turn into',
    active: activeDef?.key === def.key,
    run: () => {
      api.convert(def);
      close();
    },
  });

  const actionRows = useMemo<MenuRow[]>(
    () =>
      selectionActions(api.editor, api.ctx, api.blocks, close).map((a) => ({
        key: `act:${a.key}`,
        label: a.label,
        Icon: a.Icon,
        keywords: a.keywords,
        section: 'Actions',
        danger: a.danger,
        chevron: !!a.panel,
        run: () => (a.panel ? onView(a.panel) : a.run?.()),
      })),
    [api, close, onView],
  );

  // Idle: a short, curated Turn-into set plus a door to the full registry.
  // Searching: every convertible block type is in scope, so "callout" or
  // "toggle heading 2" finds its transformation directly (§13–15).
  const sections = useMemo(() => {
    const q = query.trim();
    if (q) {
      const all = [
        ...formatRows,
        ...turnIntoDefs(api.editor, blockCount).map(convertRow),
        ...actionRows,
      ];
      const ranked = fuzzyFilter(all, q, (r) => [r.label, r.section, ...r.keywords]);
      return ranked.length ? [{ name: '', rows: ranked }] : [];
    }
    const browse: MenuRow = {
      key: 'turn:browse',
      label: 'Browse all block types',
      Icon: LayoutList,
      keywords: ['all', 'blocks', 'more', 'browse'],
      section: 'Turn into',
      chevron: true,
      run: () => onView('turnInto'),
    };
    return [
      { name: 'Format', rows: formatRows },
      {
        name: blockCount > 1 ? `Turn into · ${blockCount} blocks` : 'Turn into',
        rows: [...primaryTurnIntoDefs(api.editor, blockCount).map(convertRow), browse],
      },
      { name: 'Actions', rows: actionRows },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, formatRows, actionRows, api, blockCount, activeDef]);

  const flat = useMemo(() => sections.flatMap((s) => s.rows), [sections]);

  useEffect(() => setSelected(0), [query]);
  useEffect(() => {
    rowRefs.current[selected]?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelected(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSelected(flat.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flat[selected]?.run();
    }
  };

  let index = -1;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 focus-within:border-thread/30">
        <Search size={14} className="shrink-0 text-ink-faint" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search formatting or block type…"
          aria-label="Search formatting or block type"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:shadow-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-1" role="listbox">
        {flat.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-faint">
            Nothing matches “{query.trim()}”.
          </p>
        ) : (
          sections.map((section) => (
            <div key={section.name || 'results'}>
              {section.name && (
                <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                  {section.name}
                </p>
              )}
              {section.rows.map((row) => {
                index += 1;
                const i = index;
                const highlighted = i === selected;
                const on = row.state?.active;
                const mixed = row.state?.mixed;
                return (
                  <button
                    key={row.key}
                    ref={(el) => (rowRefs.current[i] = el)}
                    type="button"
                    role="option"
                    aria-selected={highlighted}
                    data-command-key={row.key}
                    onMouseEnter={() => setSelected(i)}
                    onMouseDown={(e) => {
                      // The selection must survive the click that formats it.
                      e.preventDefault();
                      row.run();
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition',
                      row.danger
                        ? highlighted
                          ? 'bg-danger-soft text-danger'
                          : 'text-danger hover:bg-danger-soft'
                        : highlighted
                          ? 'bg-thread-soft text-thread'
                          : 'text-ink hover:bg-sunk',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center',
                        on && !row.danger && !highlighted && 'text-thread',
                      )}
                    >
                      <row.Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{row.label}</span>
                    {row.hint && (
                      <span className="shrink-0 font-mono text-2xs text-ink-faint">{row.hint}</span>
                    )}
                    {(on || mixed) && (
                      <span
                        aria-hidden
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', on ? 'bg-thread' : '')}
                        style={
                          mixed
                            ? { background: 'var(--ink-faint)', boxShadow: 'inset 0 0 0 1px var(--surface)' }
                            : undefined
                        }
                      />
                    )}
                    {row.active && <span className="shrink-0 text-2xs text-thread">✓</span>}
                    {row.chevron && <ChevronRight size={14} className="shrink-0 opacity-60" />}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
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
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onBack();
        }}
        className="flex items-center gap-1.5 border-b border-line px-2.5 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-ink-faint transition hover:text-ink"
      >
        <ChevronLeft size={14} /> {title}
      </button>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

const truncate = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function colourHint(state: MarkState): string | undefined {
  if (state.mixed) return 'Mixed';
  return state.value ? paletteColor(state.value).label : undefined;
}

function fontHint(state: MarkState): string | undefined {
  if (state.mixed) return 'Mixed';
  return state.value ? pageFont(state.value).label : undefined;
}

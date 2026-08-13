import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  Plus,
  Network,
  Trash2,
  Settings,
  Moon,
  CornerDownLeft,
  Copy,
  ChevronRight,
  CaseSensitive,
  WholeWord,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from './workspace';
import { useThemeStore } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { highlight } from '@/features/search/highlight';
import { jumpPath } from '@/features/search/jump';

interface Occurrence {
  blockId: string | null;
  before: string;
  match: string;
  after: string;
}
interface SearchResult {
  id: string;
  title: string;
  icon: string | null;
  path: { id: string; title: string }[];
  count: number;
  occurrences: Occurrence[];
}

const OPTS_KEY = 'weft-search-opts';
function loadOpts(): { wholeWord: boolean; caseSensitive: boolean } {
  try {
    return { wholeWord: false, caseSensitive: false, ...JSON.parse(localStorage.getItem(OPTS_KEY) || '{}') };
  } catch {
    return { wholeWord: false, caseSensitive: false };
  }
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [opts, setOpts] = useState(loadOpts);
  const { workspaceId } = useWorkspace();
  const { cycle } = useThemeStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setResults([]);
      setActive(0);
      setExpanded(new Set());
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const setOptsPersist = (next: Partial<typeof opts>) => {
    const merged = { ...opts, ...next };
    setOpts(merged);
    localStorage.setItem(OPTS_KEY, JSON.stringify(merged));
  };

  // Debounced search.
  useEffect(() => {
    if (!open || !workspaceId) return;
    if (q.trim().length < 1) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await api.get<{ results: SearchResult[] }>(
          `/search?q=${encodeURIComponent(q)}&workspaceId=${workspaceId}` +
            `&mode=${opts.wholeWord ? 'whole' : 'contains'}&caseSensitive=${opts.caseSensitive}`,
        );
        setResults(res.results);
        setActive(0);
      } catch {
        setResults([]);
      }
    }, 160);
    return () => clearTimeout(handle);
  }, [q, open, workspaceId, opts]);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };
  const jumpTo = (r: SearchResult, occ?: Occurrence) => {
    const target = occ ?? r.occurrences.find((o) => o.blockId) ?? r.occurrences[0];
    go(jumpPath(r.id, target?.blockId));
  };
  const copyPath = (r: SearchResult) => {
    const full = [...r.path.map((p) => p.title), r.title].join(' / ');
    void navigator.clipboard.writeText(full);
    toast.success('Path copied');
  };

  const commands = useMemo(
    () => [
      {
        id: 'new',
        label: 'Create new page',
        icon: <Plus size={16} />,
        run: async () => {
          const res = await api.post<{ page: { id: string } }>('/pages', { workspaceId });
          go(`/p/${res.page.id}`);
        },
      },
      { id: 'graph', label: 'Open graph view', icon: <Network size={16} />, run: () => go('/graph') },
      { id: 'trash', label: 'Open trash', icon: <Trash2 size={16} />, run: () => go('/trash') },
      { id: 'settings', label: 'Open settings', icon: <Settings size={16} />, run: () => go('/settings') },
      { id: 'theme', label: 'Toggle theme', icon: <Moon size={16} />, run: () => { cycle(); onClose(); } },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId],
  );

  const showCommands = q.trim().length === 0;

  // Keyboard navigation over top-level rows (results or commands).
  const rowCount = showCommands ? commands.length : results.length;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, rowCount - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (showCommands) commands[active]?.run();
        else if (results[active]) jumpTo(results[active]!);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rowCount, active, showCommands, results, commands]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[rgba(33,31,28,.36)] p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-[600px] animate-[fade_.14s_ease] overflow-hidden shadow-lg">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={17} className="text-ink-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages or run a command…"
            className="h-12 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
          />
          <span className="kbd">esc</span>
        </div>

        {/* Match-mode options */}
        <div className="flex items-center gap-1.5 border-b border-line px-3 py-1.5">
          <ModeToggle
            active={opts.wholeWord}
            onClick={() => setOptsPersist({ wholeWord: !opts.wholeWord })}
            icon={<WholeWord size={14} />}
            label="Whole word"
          />
          <ModeToggle
            active={opts.caseSensitive}
            onClick={() => setOptsPersist({ caseSensitive: !opts.caseSensitive })}
            icon={<CaseSensitive size={15} />}
            label="Match case"
          />
          <span className="ml-auto text-2xs text-ink-faint">
            {showCommands ? 'Type to search' : `${results.length} page${results.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="max-h-[54vh] overflow-y-auto p-1.5">
          {showCommands ? (
            <>
              <p className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                Actions
              </p>
              {commands.map((item, i) => (
                <button
                  key={item.id}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => item.run()}
                  className={cn(
                    'flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition',
                    i === active ? 'bg-thread-soft text-thread' : 'text-ink hover:bg-sunk',
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {i === active && <CornerDownLeft size={14} className="shrink-0 opacity-60" />}
                </button>
              ))}
            </>
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-faint">No pages match "{q}"</p>
          ) : (
            results.map((r, i) => {
              const isExpanded = expanded.has(r.id);
              const first = r.occurrences.find((o) => o.blockId) ?? r.occurrences[0];
              return (
                <div key={r.id} className="rounded">
                  <div
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      'group flex items-start gap-2.5 rounded px-3 py-2 transition',
                      i === active ? 'bg-thread-soft' : 'hover:bg-sunk',
                    )}
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-base">
                      {r.icon || <FileText size={16} className="text-ink-faint" />}
                    </span>
                    <button onClick={() => jumpTo(r)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">
                          {highlight(r.title, q, opts)}
                        </span>
                        {r.count > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded((s) => {
                                const n = new Set(s);
                                n.has(r.id) ? n.delete(r.id) : n.add(r.id);
                                return n;
                              });
                            }}
                            className="shrink-0 rounded-sm bg-sunk px-1.5 text-2xs text-ink-muted hover:text-ink"
                          >
                            {r.count} matches
                          </button>
                        )}
                      </div>
                      {r.path.length > 0 && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
                          {r.path.map((p, pi) => (
                            <span key={p.id} className="flex items-center gap-1">
                              {pi > 0 && <ChevronRight size={11} />}
                              <span className="max-w-[120px] truncate">{p.title}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {first && first.blockId && (
                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                          {first.before}
                          <mark className="weft-mark">{first.match}</mark>
                          {first.after}
                        </p>
                      )}
                    </button>
                    <button
                      onClick={() => copyPath(r)}
                      title="Copy path"
                      className="mt-0.5 shrink-0 rounded p-1 text-ink-faint opacity-0 transition hover:bg-surface hover:text-ink group-hover:opacity-100"
                    >
                      <Copy size={14} />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="ml-9 mr-3 mb-1 space-y-0.5 border-l border-line pl-3">
                      {r.occurrences
                        .filter((o) => o.blockId)
                        .map((o, oi) => (
                          <button
                            key={oi}
                            onClick={() => jumpTo(r, o)}
                            className="block w-full truncate rounded px-2 py-1 text-left text-xs text-ink-muted transition hover:bg-sunk hover:text-ink"
                          >
                            {o.before}
                            <mark className="weft-mark">{o.match}</mark>
                            {o.after}
                          </button>
                        ))}
                      {r.count > r.occurrences.length && (
                        <p className="px-2 py-1 text-2xs text-ink-faint">
                          +{r.count - r.occurrences.length} more…
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function ModeToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition',
        active ? 'bg-thread-soft text-thread' : 'text-ink-muted hover:bg-sunk',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

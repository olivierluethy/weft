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
} from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspace } from './workspace';
import { useThemeStore } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  title: string;
  icon: string | null;
  snippet: string;
}
interface Command {
  id: string;
  label: string;
  icon: React.ReactNode;
  run: () => void;
  hint?: string;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const { workspaceId } = useWorkspace();
  const { cycle } = useThemeStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

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
          `/search?q=${encodeURIComponent(q)}&workspaceId=${workspaceId}`,
        );
        setResults(res.results);
        setActive(0);
      } catch {
        setResults([]);
      }
    }, 160);
    return () => clearTimeout(handle);
  }, [q, open, workspaceId]);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const commands: Command[] = useMemo(
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
      {
        id: 'settings',
        label: 'Open settings',
        icon: <Settings size={16} />,
        run: () => go('/settings'),
      },
      {
        id: 'theme',
        label: 'Toggle theme',
        icon: <Moon size={16} />,
        run: () => {
          cycle();
          onClose();
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaceId],
  );

  const showCommands = q.trim().length === 0;
  const items = showCommands
    ? commands
    : results.map<Command>((r) => ({
        id: r.id,
        label: r.title || 'Untitled',
        icon: r.icon ? <span className="text-base">{r.icon}</span> : <FileText size={16} />,
        hint: r.snippet,
        run: () => go(`/p/${r.id}`),
      }));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        items[active]?.run();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, active, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[rgba(33,31,28,.36)] p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-[560px] animate-[fade_.14s_ease] overflow-hidden shadow-lg">
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
        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {!showCommands && items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-faint">No pages match "{q}"</p>
          )}
          {showCommands && (
            <p className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
              Actions
            </p>
          )}
          {items.map((item, i) => (
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
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{item.label}</span>
                {item.hint && <span className="truncate text-xs text-ink-faint">{item.hint}</span>}
              </span>
              {i === active && <CornerDownLeft size={14} className="shrink-0 opacity-60" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

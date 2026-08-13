import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Copy, Pencil, Check, X } from 'lucide-react';
import type { PageTreeNode } from '@weft/shared';
import { useTree } from '@/lib/queries';
import { useWorkspace } from '@/features/app/workspace';
import { PageIcon } from './pickers/IconPicker';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface Crumb {
  id: string;
  title: string;
  icon: string | null;
}

/** Explorer-style breadcrumb: click a segment to jump to that ancestor, copy the
 * full path, or edit it as text and press Enter to navigate anywhere. */
export function PathBar({ breadcrumbs }: { breadcrumbs: Crumb[] }) {
  const navigate = useNavigate();
  const { workspaceId } = useWorkspace();
  const { data: tree } = useTree(workspaceId);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pathString = breadcrumbs.map((c) => c.title || 'Untitled').join(' / ');

  useEffect(() => {
    if (editing) {
      setValue(pathString);
      setError(false);
      setTimeout(() => inputRef.current?.select(), 20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  /** Resolve a "A / B / C" path against the page tree (trim + case-insensitive). */
  const resolve = (input: string): string | null => {
    const segments = input
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length === 0 || !tree) return null;

    const childrenOf = (parentId: string | null): PageTreeNode[] =>
      tree.filter((n) => n.parentId === parentId).sort((a, b) => a.position - b.position);

    let parentId: string | null = null;
    let matchedId: string | null = null;
    for (const seg of segments) {
      const target = seg.toLowerCase();
      const match: PageTreeNode | undefined = childrenOf(parentId).find(
        (n) => (n.title || 'Untitled').trim().toLowerCase() === target,
      );
      if (!match) return null;
      matchedId = match.id;
      parentId = match.id;
    }
    return matchedId;
  };

  const submit = () => {
    const id = resolve(value);
    if (!id) {
      setError(true);
      return;
    }
    setEditing(false);
    navigate(`/p/${id}`);
  };

  const copy = () => {
    void navigator.clipboard.writeText(pathString);
    toast.success('Path copied');
  };

  if (editing) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            else if (e.key === 'Escape') setEditing(false);
          }}
          placeholder="Projects / Research / Notes"
          className={cn(
            'input h-7 flex-1 font-mono text-xs',
            error && 'border-danger text-danger',
          )}
        />
        {error && <span className="shrink-0 text-xs text-danger">Path not found</span>}
        <button onClick={submit} className="shrink-0 rounded p-1 text-ink-faint hover:text-ok" title="Go">
          <Check size={15} />
        </button>
        <button
          onClick={() => setEditing(false)}
          className="shrink-0 rounded p-1 text-ink-faint hover:text-ink"
          title="Cancel"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex min-w-0 flex-1 items-center gap-1 text-sm text-ink-muted">
      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {breadcrumbs.map((c, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={c.id} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight size={13} className="shrink-0 text-ink-faint" />}
              <button
                onClick={() => !isLast && navigate(`/p/${c.id}`)}
                disabled={isLast}
                title={isLast ? undefined : `Go up to ${c.title || 'Untitled'}`}
                className={cn(
                  'flex items-center gap-1 truncate rounded px-1.5 py-0.5',
                  isLast ? 'font-medium text-ink' : 'hover:bg-sunk',
                )}
              >
                {c.icon && <PageIcon icon={c.icon} size={14} />}
                <span className="max-w-[180px] truncate">{c.title || 'Untitled'}</span>
              </button>
            </span>
          );
        })}
      </nav>
      <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
        <button onClick={copy} title="Copy path" className="rounded p-1 text-ink-faint hover:bg-sunk hover:text-ink">
          <Copy size={13} />
        </button>
        <button
          onClick={() => setEditing(true)}
          title="Edit path"
          className="rounded p-1 text-ink-faint hover:bg-sunk hover:text-ink"
        >
          <Pencil size={13} />
        </button>
      </div>
    </div>
  );
}

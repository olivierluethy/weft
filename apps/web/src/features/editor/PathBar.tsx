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
 * full path, or edit it as text and press Enter to navigate anywhere. When
 * `onRenameCurrent` is supplied, clicking the last (current) segment turns it
 * into an inline field for renaming the page right from the top bar. */
export function PathBar({
  breadcrumbs,
  editable = false,
  onRenameCurrent,
}: {
  breadcrumbs: Crumb[];
  editable?: boolean;
  onRenameCurrent?: (title: string) => void;
}) {
  const navigate = useNavigate();
  const { workspaceId } = useWorkspace();
  const { data: tree } = useTree(workspaceId);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Inline rename of the current page (the last crumb).
  const canRenameCurrent = editable && !!onRenameCurrent;
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const current = breadcrumbs[breadcrumbs.length - 1];

  const startTitleEdit = () => canRenameCurrent && setTitleEdit(current?.title ?? '');
  const commitTitleEdit = () => {
    if (titleEdit === null) return;
    const next = titleEdit.trim();
    if (next && next !== (current?.title ?? '')) onRenameCurrent?.(next);
    setTitleEdit(null);
  };
  // Select-all ONCE when rename mode opens — depend on the boolean, not on
  // `titleEdit` itself. Keying it on `titleEdit` re-ran `.select()` on every
  // keystroke, so each new character replaced the whole (re-selected) value and
  // typing could never get past one character.
  const isRenaming = titleEdit !== null;
  useEffect(() => {
    if (isRenaming) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [isRenaming]);

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
    <div className="flex min-w-0 flex-1 items-center gap-1 text-sm text-ink-muted">
      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {breadcrumbs.map((c, i) => {
          const isLast = i === breadcrumbs.length - 1;
          if (isLast && titleEdit !== null) {
            return (
              <span key={c.id} className="flex min-w-0 flex-1 items-center gap-1">
                {i > 0 && <ChevronRight size={13} className="shrink-0 text-ink-faint" />}
                {c.icon && <PageIcon icon={c.icon} size={14} />}
                <input
                  ref={titleRef}
                  value={titleEdit}
                  onChange={(e) => setTitleEdit(e.target.value.replace(/\n/g, ''))}
                  onBlur={commitTitleEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setTitleEdit(null);
                    }
                  }}
                  placeholder="Untitled"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded bg-transparent px-1.5 py-0.5 text-sm font-medium text-ink outline-none ring-1 ring-thread placeholder:text-ink-faint"
                />
              </span>
            );
          }
          return (
            <span key={c.id} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight size={13} className="shrink-0 text-ink-faint" />}
              <button
                onClick={() => (isLast ? startTitleEdit() : navigate(`/p/${c.id}`))}
                disabled={isLast && !canRenameCurrent}
                title={
                  isLast
                    ? canRenameCurrent
                      ? 'Rename page'
                      : undefined
                    : `Go up to ${c.title || 'Untitled'}`
                }
                className={cn(
                  'flex items-center gap-1 truncate rounded px-1.5 py-0.5',
                  isLast ? 'font-medium text-ink' : 'hover:bg-sunk',
                  isLast && canRenameCurrent && 'cursor-text hover:bg-sunk',
                )}
              >
                {c.icon && <PageIcon icon={c.icon} size={14} />}
                <span className="max-w-[180px] truncate">{c.title || 'Untitled'}</span>
              </button>
            </span>
          );
        })}
      </nav>
      {/* Copy / Edit path — permanently visible (previously opacity-0 until hover). */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={copy}
          title="Copy path"
          aria-label="Copy path"
          className="rounded-md p-1 text-ink-faint transition-colors hover:bg-sunk hover:text-ink"
        >
          <Copy size={13} />
        </button>
        <button
          onClick={() => setEditing(true)}
          title="Edit path"
          aria-label="Edit path"
          className="rounded-md p-1 text-ink-faint transition-colors hover:bg-sunk hover:text-ink"
        >
          <Pencil size={13} />
        </button>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Home, CornerDownRight, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { PageIcon } from './pickers/IconPicker';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useTree, useInvalidate } from '@/lib/queries';
import type { PageTreeNode } from '@weft/shared';

/** Destination picker for "Move to". Lists every page in the workspace except the
 * page itself and its descendants (moving into those would orphan the subtree),
 * plus a "Top level" option. Appends at the end of the chosen parent. */
export function MovePageDialog({
  pageId,
  workspaceId,
  onClose,
}: {
  pageId: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const { data: tree } = useTree(workspaceId);
  const invalidate = useInvalidate();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const nodes = useMemo(() => tree ?? [], [tree]);
  // Block the page + its whole subtree as invalid destinations.
  const blocked = useMemo(() => {
    const set = new Set<string>([pageId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of nodes) {
        if (n.parentId && set.has(n.parentId) && !set.has(n.id)) { set.add(n.id); grew = true; }
      }
    }
    return set;
  }, [nodes, pageId]);

  const matches = (n: PageTreeNode) =>
    (n.title || 'Untitled').toLowerCase().includes(q.trim().toLowerCase());
  const options = nodes.filter((n) => !blocked.has(n.id) && matches(n));

  const move = async (parentId: string | null) => {
    if (busy) return;
    setBusy(true);
    const siblings = nodes.filter((n) => (n.parentId ?? null) === parentId).length;
    try {
      await api.post(`/pages/${pageId}/move`, { parentId, position: siblings });
      await invalidate.tree(workspaceId);
      toast.success('Page moved');
      onClose();
    } catch {
      toast.error('Could not move page');
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Move page to…" width="sm">
      <div className="mb-2 flex items-center gap-2 rounded-md border border-line bg-paper px-2.5 py-1.5">
        <Search size={14} className="text-ink-faint" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search pages…"
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
      </div>
      <div className="max-h-72 overflow-y-auto">
        {(q.trim() === '' || 'top level'.includes(q.toLowerCase())) && (
          <button
            onClick={() => void move(null)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink hover:bg-sunk"
          >
            <Home size={15} className="text-ink-muted" /> Top level (no parent)
          </button>
        )}
        {options.map((n) => (
          <button
            key={n.id}
            onClick={() => void move(n.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink hover:bg-sunk"
          >
            <CornerDownRight size={13} className="shrink-0 text-ink-faint" />
            {n.icon ? <PageIcon icon={n.icon} size={15} /> : null}
            <span className="truncate">{n.title || 'Untitled'}</span>
          </button>
        ))}
        {options.length === 0 && q.trim() !== '' && (
          <p className="px-2 py-3 text-sm text-ink-faint">No matching pages.</p>
        )}
      </div>
    </Modal>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, FileText, Plus, Star, MoreHorizontal, Lock } from 'lucide-react';
import type { PageTreeNode } from '@weft/shared';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useInvalidate } from '@/lib/queries';
import { useWorkspace } from './workspace';
import { PageRowMenu } from './PageRowMenu';
import { Popover } from '@/components/ui/Popover';
import { IconPicker, PageIcon } from '@/features/editor/pickers/IconPicker';

interface TreeItem extends PageTreeNode {
  children: TreeItem[];
  depth: number;
}

/** How the tree is ordered. `manual` honours the stored position (and enables
 * drag-to-reorder); the others are read-only orderings. */
export type SortMode = 'manual' | 'title' | 'edited';

const COMPARATORS: Record<SortMode, (a: PageTreeNode, b: PageTreeNode) => number> = {
  manual: (a, b) => a.position - b.position,
  title: (a, b) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled'),
  edited: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
};

function buildTree(flat: PageTreeNode[], sort: SortMode): TreeItem[] {
  const byId = new Map<string, TreeItem>();
  flat.forEach((n) => byId.set(n.id, { ...n, children: [], depth: 0 }));
  const roots: TreeItem[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const cmp = COMPARATORS[sort];
  const sortRec = (items: TreeItem[], depth: number) => {
    items.sort(cmp);
    items.forEach((i) => {
      i.depth = depth;
      sortRec(i.children, depth + 1);
    });
  };
  sortRec(roots, 0);
  return roots;
}

type DropPos = 'before' | 'after' | 'inside';

export function PageTree({
  nodes,
  filter,
  sortMode = 'manual',
  onOpenPeek,
}: {
  nodes: PageTreeNode[];
  filter?: (n: PageTreeNode) => boolean;
  sortMode?: SortMode;
  /** When provided, rows offer "Open in side peek". */
  onOpenPeek?: (pageId: string) => void;
}) {
  const tree = useMemo(
    () => buildTree(filter ? nodes.filter(filter) : nodes, sortMode),
    [nodes, filter, sortMode],
  );
  const canReorder = sortMode === 'manual';
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: DropPos } | null>(null);
  const [hoverSubtree, setHoverSubtree] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const navigate = useNavigate();
  const { pageId: activeId } = useParams();
  const { workspaceId } = useWorkspace();
  const invalidate = useInvalidate();

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const createChild = async (parentId: string) => {
    const res = await api.post<{ page: { id: string } }>('/pages', { workspaceId, parentId });
    setCollapsed((s) => {
      const n = new Set(s);
      n.delete(parentId);
      return n;
    });
    await invalidate.tree(workspaceId);
    navigate(`/p/${res.page.id}`);
  };

  const onDrop = async (target: TreeItem) => {
    if (!dragId || !dropTarget || dragId === target.id) return reset();
    const flat = nodes;
    const dragged = flat.find((n) => n.id === dragId);
    if (!dragged) return reset();

    let parentId: string | null;
    let position: number;
    if (dropTarget.pos === 'inside') {
      parentId = target.id;
      const kids = flat.filter((n) => n.parentId === target.id).sort((a, b) => a.position - b.position);
      position = (kids.at(-1)?.position ?? 0) + 1000;
    } else {
      parentId = target.parentId;
      const sibs = flat
        .filter((n) => n.parentId === target.parentId && n.id !== dragId)
        .sort((a, b) => a.position - b.position);
      const idx = sibs.findIndex((s) => s.id === target.id);
      if (dropTarget.pos === 'before') {
        const prev = sibs[idx - 1];
        position = prev ? (prev.position + target.position) / 2 : target.position - 500;
      } else {
        const next = sibs[idx + 1];
        position = next ? (target.position + next.position) / 2 : target.position + 500;
      }
    }
    reset();
    await api.post(`/pages/${dragId}/move`, { parentId, position }).catch(() => undefined);
    await invalidate.tree(workspaceId);
  };

  const reset = () => {
    setDragId(null);
    setDropTarget(null);
  };

  const commitRename = async () => {
    if (!renaming) return;
    const { id, value } = renaming;
    setRenaming(null);
    const next = value.trim();
    const original = nodes.find((n) => n.id === id)?.title ?? '';
    if (next === original) return;
    await api.patch(`/pages/${id}`, { title: next }).catch(() => undefined);
    await invalidate.tree(workspaceId);
    invalidate.page(id);
  };

  const renderRow = (item: TreeItem) => {
    const isCollapsed = collapsed.has(item.id);
    const isActive = item.id === activeId;
    const inHoveredSubtree = hoverSubtree === item.id;

    return (
      <div key={item.id}>
        <div
          draggable={canReorder}
          onDragStart={canReorder ? () => setDragId(item.id) : undefined}
          onDragEnd={canReorder ? reset : undefined}
          onDragOver={
            canReorder
              ? (e) => {
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  const y = (e.clientY - r.top) / r.height;
                  const pos: DropPos = y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside';
                  setDropTarget({ id: item.id, pos });
                }
              : undefined
          }
          onDrop={canReorder ? () => onDrop(item) : undefined}
          onClick={(e) => {
            // Ignore the clicks that compose a double-click (rename gesture).
            if (e.detail > 1 || renaming?.id === item.id) return;
            navigate(`/p/${item.id}`);
          }}
          onMouseEnter={() => setHoverSubtree(item.id)}
          onMouseLeave={() => setHoverSubtree(null)}
          className={cn(
            'group relative flex h-[30px] cursor-pointer items-center gap-1 rounded pr-1 text-sm transition',
            isActive ? 'bg-thread-soft text-thread' : 'text-ink-muted hover:bg-surface hover:text-ink',
            dragId === item.id && 'opacity-40',
          )}
          style={{ paddingLeft: item.depth * 16 + 6 }}
        >
          {/* Woven indent guides */}
          {Array.from({ length: item.depth }).map((_, i) => (
            <span
              key={i}
              className="pointer-events-none absolute top-0 h-full w-px"
              style={{
                left: i * 16 + 13,
                background: inHoveredSubtree ? 'var(--thread)' : 'var(--line)',
                opacity: inHoveredSubtree ? 0.4 : 1,
              }}
            />
          ))}

          {isActive && <span className="absolute left-0 top-1 h-[22px] w-[2px] rounded-full bg-thread" />}

          <button
            onClick={(e) => {
              e.stopPropagation();
              toggle(item.id);
            }}
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded text-ink-faint hover:bg-line/60',
              !item.hasChildren && 'invisible',
            )}
          >
            <ChevronRight
              size={13}
              className={cn('transition-transform', !isCollapsed && 'rotate-90')}
            />
          </button>

          <Popover
            trigger={
              <button
                draggable={false}
                onClick={(e) => e.stopPropagation()}
                title="Change icon"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[13px] hover:bg-line/60"
              >
                {item.icon ? (
                  <PageIcon icon={item.icon} size={15} />
                ) : (
                  <FileText size={14} className="text-ink-faint" />
                )}
              </button>
            }
          >
            {(close) => (
              <IconPicker
                workspaceId={workspaceId ?? ''}
                onPick={async (v) => {
                  await api.patch(`/pages/${item.id}`, { icon: v });
                  await invalidate.tree(workspaceId);
                  invalidate.page(item.id);
                  close();
                }}
                onRemove={async () => {
                  await api.patch(`/pages/${item.id}`, { icon: null });
                  await invalidate.tree(workspaceId);
                  invalidate.page(item.id);
                  close();
                }}
              />
            )}
          </Popover>

          {renaming?.id === item.id ? (
            <input
              autoFocus
              value={renaming.value}
              onChange={(e) => setRenaming({ id: item.id, value: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void commitRename();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setRenaming(null);
                }
              }}
              onBlur={() => void commitRename()}
              spellCheck={false}
              className="flex-1 rounded-sm bg-surface px-1 py-0.5 text-sm text-ink outline-none ring-1 ring-thread focus-visible:shadow-none"
            />
          ) : (
            <span
              className="flex-1 truncate"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenaming({ id: item.id, value: item.title });
              }}
              title="Double-click to rename"
            >
              {item.title || 'Untitled'}
            </span>
          )}

          {item.isLocked && <Lock size={11} className="shrink-0 text-ink-faint" />}
          {item.isFavorite && <Star size={11} className="shrink-0 fill-madder text-madder" />}

          <div className="flex h-full shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <PageRowMenu
              pageId={item.id}
              title={item.title}
              isFavorite={item.isFavorite}
              isLocked={item.isLocked}
              onRename={() => setRenaming({ id: item.id, value: item.title })}
              onOpenPeek={onOpenPeek ? () => onOpenPeek(item.id) : undefined}
            >
              <span
                aria-label={`More actions for ${item.title || 'Untitled'}`}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint hover:bg-line/60 hover:text-ink"
              >
                <MoreHorizontal size={14} />
              </span>
            </PageRowMenu>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void createChild(item.id);
              }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint hover:bg-line/60 hover:text-ink"
              aria-label={`Add a page inside ${item.title || 'Untitled'}`}
              title="Add a page inside"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Drop indicators */}
          {dropTarget?.id === item.id && dropTarget.pos === 'before' && (
            <span className="pointer-events-none absolute -top-px left-2 right-2 h-[2px] rounded-full bg-thread" />
          )}
          {dropTarget?.id === item.id && dropTarget.pos === 'after' && (
            <span className="pointer-events-none absolute -bottom-px left-2 right-2 h-[2px] rounded-full bg-thread" />
          )}
          {dropTarget?.id === item.id && dropTarget.pos === 'inside' && (
            <span className="pointer-events-none absolute inset-0 rounded ring-2 ring-inset ring-thread/40" />
          )}
        </div>

        {!isCollapsed && item.children.map(renderRow)}
      </div>
    );
  };

  if (tree.length === 0) {
    return <p className="px-3 py-2 text-xs text-ink-faint">No pages yet.</p>;
  }
  return <div className="space-y-px">{tree.map(renderRow)}</div>;
}

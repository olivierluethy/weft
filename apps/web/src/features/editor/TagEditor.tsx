import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag as TagIcon, X, Plus, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Popover } from '@/components/ui/Popover';
import { cn } from '@/lib/utils';

interface WsTag {
  id: string;
  name: string;
  color: string;
  count?: number;
}

const TAG_CLASS: Record<string, string> = {
  thread: 'bg-thread-soft text-thread',
  madder: 'bg-madder-soft text-madder',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-sunk text-ink-muted',
};
const SWATCH: Record<string, string> = {
  thread: 'bg-thread',
  madder: 'bg-madder',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  neutral: 'bg-ink-faint',
};
const COLORS = ['thread', 'madder', 'ok', 'warn', 'danger', 'neutral'];

const chipClass = (color: string) => TAG_CLASS[color] ?? TAG_CLASS.thread!;

/** Add/remove/create tags on a page. Chips render in their stored colour. */
export function TagEditor({
  page,
  editable,
}: {
  page: { id: string; workspaceId: string; tags: { id: string; name: string; color: string }[] };
  editable: boolean;
}) {
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [color, setColor] = useState('thread');

  const { data } = useQuery({
    queryKey: ['tags', page.workspaceId],
    queryFn: () => api.get<{ tags: WsTag[] }>(`/workspaces/${page.workspaceId}/tags`),
  });
  const allTags = data?.tags ?? [];
  const attached = page.tags ?? [];
  const attachedIds = new Set(attached.map((t) => t.id));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['page', page.id] });
    qc.invalidateQueries({ queryKey: ['tags', page.workspaceId] });
  };
  const attach = async (tagId: string) => {
    await api.post(`/pages/${page.id}/tags/${tagId}`);
    refresh();
  };
  const detach = async (tagId: string) => {
    await api.del(`/pages/${page.id}/tags/${tagId}`);
    refresh();
  };
  const createAndAttach = async () => {
    const name = input.trim();
    if (!name) return;
    const { tag } = await api.post<{ tag: WsTag }>('/tags', {
      workspaceId: page.workspaceId,
      name,
      color,
    });
    await api.post(`/pages/${page.id}/tags/${tag.id}`);
    setInput('');
    refresh();
  };

  const query = input.trim().toLowerCase();
  const suggestions = allTags.filter(
    (t) => !attachedIds.has(t.id) && t.name.toLowerCase().includes(query),
  );
  const exact = allTags.find((t) => t.name.toLowerCase() === query);

  if (!editable && attached.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {attached.map((t) => (
        <span
          key={t.id}
          className={cn('inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs', chipClass(t.color))}
        >
          {t.name}
          {editable && (
            <button
              onClick={() => detach(t.id)}
              className="opacity-60 transition hover:opacity-100"
              aria-label={`Remove ${t.name}`}
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}

      {editable && (
        <Popover
          trigger={
            <button className="inline-flex items-center gap-1 rounded-sm border border-line-strong px-2 py-0.5 text-xs font-medium text-ink-muted transition hover:border-thread hover:text-thread">
              <TagIcon size={11} /> {attached.length === 0 ? 'Add tag' : 'Tag'}
            </button>
          }
        >
          {() => (
            <div className="w-[248px] rounded-md border border-line bg-surface p-2 shadow-md">
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (exact) attach(exact.id);
                    else void createAndAttach();
                  }
                }}
                placeholder="Search or create a tag…"
                className="input mb-2 h-7 text-xs"
              />

              {/* Colour for a new tag */}
              {query && !exact && (
                <div className="mb-2 flex items-center gap-1.5 px-0.5">
                  <span className="text-2xs text-ink-faint">Colour</span>
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      aria-label={c}
                      className={cn(
                        'h-4 w-4 rounded-full ring-offset-1 transition',
                        SWATCH[c],
                        color === c && 'ring-2 ring-ink-faint',
                      )}
                    />
                  ))}
                </div>
              )}

              <div className="max-h-[200px] space-y-0.5 overflow-y-auto">
                {query && !exact && (
                  <button
                    onClick={createAndAttach}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-ink transition hover:bg-sunk"
                  >
                    <Plus size={14} className="text-ink-faint" />
                    Create
                    <span className={cn('rounded-sm px-1.5 py-0.5 text-xs', chipClass(color))}>
                      {input.trim()}
                    </span>
                  </button>
                )}
                {suggestions.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => attach(t.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-ink transition hover:bg-sunk"
                  >
                    <span className={cn('h-2.5 w-2.5 rounded-full', SWATCH[t.color] ?? SWATCH.thread)} />
                    <span className="flex-1 truncate">{t.name}</span>
                    {typeof t.count === 'number' && (
                      <span className="text-xs text-ink-faint">{t.count}</span>
                    )}
                    {attachedIds.has(t.id) && <Check size={13} className="text-thread" />}
                  </button>
                ))}
                {suggestions.length === 0 && !query && (
                  <p className="px-2 py-3 text-center text-xs text-ink-faint">
                    No tags yet — type to create one.
                  </p>
                )}
              </div>
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}

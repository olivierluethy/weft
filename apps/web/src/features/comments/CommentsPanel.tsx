import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { X, Check, Trash2, MessageSquare, CornerDownLeft, RotateCcw } from 'lucide-react';
import type { PublicUser } from '@weft/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import { Portal } from '@/components/ui/Portal';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  body: string;
  blockId: string | null;
  parentId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  author: PublicUser;
}

export function CommentsPanel({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [sending, setSending] = useState(false);

  const { data } = useQuery({
    queryKey: ['comments', pageId],
    queryFn: () => api.get<{ comments: Comment[] }>(`/pages/${pageId}/comments`),
  });
  const comments = data?.comments ?? [];
  const visible = comments.filter((c) => (showResolved ? true : !c.resolvedAt));
  const openCount = comments.filter((c) => !c.resolvedAt).length;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['comments', pageId] });

  const submit = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await api.post('/comments', { pageId, body: body.trim() });
      setBody('');
      invalidate();
    } finally {
      setSending(false);
    }
  };

  const toggleResolve = async (id: string) => {
    await api.post(`/comments/${id}/resolve`);
    invalidate();
  };
  const remove = async (id: string) => {
    await api.del(`/comments/${id}`);
    invalidate();
  };

  return (
    <Portal>
    <div className="fixed right-0 top-0 z-scrim flex h-full w-[340px] max-w-[calc(100vw-1rem)] flex-col border-l border-line bg-surface shadow-lg animate-[slidein_.18s_ease]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-thread" />
          <span className="font-display text-sm font-semibold text-ink">Comments</span>
          {openCount > 0 && (
            <span className="rounded-full bg-thread-soft px-1.5 text-xs text-thread">{openCount}</span>
          )}
        </div>
        <button onClick={onClose} className="text-ink-faint transition hover:text-ink" aria-label="Close">
          <X size={17} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-ink-faint">
            <MessageSquare size={24} className="opacity-40" />
            {showResolved ? 'No comments yet.' : 'No open comments. Start the conversation below.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {visible.map((c) => {
              const mine = c.author.id === user?.id;
              return (
                <div
                  key={c.id}
                  className={cn(
                    'rounded-md border border-line p-2.5',
                    c.resolvedAt ? 'bg-sunk opacity-70' : 'bg-surface',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Avatar name={c.author.name} src={c.author.avatarUrl} size={22} />
                    <span className="text-sm font-medium text-ink">{c.author.name}</span>
                    <span className="ml-auto text-xs text-ink-faint">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-ink">{c.body}</p>
                  <div className="mt-1.5 flex items-center gap-1">
                    <button
                      onClick={() => toggleResolve(c.id)}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-ink-faint transition hover:bg-sunk hover:text-ok"
                    >
                      {c.resolvedAt ? <RotateCcw size={12} /> : <Check size={12} />}
                      {c.resolvedAt ? 'Reopen' : 'Resolve'}
                    </button>
                    {mine && (
                      <button
                        onClick={() => remove(c.id)}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-ink-faint transition hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        {comments.some((c) => c.resolvedAt) && (
          <button
            onClick={() => setShowResolved((v) => !v)}
            className="mb-2 text-xs text-ink-faint hover:text-ink"
          >
            {showResolved ? 'Hide resolved' : 'Show resolved'}
          </button>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={2}
            placeholder="Add a comment…"
            className="input min-h-[38px] flex-1 resize-none py-2"
          />
          <button
            onClick={submit}
            disabled={!body.trim() || sending}
            className="btn btn-primary h-[38px] px-2.5"
            title="Comment (⌘↵)"
          >
            <CornerDownLeft size={15} />
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { useWorkspace } from './workspace';
import { useInvalidate } from '@/lib/queries';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button, IconButton } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

interface TrashPage {
  id: string;
  title: string;
  icon: string | null;
  deletedAt: string;
}

export default function TrashView() {
  const navigate = useNavigate();
  const { workspaceId } = useWorkspace();
  const invalidate = useInvalidate();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trash', workspaceId],
    enabled: !!workspaceId,
    queryFn: () => api.get<{ pages: TrashPage[] }>(`/workspaces/${workspaceId}/trash`),
  });

  const pages = data?.pages ?? [];

  const restore = async (page: TrashPage) => {
    setBusyId(page.id);
    try {
      await api.post(`/pages/${page.id}/restore`);
      await Promise.all([invalidate.tree(workspaceId), refetch()]);
      toast.success(`Restored “${page.title || 'Untitled'}”`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not restore page');
    } finally {
      setBusyId(null);
    }
  };

  const deleteForever = async (page: TrashPage) => {
    const confirmed = window.confirm(
      `Permanently delete “${page.title || 'Untitled'}”? This cannot be undone.`,
    );
    if (!confirmed) return;
    setBusyId(page.id);
    try {
      await api.del(`/pages/${page.id}/permanent`);
      await refetch();
      toast.success('Deleted forever');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete page');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-paper">
      <header className="flex items-center gap-3 border-b border-line px-5 py-3">
        <IconButton label="Back" onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
        </IconButton>
        <div className="min-w-0">
          <h1 className="font-display text-lg font-semibold leading-tight text-ink">Trash</h1>
          <p className="text-xs text-ink-muted">
            Deleted pages are kept here. Restore or delete forever.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-[720px]">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : pages.length === 0 ? (
            <div className="flex justify-center py-16">
              <p className="text-sm text-ink-faint">Trash is empty.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-line bg-surface">
              {pages.map((page, i) => (
                <div
                  key={page.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    i > 0 ? 'border-t border-line' : ''
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[15px]">
                    {page.icon || <Trash2 size={15} className="text-ink-faint" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{page.title || 'Untitled'}</p>
                    <p className="text-xs text-ink-faint">
                      deleted {formatDistanceToNow(new Date(page.deletedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busyId === page.id}
                      disabled={busyId !== null}
                      onClick={() => restore(page)}
                    >
                      <RotateCcw size={14} />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId !== null}
                      className="text-danger hover:bg-danger-soft hover:text-danger"
                      onClick={() => deleteForever(page)}
                    >
                      <Trash2 size={14} />
                      Delete forever
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

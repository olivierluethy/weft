import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Copy, Trash2, Globe } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

interface ShareLink {
  id: string;
  token: string;
  permission: string;
  includeChildren: boolean;
}

export function ShareDialog({
  pageId,
  onClose,
}: {
  pageId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['share', pageId],
    queryFn: () => api.get<{ links: ShareLink[] }>(`/pages/${pageId}/share`),
  });
  const links = data?.links ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['share', pageId] });

  const create = async () => {
    await api.post('/share', { pageId, permission: 'view', includeChildren: true });
    invalidate();
    toast.success('Public link created');
  };

  const revoke = async (id: string) => {
    await api.del(`/share/${id}`);
    invalidate();
    toast.info('Link revoked');
  };

  const copy = (token: string) => {
    void navigator.clipboard.writeText(`${location.origin}/share/${token}`);
    toast.success('Link copied');
  };

  return (
    <Modal open onClose={onClose} title="Share this page" width="sm">
      <p className="mb-4 text-sm text-ink-muted">
        Anyone with a public link can read this page (and its sub-pages) — no account needed.
      </p>

      {links.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-strong bg-sunk px-4 py-6 text-center">
          <Globe className="mx-auto mb-2 text-ink-faint" size={22} />
          <p className="mb-3 text-sm text-ink-muted">This page is private.</p>
          <Button variant="primary" onClick={create}>
            <Link2 size={15} /> Create public link
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-2 rounded-md border border-line bg-surface p-2">
              <Globe size={15} className="shrink-0 text-thread" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted">
                /share/{link.token}
              </span>
              <button
                onClick={() => copy(link.token)}
                className="rounded p-1.5 text-ink-faint transition hover:bg-sunk hover:text-ink"
                title="Copy link"
              >
                <Copy size={15} />
              </button>
              <button
                onClick={() => revoke(link.id)}
                className="rounded p-1.5 text-ink-faint transition hover:bg-danger-soft hover:text-danger"
                title="Revoke"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button onClick={create} className="text-sm text-thread hover:underline">
            + Create another link
          </button>
        </div>
      )}
    </Modal>
  );
}

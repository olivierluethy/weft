import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Clock, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from './workspace';
import { useTree } from '@/lib/queries';
import { api } from '@/lib/api';
import { Logo } from '@/components/Logo';

export function HomeView() {
  const { user, workspaces } = useAuth();
  const { workspaceId } = useWorkspace();
  const { data: tree } = useTree(workspaceId);
  const navigate = useNavigate();
  const ws = workspaces.find((w) => w.id === workspaceId);

  const recents = [...(tree ?? [])]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 8);
  const favorites = (tree ?? []).filter((n) => n.isFavorite).slice(0, 6);

  const newPage = async () => {
    const res = await api.post<{ page: { id: string } }>('/pages', { workspaceId });
    navigate(`/p/${res.page.id}`);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-16">
        <div className="mb-10 flex items-center gap-3">
          <Logo size={40} />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
              {greeting}, {user?.name.split(' ')[0]}
            </h1>
            <p className="text-sm text-ink-muted">{ws?.name}</p>
          </div>
        </div>

        <button
          onClick={newPage}
          className="mb-10 flex w-full items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-3 text-left text-sm text-ink-muted transition hover:border-thread hover:text-thread"
        >
          <Plus size={18} /> Create a new page
        </button>

        {favorites.length > 0 && (
          <Section icon={<Star size={15} className="fill-madder text-madder" />} title="Favorites">
            {favorites.map((p) => (
              <PageCard key={p.id} p={p} onClick={() => navigate(`/p/${p.id}`)} />
            ))}
          </Section>
        )}

        <Section icon={<Clock size={15} />} title="Recently edited">
          {recents.length === 0 ? (
            <p className="col-span-full text-sm text-ink-faint">
              No pages yet — create your first one above.
            </p>
          ) : (
            recents.map((p) => <PageCard key={p.id} p={p} onClick={() => navigate(`/p/${p.id}`)} />)
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
        {icon} {title}
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function PageCard({
  p,
  onClick,
}: {
  p: { id: string; title: string; icon: string | null; updatedAt: string };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card flex flex-col gap-2 p-3.5 text-left transition hover:shadow-md hover:-translate-y-px"
    >
      <span className="text-xl">{p.icon || <FileText size={18} className="text-ink-faint" />}</span>
      <span className="truncate text-sm font-medium text-ink">{p.title || 'Untitled'}</span>
      <span className="text-xs text-ink-faint">
        {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
      </span>
    </button>
  );
}

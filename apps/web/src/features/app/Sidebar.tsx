import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Star,
  Trash2,
  Share2,
  Network,
  Settings,
  ChevronsUpDown,
  Check,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useThemeStore } from '@/hooks/useTheme';
import { useWorkspace } from './workspace';
import { useTree } from '@/lib/queries';
import { api } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { Menu } from '@/components/ui/Menu';
import { PageTree } from './PageTree';
import { toast } from '@/lib/toast';
import { useState } from 'react';

export function Sidebar({
  width,
  onWidthChange,
  onOpenPalette,
}: {
  width: number;
  onWidthChange: (w: number) => void;
  onOpenPalette: () => void;
}) {
  const { user, workspaces, logout } = useAuth();
  const { workspaceId, setWorkspaceId } = useWorkspace();
  const { data: tree } = useTree(workspaceId);
  const { theme, cycle } = useThemeStore();
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);

  const activeWs = workspaces.find((w) => w.id === workspaceId);
  const favorites = (tree ?? []).filter((n) => n.isFavorite);

  const newPage = async () => {
    const res = await api.post<{ page: { id: string } }>('/pages', { workspaceId });
    navigate(`/p/${res.page.id}`);
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startW = width;
    const move = (ev: MouseEvent) => {
      const w = Math.min(420, Math.max(220, startW + ev.clientX - startX));
      onWidthChange(w);
    };
    const up = () => {
      setDragging(false);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <aside
      className="relative flex shrink-0 flex-col border-r border-line bg-sunk"
      style={{ width }}
    >
      {/* Workspace switcher */}
      <div className="flex items-center gap-1 px-3 pt-3">
        <Menu
          align="start"
          trigger={
            <button className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left transition hover:bg-surface">
              <Logo size={22} />
              <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-ink">
                {activeWs?.name ?? 'Weft'}
              </span>
              <ChevronsUpDown size={14} className="shrink-0 text-ink-faint" />
            </button>
          }
          items={[
            ...workspaces.map((w) => ({
              label: w.name,
              icon: w.id === workspaceId ? <Check size={15} className="text-thread" /> : <span />,
              onClick: () => {
                setWorkspaceId(w.id);
                navigate('/');
              },
            })),
            { divider: true, label: '' },
            {
              label: 'New workspace',
              icon: <Plus size={15} />,
              onClick: async () => {
                const name = prompt('Workspace name?');
                if (!name) return;
                const res = await api.post<{ workspace: { id: string } }>('/workspaces', { name });
                setWorkspaceId(res.workspace.id);
                toast.success('Workspace created');
                navigate('/');
              },
            },
          ]}
        />
      </div>

      {/* Search + new */}
      <div className="flex items-center gap-1 px-3 pt-2">
        <button
          onClick={onOpenPalette}
          className="flex flex-1 items-center gap-2 rounded border border-line bg-surface px-2.5 py-1.5 text-sm text-ink-faint transition hover:border-line-strong"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Search</span>
          <span className="kbd">⌘K</span>
        </button>
      </div>

      {/* Scroll area */}
      <div className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
        <button
          onClick={newPage}
          className="mb-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-ink-muted transition hover:bg-surface hover:text-ink"
        >
          <Plus size={15} /> New page
        </button>

        {favorites.length > 0 && (
          <div className="mb-2">
            <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
              Favorites
            </p>
            {favorites.map((f) => (
              <button
                key={f.id}
                onClick={() => navigate(`/p/${f.id}`)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm text-ink-muted transition hover:bg-surface hover:text-ink"
              >
                <span className="flex h-4 w-4 items-center justify-center text-[13px]">
                  {f.icon || <Star size={13} className="fill-madder text-madder" />}
                </span>
                <span className="truncate">{f.title || 'Untitled'}</span>
              </button>
            ))}
          </div>
        )}

        <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
          Pages
        </p>
        <PageTree nodes={tree ?? []} />
      </div>

      {/* Footer nav */}
      <div className="border-t border-line px-2 py-2">
        <FooterLink icon={<Network size={15} />} label="Graph view" onClick={() => navigate('/graph')} />
        <FooterLink icon={<Users size={15} />} label="Members" onClick={() => navigate('/members')} />
        <FooterLink icon={<Trash2 size={15} />} label="Trash" onClick={() => navigate('/trash')} />

        <Menu
          align="start"
          trigger={
            <button className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition hover:bg-surface">
              <Avatar name={user?.name ?? '?'} src={user?.avatarUrl} size={24} />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{user?.name}</span>
            </button>
          }
          items={[
            { label: 'Settings & account', icon: <Settings size={15} />, onClick: () => navigate('/settings') },
            {
              label: `Theme: ${theme}`,
              icon: <ThemeIcon size={15} />,
              onClick: cycle,
            },
            { label: 'Share current page', icon: <Share2 size={15} />, onClick: () => toast.info('Open a page, then use Share in its header.') },
            { divider: true, label: '' },
            { label: 'Log out', icon: <LogOut size={15} />, danger: true, onClick: () => void logout() },
          ]}
        />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className={`absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize ${dragging ? 'bg-thread/20' : ''}`}
      />
    </aside>
  );
}

function FooterLink({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-ink-muted transition hover:bg-surface hover:text-ink"
    >
      {icon} {label}
    </button>
  );
}

import { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { PanelLeft } from 'lucide-react';
import { WorkspaceProvider, useWorkspace } from './workspace';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { GlobalStyles } from './GlobalStyles';
import { useWorkspaceMeta } from '@/lib/queries';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { PageView } from '@/features/editor/PageView';
import { HomeView } from './HomeView';

const SidePeek = lazy(() =>
  import('@/features/editor/SidePeek').then((m) => ({ default: m.SidePeek })),
);
const SettingsView = lazy(() => import('@/features/settings/SettingsView'));
const GraphView = lazy(() => import('@/features/graph/GraphView'));
const TrashView = lazy(() => import('@/features/app/TrashView'));
const MembersView = lazy(() => import('@/features/workspace/MembersView'));

function Shell() {
  const { workspaceId } = useWorkspace();
  const { data: meta } = useWorkspaceMeta(workspaceId);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    Number(localStorage.getItem('weft-sidebar-w') || 280),
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('weft-sidebar-collapsed') === '1',
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [peekId, setPeekId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const location = useLocation();

  const setCollapsedPersist = (v: boolean) => {
    setCollapsed(v);
    localStorage.setItem('weft-sidebar-collapsed', v ? '1' : '0');
  };

  // Close the mobile drawer + any side peek whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
    setPeekId(null);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sidebarVisible = isMobile ? mobileOpen : !collapsed;

  return (
    <div className="flex h-full overflow-hidden bg-paper">
      {/* Workspace + page global CSS injected live and scoped by GlobalStyles. */}
      <GlobalStyles css={meta?.workspace.globalCss ?? null} scope="workspace" />

      {/* Mobile drawer backdrop */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[rgba(33,31,28,.4)] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={cn(
          'h-full',
          isMobile && 'fixed left-0 top-0 z-40 transition-transform duration-200',
          isMobile && (mobileOpen ? 'translate-x-0' : '-translate-x-full'),
          !isMobile && !sidebarVisible && 'hidden',
        )}
      >
        <Sidebar
          width={isMobile ? 300 : sidebarWidth}
          onWidthChange={(w) => {
            setSidebarWidth(w);
            localStorage.setItem('weft-sidebar-w', String(w));
          }}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenPeek={setPeekId}
          mobile={isMobile}
          onCollapse={() => (isMobile ? setMobileOpen(false) : setCollapsedPersist(true))}
        />
      </div>

      {/* Floating reopen affordance when the sidebar is hidden */}
      {!sidebarVisible && (
        <button
          onClick={() => (isMobile ? setMobileOpen(true) : setCollapsedPersist(false))}
          aria-label="Open sidebar"
          title="Open sidebar"
          className="fixed left-2.5 top-2.5 z-30 flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-ink-muted shadow-sm transition hover:text-ink"
        >
          <PanelLeft size={17} />
        </button>
      )}

      <main className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <Routes>
            <Route index element={<HomeView />} />
            <Route path="p/:pageId" element={<PageView />} />
            <Route path="w/:workspaceId" element={<HomeView />} />
            <Route path="settings/*" element={<SettingsView />} />
            <Route path="graph" element={<GraphView />} />
            <Route path="trash" element={<TrashView />} />
            <Route path="members" element={<MembersView />} />
            <Route path="*" element={<HomeView />} />
          </Routes>
        </Suspense>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {peekId && (
        <Suspense fallback={null}>
          <SidePeek pageId={peekId} onClose={() => setPeekId(null)} />
        </Suspense>
      )}
    </div>
  );
}

export default function AppShell() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}

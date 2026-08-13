import { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { WorkspaceProvider, useWorkspace } from './workspace';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { GlobalStyles } from './GlobalStyles';
import { useWorkspaceMeta } from '@/lib/queries';
import { Spinner } from '@/components/ui/Spinner';
import { PageView } from '@/features/editor/PageView';
import { HomeView } from './HomeView';

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

  return (
    <div className="flex h-full overflow-hidden bg-paper">
      {/* Workspace + page global CSS injected live and scoped by GlobalStyles. */}
      <GlobalStyles css={meta?.workspace.globalCss ?? null} scope="workspace" />

      <Sidebar
        width={sidebarWidth}
        onWidthChange={(w) => {
          setSidebarWidth(w);
          localStorage.setItem('weft-sidebar-w', String(w));
        }}
        onOpenPalette={() => setPaletteOpen(true)}
      />

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

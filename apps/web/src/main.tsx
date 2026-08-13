import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { App } from './App';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from '@/components/ui/Toaster';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
  },
});

// NOTE: intentionally NOT wrapped in <StrictMode>. Its dev-only double-mount
// tears down and recreates the collaborative editor's ProseMirror view, which
// leaves the y-prosemirror UndoManager's `afterTransaction` handler detached
// from the Yjs doc — so the live UndoManager never captures edits and Ctrl+Z
// (undo/redo) silently does nothing. Removing StrictMode restores undo. It only
// affects dev double-invocation; production behaviour is unchanged.
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>,
);

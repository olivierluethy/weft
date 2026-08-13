import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useThemeEffect } from '@/hooks/useTheme';
import { FullScreenLoader } from '@/components/ui/Spinner';

import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { InvitePage } from '@/features/auth/InvitePage';

const AppShell = lazy(() => import('@/features/app/AppShell'));
const PublicPage = lazy(() => import('@/features/share/PublicPage'));

export function App() {
  useThemeEffect();
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        {/* Public, shareable read-only view */}
        <Route path="/share/:token" element={<PublicPage />} />

        {/* Auth */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/invite" element={<InvitePage />} />

        {/* App (requires auth) */}
        <Route
          path="/*"
          element={user ? <AppShell /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </Suspense>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';
import { toast } from '@/lib/toast';

export function InvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accept = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ workspaceId: string }>('/invites/accept', { token });
      await refresh();
      toast.success('Invitation accepted');
      navigate(`/w/${res.workspaceId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept invite');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user && token) {
      // Preserve the token through login/registration.
      sessionStorage.setItem('weft-invite', token);
    }
  }, [user, token]);

  return (
    <AuthLayout title="Workspace invitation" subtitle="You've been invited to collaborate on Weft.">
      {error && (
        <div className="mb-4 rounded border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
      {!user ? (
        <p className="text-sm text-ink-muted">
          Please{' '}
          <Link to="/login" className="font-medium text-thread hover:underline">
            log in
          </Link>{' '}
          or{' '}
          <Link to="/register" className="font-medium text-thread hover:underline">
            create an account
          </Link>{' '}
          to accept this invitation.
        </p>
      ) : (
        <Button variant="primary" size="lg" className="w-full" loading={loading} onClick={accept}>
          Accept invitation
        </Button>
      )}
    </AuthLayout>
  );
}

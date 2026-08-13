import { useState, type FormEvent } from 'react';
import type { PublicUser } from '@weft/shared';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';

export function AccountPanel() {
  const { user, refresh } = useAuth();

  // Email form
  const [email, setEmail] = useState(user?.email ?? '');
  const [emailPassword, setEmailPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (savingEmail) return;
    setSavingEmail(true);
    try {
      await api.patch<{ user: PublicUser }>('/account/email', {
        email: email.trim(),
        currentPassword: emailPassword,
      });
      await refresh();
      setEmailPassword('');
      toast.success('Email address updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update email');
    } finally {
      setSavingEmail(false);
    }
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (savingPassword) return;
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await api.patch<{ ok: true }>('/account/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Account</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Manage the credentials you use to sign in.
        </p>
      </div>

      {/* Change email */}
      <section className="card p-5">
        <h3 className="font-display text-base font-semibold text-ink">Email address</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Changing your email requires your current password.
        </p>
        <form onSubmit={submitEmail} className="mt-4 space-y-4">
          <div>
            <label className="field-label" htmlFor="account-email">
              Email
            </label>
            <input
              id="account-email"
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="account-email-password">
              Current password
            </label>
            <input
              id="account-email-password"
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              loading={savingEmail}
              disabled={email.trim() === user.email || !emailPassword}
            >
              Update email
            </Button>
          </div>
        </form>
      </section>

      {/* Change password */}
      <section className="card p-5">
        <h3 className="font-display text-base font-semibold text-ink">Password</h3>
        <p className="mt-1 text-sm text-ink-muted">Use at least 8 characters.</p>
        <form onSubmit={submitPassword} className="mt-4 space-y-4">
          <div>
            <label className="field-label" htmlFor="account-current-password">
              Current password
            </label>
            <input
              id="account-current-password"
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="account-new-password">
              New password
            </label>
            <input
              id="account-new-password"
              className="input"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="account-confirm-password">
              Confirm new password
            </label>
            <input
              id="account-confirm-password"
              className="input"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              loading={savingPassword}
              disabled={!currentPassword || !newPassword}
            >
              Change password
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

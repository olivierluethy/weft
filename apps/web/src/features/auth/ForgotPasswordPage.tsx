import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Button } from '@/components/ui/Button';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await api.post('/auth/forgot', { email }).catch(() => undefined);
    setSent(true);
    setLoading(false);
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll send you a link to choose a new one."
      footer={
        <Link to="/login" className="font-medium text-thread hover:underline">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-md border border-line bg-sunk px-4 py-3.5 text-sm text-ink-muted">
          If an account exists for <span className="font-medium text-ink">{email}</span>, a reset
          link is on its way.
          <p className="mt-2 text-xs">
            No SMTP configured? The link is printed in the server console and saved to{' '}
            <code className="font-mono text-thread">apps/server/data/outbox/outbox.log</code>.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="field-label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

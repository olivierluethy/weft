import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone, MapPin, Clock, LogOut } from 'lucide-react';
import type { SessionView, LoginEventView } from '@weft/shared';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

const KIND_LABEL: Record<string, string> = {
  login: 'Signed in',
  logout: 'Signed out',
  failed: 'Failed sign-in',
  register: 'Account created',
  reset: 'Password reset',
  revoke: 'Session revoked',
};

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

function kindDot(event: LoginEventView): string {
  if (event.kind === 'failed' || !event.success) return 'bg-danger';
  if (event.kind === 'login' || event.kind === 'register') return 'bg-ok';
  return 'bg-ink-faint';
}

export function SessionsPanel() {
  const queryClient = useQueryClient();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<{ sessions: SessionView[] }>('/sessions'),
  });
  const log = useQuery({
    queryKey: ['sessions', 'log'],
    queryFn: () => api.get<{ events: LoginEventView[] }>('/sessions/log'),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['sessions'] });
  };

  const revoke = async (id: string) => {
    setRevokingId(id);
    try {
      await api.del<{ ok: true }>(`/sessions/${id}`);
      toast.success('Session revoked');
      invalidate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not revoke session');
    } finally {
      setRevokingId(null);
    }
  };

  const revokeOthers = async () => {
    setRevokingOthers(true);
    try {
      await api.post<{ ok: true }>('/sessions/revoke-others');
      toast.success('Signed out of all other sessions');
      invalidate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not sign out other sessions');
    } finally {
      setRevokingOthers(false);
    }
  };

  const sessionList = sessions.data?.sessions ?? [];
  const events = log.data?.events ?? [];
  const hasOthers = sessionList.some((s) => !s.current);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Sessions &amp; security</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Review where you&apos;re signed in and your recent activity.
        </p>
      </div>

      {/* Active sessions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-ink">Active sessions</h3>
          {hasOthers && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={revokingOthers}
              onClick={revokeOthers}
            >
              <LogOut size={15} />
              Log out all other sessions
            </Button>
          )}
        </div>

        {sessions.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : sessions.isError ? (
          <p className="text-sm text-danger">Could not load sessions.</p>
        ) : sessionList.length === 0 ? (
          <p className="text-sm text-ink-muted">No active sessions.</p>
        ) : (
          <ul className="space-y-2">
            {sessionList.map((s) => {
              const DeviceIcon = /phone|mobile|android|ios/i.test(s.device)
                ? Smartphone
                : Monitor;
              return (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-4 rounded-md border border-line bg-surface p-4"
                >
                  <div className="flex gap-3">
                    <span className="mt-0.5 text-ink-muted">
                      <DeviceIcon size={18} />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">
                          {s.browser} · {s.os}
                        </span>
                        {s.current && (
                          <span className="rounded-full bg-thread-soft px-2 py-0.5 text-2xs font-medium text-thread">
                            This device
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={13} />
                          {s.location || 'Unknown location'}
                        </span>
                        <span className="font-mono text-ink-faint">{s.ip}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} />
                          Last active {s.lastSeenAt}
                        </span>
                        <span>Signed in {s.createdAt}</span>
                      </div>
                    </div>
                  </div>
                  {!s.current && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger-soft hover:text-danger"
                      loading={revokingId === s.id}
                      onClick={() => revoke(s.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Login history */}
      <section className="space-y-3">
        <h3 className="font-display text-base font-semibold text-ink">Login history</h3>
        {log.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : log.isError ? (
          <p className="text-sm text-danger">Could not load login history.</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-ink-muted">No recent activity.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-line bg-surface">
            <ul className="divide-y divide-line">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-xs"
                >
                  <span className="inline-flex min-w-[130px] items-center gap-2 text-sm text-ink">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', kindDot(event))} />
                    {kindLabel(event.kind)}
                  </span>
                  <span className="text-ink-muted">
                    {event.browser} · {event.os}
                  </span>
                  <span className="text-ink-muted">{event.location || 'Unknown'}</span>
                  <span className="ml-auto text-ink-faint">{event.createdAt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

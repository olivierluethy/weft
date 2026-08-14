import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, UserPlus, Users, Mail, Info } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/features/app/workspace';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

type Role = 'owner' | 'editor' | 'viewer';
const ROLES: Role[] = ['owner', 'editor', 'viewer'];

interface Member {
  role: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    createdAt: string;
  };
}
interface Invite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

function cap(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function MembersView() {
  const navigate = useNavigate();
  const { user, workspaces } = useAuth();
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();

  const isOwner = workspaces.find((w) => w.id === workspaceId)?.role === 'owner';

  const membersQuery = useQuery({
    queryKey: ['members', workspaceId],
    enabled: !!workspaceId,
    queryFn: () => api.get<{ members: Member[] }>(`/workspaces/${workspaceId}/members`),
  });

  const invitesQuery = useQuery({
    queryKey: ['invites', workspaceId],
    enabled: !!workspaceId && isOwner,
    queryFn: () => api.get<{ invites: Invite[] }>(`/workspaces/${workspaceId}/invites`),
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  const invalidateMembers = () => qc.invalidateQueries({ queryKey: ['members', workspaceId] });
  const invalidateInvites = () => qc.invalidateQueries({ queryKey: ['invites', workspaceId] });

  const changeRole = async (userId: string, role: Role) => {
    try {
      await api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role });
      await invalidateMembers();
      toast.success('Role updated');
    } catch (err) {
      toast.error(errMessage(err, 'Could not update role'));
    }
  };

  const removeMember = async (userId: string) => {
    setRemoving(null);
    try {
      await api.del(`/workspaces/${workspaceId}/members/${userId}`);
      await invalidateMembers();
      toast.success('Member removed');
    } catch (err) {
      toast.error(errMessage(err, 'Could not remove member'));
    }
  };

  const revokeInvite = async (id: string) => {
    try {
      await api.del(`/invites/${id}`);
      await invalidateInvites();
      toast.success('Invitation revoked');
    } catch (err) {
      toast.error(errMessage(err, 'Could not revoke invitation'));
    }
  };

  const members = membersQuery.data?.members ?? [];
  const invites = invitesQuery.data?.invites ?? [];

  return (
    <div className="h-full overflow-y-auto bg-paper">
      <div className="mx-auto max-w-[820px] px-6 py-10">
        {/* Header */}
        <button
          onClick={() => navigate('/')}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-ink">
              <Users size={22} className="text-ink-muted" /> Members
            </h1>
            <p className="mt-1 text-sm text-ink-muted">People with access to this workspace</p>
          </div>
          {isOwner && (
            <Button variant="primary" onClick={() => setInviteOpen(true)}>
              <UserPlus size={15} /> Invite people
            </Button>
          )}
        </div>

        {/* Members list */}
        <div className="card overflow-hidden">
          {membersQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-faint">
              <Spinner /> Loading members…
            </div>
          ) : membersQuery.isError ? (
            <div className="px-4 py-10 text-center text-sm text-danger">
              {errMessage(membersQuery.error, 'Could not load members')}
            </div>
          ) : members.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-ink-faint">No members yet.</div>
          ) : (
            <ul className="divide-y divide-line">
              {members.map((m) => (
                <li key={m.user.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={m.user.name} src={m.user.avatarUrl} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {m.user.name}
                      {m.user.id === user?.id && (
                        <span className="ml-1.5 text-xs font-normal text-ink-faint">(You)</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-faint">{m.user.email}</p>
                  </div>
                  {isOwner && m.role !== 'owner' ? (
                    <Menu
                      align="end"
                      trigger={
                        <button className="inline-flex items-center gap-1 rounded border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:text-ink">
                          {cap(m.role)}
                          <ChevronDown size={13} />
                        </button>
                      }
                      items={[
                        ...ROLES.map((r) => ({
                          label: cap(r),
                          checked: m.role === r,
                          onClick: () => {
                            if (m.role !== r) void changeRole(m.user.id, r);
                          },
                        })),
                        { divider: true, label: '' },
                        {
                          label: 'Remove from workspace',
                          danger: true,
                          onClick: () => setRemoving({ id: m.user.id, name: m.user.name }),
                        },
                      ]}
                    />
                  ) : (
                    <span className="rounded-sm bg-sunk px-2 py-1 text-xs font-medium text-ink-muted">
                      {cap(m.role)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending invitations (owner only) */}
        {isOwner && (
          <div className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
              <Mail size={14} /> Pending invitations
            </h2>
            <div className="card overflow-hidden">
              {invitesQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-faint">
                  <Spinner /> Loading…
                </div>
              ) : invites.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-ink-faint">
                  No pending invitations.
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {invites.map((inv) => (
                    <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-thread-soft text-thread">
                        <Mail size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{inv.email}</p>
                        <p className="truncate text-xs text-ink-faint">Invited as {cap(inv.role)}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => void revokeInvite(inv.id)}>
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-2.5 flex items-start gap-1.5 text-xs text-ink-faint">
              <Info size={13} className="mt-0.5 shrink-0" />
              <span>
                With no SMTP configured, invite links are printed to the server console and to{' '}
                <code className="rounded-sm bg-sunk px-1 py-0.5 font-mono text-[11px]">
                  apps/server/data/outbox/outbox.log
                </code>
                .
              </span>
            </p>
          </div>
        )}
      </div>

      {isOwner && (
        <InviteModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          workspaceId={workspaceId}
          onInvited={() => void invalidateInvites()}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        danger
        title="Remove member?"
        message={
          <p>
            <span className="font-medium text-ink">{removing?.name}</span> will lose access to this
            workspace. You can invite them again later.
          </p>
        }
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && void removeMember(removing.id)}
      />
    </div>
  );
}

function InviteModal({
  open,
  onClose,
  workspaceId,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string | null;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEmail('');
    setRole('editor');
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error('Enter an email address');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/invites`, { email: trimmed, role });
      toast.success('Invitation sent');
      onInvited();
      reset();
      onClose();
    } catch (err) {
      toast.error(errMessage(err, 'Could not send invitation'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Invite people"
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={submitting}>
            Send invitation
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <label className="field-label" htmlFor="invite-email">
            Email address
          </label>
          <input
            id="invite-email"
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            className="input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="invite-role">
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={cn('input', 'cursor-pointer')}
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        <p className="flex items-start gap-1.5 text-xs text-ink-faint">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            The invite link is printed to the server console and{' '}
            <code className="rounded-sm bg-sunk px-1 py-0.5 font-mono text-[11px]">
              apps/server/data/outbox/outbox.log
            </code>{' '}
            when SMTP is not configured.
          </span>
        </p>
        {/* Allow implicit submit via Enter without a visible button. */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

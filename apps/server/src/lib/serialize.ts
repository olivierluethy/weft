import type { PublicUser, SessionView, LoginEventView } from '@weft/shared';
import { formatDistanceToNow, format } from 'date-fns';

export function publicUser(u: {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.toISOString(),
  };
}

export function sessionView(
  s: {
    id: string;
    device: string | null;
    browser: string | null;
    os: string | null;
    ip: string | null;
    location: string | null;
    remember: boolean;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
  },
  currentSessionId: string,
): SessionView {
  return {
    id: s.id,
    current: s.id === currentSessionId,
    device: s.device ?? 'Unknown device',
    browser: s.browser ?? 'Unknown',
    os: s.os ?? 'Unknown',
    ip: s.ip ?? '—',
    location: s.location ?? 'Unknown location',
    remember: s.remember,
    createdAt: format(s.createdAt, "d MMM yyyy 'at' HH:mm"),
    lastSeenAt: formatDistanceToNow(s.lastSeenAt, { addSuffix: true }),
    expiresAt: format(s.expiresAt, 'd MMM yyyy'),
  };
}

export function loginEventView(e: {
  id: string;
  kind: string;
  success: boolean;
  device: string | null;
  browser: string | null;
  os: string | null;
  ip: string | null;
  location: string | null;
  createdAt: Date;
}): LoginEventView {
  return {
    id: e.id,
    kind: e.kind,
    success: e.success,
    device: e.device ?? 'Unknown device',
    browser: e.browser ?? 'Unknown',
    os: e.os ?? 'Unknown',
    ip: e.ip ?? '—',
    location: e.location ?? 'Unknown location',
    createdAt: format(e.createdAt, "d MMM yyyy 'at' HH:mm"),
  };
}

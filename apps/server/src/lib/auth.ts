import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { addDays } from 'date-fns';
import { prisma } from '../db.js';
import { env, COOKIE } from '../env.js';
import { randomToken, sha256 } from './crypto.js';
import { parseUserAgent } from './ua.js';
import { geolocate } from './geo.js';
import { clientIp } from './http.js';

export interface AccessClaims {
  sub: string; // userId
  sid: string; // sessionId
}

const cookieBase = {
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: env.cookieSecure,
  path: '/',
};

function refreshDays(remember: boolean): number {
  return remember ? env.refreshTtlDaysRemember : env.refreshTtlDays;
}

/** Create a session row + set access/refresh cookies. Records device + geo. */
export async function issueSession(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  remember: boolean,
): Promise<{ sessionId: string }> {
  const ua = req.headers['user-agent'];
  const info = parseUserAgent(ua);
  const ip = clientIp(req);
  const location = await geolocate(ip);
  const raw = randomToken();
  const expiresAt = addDays(new Date(), refreshDays(remember));

  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: sha256(raw),
      remember,
      userAgent: typeof ua === 'string' ? ua : null,
      device: info.device,
      browser: info.browser,
      os: info.os,
      ip,
      location,
      expiresAt,
    },
  });

  setAuthCookies(app, reply, userId, session.id, raw, remember);
  return { sessionId: session.id };
}

export function setAuthCookies(
  app: FastifyInstance,
  reply: FastifyReply,
  userId: string,
  sessionId: string,
  refreshRaw: string,
  remember: boolean,
): void {
  const accessToken = app.jwt.sign({ sub: userId, sid: sessionId } satisfies AccessClaims, {
    expiresIn: env.accessTtl,
  });
  const maxAge = refreshDays(remember) * 24 * 60 * 60;
  reply.setCookie(COOKIE.access, accessToken, { ...cookieBase, maxAge });
  reply.setCookie(COOKIE.refresh, `${sessionId}.${refreshRaw}`, { ...cookieBase, maxAge });
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(COOKIE.access, { ...cookieBase });
  reply.clearCookie(COOKIE.refresh, { ...cookieBase });
}

/** Verify a refresh cookie, rotate the token, and re-issue cookies. Returns the
 * userId + sessionId on success or null if the refresh token is invalid/expired. */
export async function rotateSession(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<{ userId: string; sessionId: string } | null> {
  const cookie = req.cookies[COOKIE.refresh];
  if (!cookie) return null;
  const dot = cookie.indexOf('.');
  if (dot < 0) return null;
  const sessionId = cookie.slice(0, dot);
  const raw = cookie.slice(dot + 1);

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt < new Date() ||
    session.refreshTokenHash !== sha256(raw)
  ) {
    return null;
  }

  const newRaw = randomToken();
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash: sha256(newRaw), lastSeenAt: new Date() },
  });
  setAuthCookies(app, reply, session.userId, session.id, newRaw, session.remember);
  return { userId: session.userId, sessionId: session.id };
}

import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db.js';
import { COOKIE } from '../env.js';
import { rotateSession, type AccessClaims } from '../lib/auth.js';
import { unauthorized } from '../lib/http.js';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: { id: string; sessionId: string };
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Try to resolve the current user from the access cookie, transparently
 * refreshing via the rotating refresh token when the access token has expired. */
async function resolve(
  app: import('fastify').FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<{ id: string; sessionId: string } | null> {
  const token = req.cookies[COOKIE.access];
  if (token) {
    try {
      const claims = app.jwt.verify<AccessClaims>(token);
      const session = await prisma.session.findUnique({ where: { id: claims.sid } });
      if (session && !session.revokedAt && session.expiresAt > new Date()) {
        return { id: claims.sub, sessionId: claims.sid };
      }
    } catch {
      /* expired/invalid — fall through to refresh */
    }
  }
  const rotated = await rotateSession(app, req, reply);
  return rotated ? { id: rotated.userId, sessionId: rotated.sessionId } : null;
}

export default fp(async (app) => {
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await resolve(app, req, reply);
    if (!user) throw unauthorized();
    req.currentUser = user;
  });

  app.decorate('optionalAuth', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await resolve(app, req, reply);
    if (user) req.currentUser = user;
  });
});

/** Convenience accessor that asserts an authenticated user is present. */
export function userId(req: FastifyRequest): string {
  if (!req.currentUser) throw unauthorized();
  return req.currentUser.id;
}

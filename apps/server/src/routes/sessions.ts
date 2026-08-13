import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { sessionView, loginEventView } from '../lib/serialize.js';
import { recordLoginEvent } from '../lib/audit.js';
import { notFound } from '../lib/http.js';

export default async function sessionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Device/session overview — every active login with device, location, dates.
  app.get('/', async (req) => {
    const sessions = await prisma.session.findMany({
      where: { userId: req.currentUser!.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    });
    return { sessions: sessions.map((s) => sessionView(s, req.currentUser!.sessionId)) };
  });

  // Full formatted login audit log.
  app.get('/log', async (req) => {
    const events = await prisma.loginEvent.findMany({
      where: { userId: req.currentUser!.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { events: events.map(loginEventView) };
  });

  // Revoke a single session.
  app.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const session = await prisma.session.findFirst({
      where: { id, userId: req.currentUser!.id },
    });
    if (!session) throw notFound('Session not found');
    await prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
    await recordLoginEvent(req, req.currentUser!.id, 'revoke');
    return { ok: true };
  });

  // Revoke every other session ("log out everywhere else").
  app.post('/revoke-others', async (req) => {
    await prisma.session.updateMany({
      where: {
        userId: req.currentUser!.id,
        revokedAt: null,
        NOT: { id: req.currentUser!.sessionId },
      },
      data: { revokedAt: new Date() },
    });
    await recordLoginEvent(req, req.currentUser!.id, 'revoke');
    return { ok: true };
  });
}

import type { FastifyInstance } from 'fastify';
import { createShareLinkSchema } from '@weft/shared';
import { prisma } from '../db.js';
import { pageWithRole, requireWorkspaceOwner } from '../lib/permissions.js';
import { randomToken } from '../lib/crypto.js';
import { notFound } from '../lib/http.js';

export default async function shareRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.post('/share', async (req) => {
    const body = createShareLinkSchema.parse(req.body);
    const { page } = await pageWithRole(body.pageId, req.currentUser!.id);
    await requireWorkspaceOwner(page.workspaceId, req.currentUser!.id).catch(async () => {
      // editors may also create view links
      return pageWithRole(body.pageId, req.currentUser!.id);
    });
    const link = await prisma.shareLink.create({
      data: {
        pageId: body.pageId,
        token: randomToken(18),
        permission: body.permission,
        includeChildren: body.includeChildren,
        createdById: req.currentUser!.id,
      },
    });
    return { link };
  });

  app.get('/pages/:id/share', async (req) => {
    const { id } = req.params as { id: string };
    await pageWithRole(id, req.currentUser!.id);
    const links = await prisma.shareLink.findMany({
      where: { pageId: id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return { links };
  });

  app.delete('/share/:id', async (req) => {
    const { id } = req.params as { id: string };
    const link = await prisma.shareLink.findUnique({ where: { id } });
    if (!link) throw notFound('Share link not found');
    await pageWithRole(link.pageId, req.currentUser!.id);
    await prisma.shareLink.update({ where: { id }, data: { revokedAt: new Date() } });
    return { ok: true };
  });
}

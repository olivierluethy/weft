import type { FastifyInstance } from 'fastify';
import { createTagSchema } from '@weft/shared';
import { prisma } from '../db.js';
import { requireMembership, requireWorkspaceEdit, pageWithRole } from '../lib/permissions.js';
import { notFound } from '../lib/http.js';

export default async function tagRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/workspaces/:id/tags', async (req) => {
    const { id } = req.params as { id: string };
    await requireMembership(id, req.currentUser!.id);
    const tags = await prisma.tag.findMany({
      where: { workspaceId: id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { pages: true } } },
    });
    return { tags: tags.map((t) => ({ ...t, count: t._count.pages })) };
  });

  app.post('/tags', async (req) => {
    const body = createTagSchema.parse(req.body);
    await requireWorkspaceEdit(body.workspaceId, req.currentUser!.id);
    const tag = await prisma.tag.upsert({
      where: { workspaceId_name: { workspaceId: body.workspaceId, name: body.name } },
      create: { workspaceId: body.workspaceId, name: body.name, color: body.color ?? 'thread' },
      update: {},
    });
    return { tag };
  });

  // Attach / detach a tag to a page.
  app.post('/pages/:id/tags/:tagId', async (req) => {
    const { id, tagId } = req.params as { id: string; tagId: string };
    await pageWithRole(id, req.currentUser!.id);
    await prisma.pageTag.upsert({
      where: { pageId_tagId: { pageId: id, tagId } },
      create: { pageId: id, tagId },
      update: {},
    });
    return { ok: true };
  });

  app.delete('/pages/:id/tags/:tagId', async (req) => {
    const { id, tagId } = req.params as { id: string; tagId: string };
    await pageWithRole(id, req.currentUser!.id);
    await prisma.pageTag
      .delete({ where: { pageId_tagId: { pageId: id, tagId } } })
      .catch(() => undefined);
    return { ok: true };
  });

  app.delete('/tags/:tagId', async (req) => {
    const { tagId } = req.params as { tagId: string };
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw notFound('Tag not found');
    await requireWorkspaceEdit(tag.workspaceId, req.currentUser!.id);
    await prisma.tag.delete({ where: { id: tagId } });
    return { ok: true };
  });
}

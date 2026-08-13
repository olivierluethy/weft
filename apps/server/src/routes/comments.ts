import type { FastifyInstance } from 'fastify';
import { createCommentSchema } from '@weft/shared';
import { prisma } from '../db.js';
import { pageWithRole } from '../lib/permissions.js';
import { publicUser } from '../lib/serialize.js';
import { forbidden, notFound } from '../lib/http.js';

export default async function commentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/pages/:id/comments', async (req) => {
    const { id } = req.params as { id: string };
    await pageWithRole(id, req.currentUser!.id);
    const comments = await prisma.comment.findMany({
      where: { pageId: id },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    });
    return {
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        blockId: c.blockId,
        parentId: c.parentId,
        resolvedAt: c.resolvedAt,
        createdAt: c.createdAt,
        author: publicUser(c.user),
      })),
    };
  });

  app.post('/comments', async (req) => {
    const body = createCommentSchema.parse(req.body);
    await pageWithRole(body.pageId, req.currentUser!.id);
    const comment = await prisma.comment.create({
      data: {
        pageId: body.pageId,
        userId: req.currentUser!.id,
        body: body.body,
        blockId: body.blockId ?? null,
        parentId: body.parentId ?? null,
      },
      include: { user: true },
    });
    return { comment: { ...comment, author: publicUser(comment.user) } };
  });

  app.post('/comments/:id/resolve', async (req) => {
    const { id } = req.params as { id: string };
    const c = await prisma.comment.findUnique({ where: { id } });
    if (!c) throw notFound('Comment not found');
    await pageWithRole(c.pageId, req.currentUser!.id);
    const updated = await prisma.comment.update({
      where: { id },
      data: { resolvedAt: c.resolvedAt ? null : new Date() },
    });
    return { comment: updated };
  });

  app.delete('/comments/:id', async (req) => {
    const { id } = req.params as { id: string };
    const c = await prisma.comment.findUnique({ where: { id } });
    if (!c) throw notFound('Comment not found');
    if (c.userId !== req.currentUser!.id) throw forbidden('You can only delete your own comments');
    await prisma.comment.delete({ where: { id } });
    return { ok: true };
  });
}

import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { canEdit } from '@weft/shared';
import { createVersionSchema } from '@weft/shared';
import { prisma } from '../db.js';
import { pageWithRole } from '../lib/permissions.js';
import { wordCount } from '../lib/text.js';
import { forbidden, notFound } from '../lib/http.js';

/** Version-history routes. Registered at /api so paths are absolute. */
export default async function versionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Create a snapshot (auto on debounce/blur, or manual save).
  app.post('/versions', async (req) => {
    const body = createVersionSchema.parse(req.body);
    const { role } = await pageWithRole(body.pageId, req.currentUser!.id);
    if (!canEdit(role)) throw forbidden('You have view-only access');

    // Skip a no-op snapshot if content is byte-identical to the latest one.
    const latest = await prisma.version.findFirst({
      where: { pageId: body.pageId },
      orderBy: { createdAt: 'desc' },
    });
    const serialized = JSON.stringify(body.content ?? null);
    if (latest && JSON.stringify(latest.content) === serialized && body.kind !== 'manual') {
      return { version: latest, skipped: true };
    }

    const version = await prisma.version.create({
      data: {
        pageId: body.pageId,
        content: body.content,
        kind: body.kind,
        label: body.label,
        wordCount: wordCount(body.content),
        authorId: req.currentUser!.id,
      },
    });

    // Keep history bounded: retain the most recent 100 auto snapshots per page.
    const autos = await prisma.version.findMany({
      where: { pageId: body.pageId, kind: { in: ['auto', 'blur'] } },
      orderBy: { createdAt: 'desc' },
      skip: 100,
      select: { id: true },
    });
    if (autos.length) {
      await prisma.version.deleteMany({ where: { id: { in: autos.map((a) => a.id) } } });
    }
    return { version };
  });

  // List snapshots for a page (metadata only, newest first).
  app.get('/pages/:id/versions', async (req) => {
    const { id } = req.params as { id: string };
    await pageWithRole(id, req.currentUser!.id);
    const versions = await prisma.version.findMany({
      where: { pageId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        label: true,
        wordCount: true,
        createdAt: true,
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    return { versions };
  });

  // Full content of a single version (for diffing / preview).
  app.get('/versions/:vid', async (req) => {
    const { vid } = req.params as { vid: string };
    const version = await prisma.version.findUnique({ where: { id: vid } });
    if (!version) throw notFound('Version not found');
    await pageWithRole(version.pageId, req.currentUser!.id);
    return { version };
  });

  // Restore a version (snapshots current state first, so restore is reversible).
  app.post('/versions/:vid/restore', async (req) => {
    const { vid } = req.params as { vid: string };
    const version = await prisma.version.findUnique({ where: { id: vid } });
    if (!version) throw notFound('Version not found');
    const { page, role } = await pageWithRole(version.pageId, req.currentUser!.id);
    if (!canEdit(role)) throw forbidden('You have view-only access');

    await prisma.version.create({
      data: {
        pageId: page.id,
        content: (page.content ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        kind: 'restore',
        label: 'Before restore',
        wordCount: wordCount(page.content),
        authorId: req.currentUser!.id,
      },
    });
    const updated = await prisma.page.update({
      where: { id: page.id },
      data: {
        content: (version.content ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        lastEditedById: req.currentUser!.id,
      },
    });
    return { page: updated };
  });
}

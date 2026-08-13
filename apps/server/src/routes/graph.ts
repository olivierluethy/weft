import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireMembership } from '../lib/permissions.js';
import { wordCount } from '../lib/text.js';

export default async function graphRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Network graph: nodes = pages, links = hierarchy (parent→child) + backlinks.
  app.get('/workspaces/:id/graph', async (req) => {
    const { id } = req.params as { id: string };
    await requireMembership(id, req.currentUser!.id);

    const pages = await prisma.page.findMany({
      where: { workspaceId: id, deletedAt: null, isTemplate: false },
      select: { id: true, title: true, icon: true, parentId: true, content: true },
    });
    const ids = new Set(pages.map((p) => p.id));

    const nodes = pages.map((p) => ({
      id: p.id,
      title: p.title || 'Untitled',
      icon: p.icon,
      // Node size hint from content length + child count is computed on the client.
      val: Math.max(1, Math.min(12, Math.round(wordCount(p.content) / 40) + 1)),
    }));

    const links: { source: string; target: string; kind: 'child' | 'ref' }[] = [];
    for (const p of pages) {
      if (p.parentId && ids.has(p.parentId)) {
        links.push({ source: p.parentId, target: p.id, kind: 'child' });
      }
    }
    const backlinks = await prisma.backlink.findMany({
      where: { source: { workspaceId: id } },
      select: { sourcePageId: true, targetPageId: true },
    });
    for (const b of backlinks) {
      if (ids.has(b.sourcePageId) && ids.has(b.targetPageId)) {
        links.push({ source: b.sourcePageId, target: b.targetPageId, kind: 'ref' });
      }
    }
    return { nodes, links };
  });

  // Whole-workspace export as JSON (pages, hierarchy, content, tags).
  app.get('/workspaces/:id/export', async (req) => {
    const { id } = req.params as { id: string };
    await requireMembership(id, req.currentUser!.id);
    const workspace = await prisma.workspace.findUnique({ where: { id } });
    const pages = await prisma.page.findMany({
      where: { workspaceId: id, deletedAt: null },
      orderBy: { position: 'asc' },
      include: { tags: { include: { tag: true } } },
    });
    return {
      exportedAt: new Date().toISOString(),
      app: 'Weft',
      workspace: { id: workspace?.id, name: workspace?.name, globalCss: workspace?.globalCss },
      pages: pages.map((p) => ({
        id: p.id,
        parentId: p.parentId,
        title: p.title,
        icon: p.icon,
        coverUrl: p.coverUrl,
        content: p.content,
        customCss: p.customCss,
        position: p.position,
        isTemplate: p.isTemplate,
        tags: p.tags.map((t) => t.tag.name),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  });
}

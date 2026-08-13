import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireMembership } from '../lib/permissions.js';
import { extractText } from '../lib/text.js';

export default async function searchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Full-text-ish search across a workspace's pages (title + body).
  app.get('/', async (req) => {
    const { q, workspaceId } = req.query as { q?: string; workspaceId?: string };
    if (!q || !workspaceId) return { results: [] };
    await requireMembership(workspaceId, req.currentUser!.id);
    const needle = q.trim().toLowerCase();

    const pages = await prisma.page.findMany({
      where: { workspaceId, deletedAt: null, isTemplate: false },
      select: { id: true, title: true, icon: true, content: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    const results = pages
      .map((p) => {
        const title = p.title.toLowerCase();
        const body = extractText(p.content).toLowerCase();
        const titleHit = title.includes(needle);
        const bodyIdx = body.indexOf(needle);
        if (!titleHit && bodyIdx < 0) return null;
        // Build a small snippet around the first body hit.
        let snippet = '';
        if (bodyIdx >= 0) {
          const start = Math.max(0, bodyIdx - 40);
          snippet = (start > 0 ? '…' : '') + body.slice(start, bodyIdx + needle.length + 60) + '…';
        }
        return {
          id: p.id,
          title: p.title || 'Untitled',
          icon: p.icon,
          snippet,
          score: (titleHit ? 2 : 0) + (bodyIdx >= 0 ? 1 : 0),
          updatedAt: p.updatedAt.toISOString(),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);

    return { results };
  });
}

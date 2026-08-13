import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { notFound } from '../lib/http.js';

/** Unauthenticated read-only access to publicly shared pages. */
export default async function publicRoutes(app: FastifyInstance) {
  app.get('/public/:token', async (req) => {
    const { token } = req.params as { token: string };
    const link = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        page: {
          include: {
            workspace: { select: { name: true, globalCss: true } },
            createdBy: { select: { name: true } },
          },
        },
      },
    });
    if (!link || link.revokedAt) throw notFound('This share link is no longer available');

    const children = link.includeChildren
      ? await prisma.page.findMany({
          where: { parentId: link.page.id, deletedAt: null },
          orderBy: { position: 'asc' },
          select: { id: true, title: true, icon: true },
        })
      : [];

    return {
      permission: link.permission,
      page: {
        id: link.page.id,
        title: link.page.title,
        icon: link.page.icon,
        coverUrl: link.page.coverUrl,
        backgroundUrl: link.page.backgroundUrl,
        content: link.page.content,
        customCss: link.page.customCss,
        width: link.page.width,
        isFullWidth: link.page.isFullWidth,
        workspaceName: link.page.workspace.name,
        globalCss: link.page.workspace.globalCss,
        author: link.page.createdBy?.name ?? null,
        updatedAt: link.page.updatedAt,
      },
      children,
    };
  });

  // Resolve a child of a shared page (so public visitors can browse the subtree).
  app.get('/public/:token/page/:pageId', async (req) => {
    const { token, pageId } = req.params as { token: string; pageId: string };
    const link = await prisma.shareLink.findUnique({ where: { token }, include: { page: true } });
    if (!link || link.revokedAt || !link.includeChildren) throw notFound('Not available');

    // Confirm the requested page is a descendant of the shared root.
    let cur: string | null = pageId;
    const guard = new Set<string>();
    let ok = false;
    while (cur && !guard.has(cur)) {
      if (cur === link.page.id) {
        ok = true;
        break;
      }
      guard.add(cur);
      const p: { parentId: string | null } | null = await prisma.page.findUnique({
        where: { id: cur },
        select: { parentId: true },
      });
      cur = p?.parentId ?? null;
    }
    if (!ok) throw notFound('Not available');

    const page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page || page.deletedAt) throw notFound('Not available');
    const children = await prisma.page.findMany({
      where: { parentId: pageId, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, title: true, icon: true },
    });
    return { page, children };
  });
}

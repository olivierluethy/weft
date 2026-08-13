import type { FastifyInstance } from 'fastify';
import { canEdit } from '@weft/shared';
import { createPageSchema, updatePageSchema, movePageSchema } from '@weft/shared';
import { prisma } from '../db.js';
import { requireMembership, requireWorkspaceEdit, pageWithRole } from '../lib/permissions.js';
import { extractMentions } from '../lib/text.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import { nanoid } from 'nanoid';

/** Walk up the parent chain to build breadcrumbs (root → current). */
async function breadcrumbs(pageId: string) {
  const crumbs: { id: string; title: string; icon: string | null }[] = [];
  let current: string | null = pageId;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    guard.add(current);
    const p = await prisma.page.findUnique({
      where: { id: current },
      select: { id: true, title: true, icon: true, parentId: true },
    });
    if (!p) break;
    crumbs.unshift({ id: p.id, title: p.title, icon: p.icon });
    current = p.parentId;
  }
  return crumbs;
}

/** Rewrite the Backlink rows for a page from its @page mentions. */
async function syncBacklinks(pageId: string, content: unknown) {
  const targets = extractMentions(content).filter((id) => id && id !== pageId);
  await prisma.backlink.deleteMany({ where: { sourcePageId: pageId } });
  if (targets.length === 0) return;
  const valid = await prisma.page.findMany({
    where: { id: { in: targets } },
    select: { id: true },
  });
  await prisma.backlink.createMany({
    data: valid.map((v) => ({ sourcePageId: pageId, targetPageId: v.id })),
  });
}

async function nextPosition(workspaceId: string, parentId: string | null): Promise<number> {
  const last = await prisma.page.findFirst({
    where: { workspaceId, parentId, deletedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return (last?.position ?? 0) + 1000;
}

/** Deep-clone a page subtree (used by duplicate + template instantiation). */
async function clonePage(
  sourceId: string,
  workspaceId: string,
  parentId: string | null,
  userId: string,
  asTemplate = false,
  position?: number,
): Promise<string> {
  const src = await prisma.page.findUnique({ where: { id: sourceId } });
  if (!src) throw notFound('Source page not found');
  const created = await prisma.page.create({
    data: {
      workspaceId,
      parentId,
      title: src.title,
      icon: src.icon,
      coverUrl: src.coverUrl,
      backgroundUrl: src.backgroundUrl,
      content: src.content ?? undefined,
      customCss: src.customCss,
      width: src.width,
      isFullWidth: src.isFullWidth,
      isTemplate: asTemplate,
      position: position ?? (await nextPosition(workspaceId, parentId)),
      createdById: userId,
      lastEditedById: userId,
    },
  });
  const children = await prisma.page.findMany({
    where: { parentId: sourceId, deletedAt: null },
    orderBy: { position: 'asc' },
  });
  for (const child of children) {
    await clonePage(child.id, workspaceId, created.id, userId, asTemplate);
  }
  return created.id;
}

export default async function pageRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // ── Create ───────────────────────────────────────────────────────────
  app.post('/', async (req) => {
    const body = createPageSchema.parse(req.body);
    await requireWorkspaceEdit(body.workspaceId, req.currentUser!.id);

    if (body.templateId) {
      const id = await clonePage(
        body.templateId,
        body.workspaceId,
        body.parentId ?? null,
        req.currentUser!.id,
        false,
        await nextPosition(body.workspaceId, body.parentId ?? null),
      );
      const page = await prisma.page.update({
        where: { id },
        data: { isTemplate: false, title: body.title ?? undefined },
      });
      return { page };
    }

    const page = await prisma.page.create({
      data: {
        workspaceId: body.workspaceId,
        parentId: body.parentId ?? null,
        title: body.title ?? '',
        icon: body.icon ?? null,
        position: await nextPosition(body.workspaceId, body.parentId ?? null),
        createdById: req.currentUser!.id,
        lastEditedById: req.currentUser!.id,
      },
    });
    return { page };
  });

  // ── Read ─────────────────────────────────────────────────────────────
  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { page, role } = await pageWithRole(id, req.currentUser!.id);
    const [crumbs, favorite, tags] = await Promise.all([
      breadcrumbs(id),
      prisma.favorite.findUnique({
        where: { userId_pageId: { userId: req.currentUser!.id, pageId: id } },
      }),
      prisma.pageTag.findMany({ where: { pageId: id }, include: { tag: true } }),
    ]);
    return {
      page: { ...page, isFavorite: !!favorite, tags: tags.map((t) => t.tag) },
      role,
      breadcrumbs: crumbs,
    };
  });

  // ── Backlinks ────────────────────────────────────────────────────────
  app.get('/:id/backlinks', async (req) => {
    const { id } = req.params as { id: string };
    await pageWithRole(id, req.currentUser!.id);
    const links = await prisma.backlink.findMany({
      where: { targetPageId: id },
      include: { source: { select: { id: true, title: true, icon: true } } },
    });
    return { backlinks: links.map((l) => l.source) };
  });

  // ── Update ───────────────────────────────────────────────────────────
  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = updatePageSchema.parse(req.body);
    const { page, role } = await pageWithRole(id, req.currentUser!.id);
    if (!canEdit(role)) throw forbidden('You have view-only access');

    // Favorite is per-user and handled separately from page columns.
    if (typeof body.isFavorite === 'boolean') {
      if (body.isFavorite) {
        await prisma.favorite.upsert({
          where: { userId_pageId: { userId: req.currentUser!.id, pageId: id } },
          create: { userId: req.currentUser!.id, pageId: id },
          update: {},
        });
      } else {
        await prisma.favorite
          .delete({ where: { userId_pageId: { userId: req.currentUser!.id, pageId: id } } })
          .catch(() => undefined);
      }
    }

    if (page.isLocked && body.content !== undefined && body.isLocked !== false) {
      throw forbidden('This page is locked');
    }

    const { isFavorite, content, ...rest } = body;
    const updated = await prisma.page.update({
      where: { id },
      data: {
        ...rest,
        ...(content !== undefined ? { content } : {}),
        lastEditedById: req.currentUser!.id,
      },
    });
    if (content !== undefined) await syncBacklinks(id, content);
    return { page: updated };
  });

  // ── Move (reorder / re-parent) ───────────────────────────────────────
  app.post('/:id/move', async (req) => {
    const { id } = req.params as { id: string };
    const body = movePageSchema.parse(req.body);
    const { page, role } = await pageWithRole(id, req.currentUser!.id);
    if (!canEdit(role)) throw forbidden('You have view-only access');

    // Prevent moving a page into its own descendant (would orphan the subtree).
    if (body.parentId) {
      let cur: string | null = body.parentId;
      const guard = new Set<string>();
      while (cur && !guard.has(cur)) {
        if (cur === id) throw badRequest("A page can't be nested inside itself");
        guard.add(cur);
        const p: { parentId: string | null } | null = await prisma.page.findUnique({
          where: { id: cur },
          select: { parentId: true },
        });
        cur = p?.parentId ?? null;
      }
    }

    const updated = await prisma.page.update({
      where: { id },
      data: { parentId: body.parentId, position: body.position },
    });
    void page;
    return { page: updated };
  });

  // ── Duplicate ────────────────────────────────────────────────────────
  app.post('/:id/duplicate', async (req) => {
    const { id } = req.params as { id: string };
    const { page, role } = await pageWithRole(id, req.currentUser!.id);
    if (!canEdit(role)) throw forbidden('You have view-only access');
    const newId = await clonePage(id, page.workspaceId, page.parentId, req.currentUser!.id);
    await prisma.page.update({ where: { id: newId }, data: { title: `${page.title} (copy)` } });
    const created = await prisma.page.findUnique({ where: { id: newId } });
    return { page: created };
  });

  // ── Save as template ─────────────────────────────────────────────────
  app.post('/:id/save-as-template', async (req) => {
    const { id } = req.params as { id: string };
    const { page, role } = await pageWithRole(id, req.currentUser!.id);
    if (!canEdit(role)) throw forbidden('You have view-only access');
    const newId = await clonePage(id, page.workspaceId, null, req.currentUser!.id, true);
    const tpl = await prisma.page.findUnique({ where: { id: newId } });
    return { template: tpl };
  });

  // ── Trash / restore / permanent delete ───────────────────────────────
  app.delete('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { role } = await pageWithRole(id, req.currentUser!.id);
    if (!canEdit(role)) throw forbidden('You have view-only access');
    // Soft-delete the page and its whole subtree.
    const ids = await collectSubtree(id);
    await prisma.page.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
    return { ok: true, count: ids.length };
  });

  app.post('/:id/restore', async (req) => {
    const { id } = req.params as { id: string };
    await pageWithRole(id, req.currentUser!.id);
    const ids = await collectSubtree(id, true);
    await prisma.page.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
    return { ok: true };
  });

  app.delete('/:id/permanent', async (req) => {
    const { id } = req.params as { id: string };
    const { role } = await pageWithRole(id, req.currentUser!.id);
    if (!canEdit(role)) throw forbidden('You have view-only access');
    await prisma.page.delete({ where: { id } }); // cascades children + versions
    return { ok: true };
  });
}

/** Gather a page id + all descendant ids (optionally including trashed). */
async function collectSubtree(rootId: string, includeDeleted = false): Promise<string[]> {
  const out: string[] = [];
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift()!;
    out.push(cur);
    const kids = await prisma.page.findMany({
      where: { parentId: cur, ...(includeDeleted ? {} : { deletedAt: null }) },
      select: { id: true },
    });
    queue.push(...kids.map((k) => k.id));
  }
  return out;
}

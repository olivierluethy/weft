import type { FastifyInstance } from 'fastify';
import {
  createWorkspaceSchema,
  type PageTreeNode,
  type WorkspaceOverviewPage,
  type ActivityEvent,
  type ActivityFeed,
} from '@weft/shared';
import { prisma } from '../db.js';
import { requireMembership, requireWorkspaceOwner } from '../lib/permissions.js';
import { createDefaultWorkspace } from '../lib/bootstrap.js';
import { publicUser } from '../lib/serialize.js';
import { wordCount } from '../lib/text.js';
import { notFound } from '../lib/http.js';

/** Cap on activity events returned per window, so a very busy month never
 * ships thousands of rows. When exceeded we keep the newest and flag it. */
const ACTIVITY_CAP = 800;

export default async function workspaceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Create a new workspace (with a welcome page).
  app.post('/', async (req) => {
    const body = createWorkspaceSchema.parse(req.body);
    const { workspace } = await createDefaultWorkspace(req.currentUser!.id, body.name);
    if (body.globalCss) {
      await prisma.workspace.update({ where: { id: workspace.id }, data: { globalCss: body.globalCss } });
    }
    return { workspace };
  });

  // Workspace detail incl. the caller's role and global CSS.
  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string };
    const role = await requireMembership(id, req.currentUser!.id);
    const workspace = await prisma.workspace.findUnique({ where: { id } });
    if (!workspace) throw notFound('Workspace not found');
    return { workspace, role };
  });

  // Update workspace name / global CSS (owners only).
  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string };
    await requireWorkspaceOwner(id, req.currentUser!.id);
    const body = req.body as { name?: string; globalCss?: string | null; icon?: string | null };
    const workspace = await prisma.workspace.update({
      where: { id },
      data: { name: body.name, globalCss: body.globalCss, icon: body.icon },
    });
    return { workspace };
  });

  // Page tree for the sidebar.
  app.get('/:id/tree', async (req) => {
    const { id } = req.params as { id: string };
    await requireMembership(id, req.currentUser!.id);
    const pages = await prisma.page.findMany({
      where: { workspaceId: id, deletedAt: null, isTemplate: false },
      orderBy: [{ position: 'asc' }],
      select: {
        id: true,
        title: true,
        icon: true,
        parentId: true,
        position: true,
        isLocked: true,
        updatedAt: true,
        _count: { select: { children: { where: { deletedAt: null } } } },
        favorites: { where: { userId: req.currentUser!.id }, select: { id: true } },
      },
    });
    const tree: PageTreeNode[] = pages.map((p) => ({
      id: p.id,
      title: p.title,
      icon: p.icon,
      parentId: p.parentId,
      position: p.position,
      isFavorite: p.favorites.length > 0,
      isLocked: p.isLocked,
      hasChildren: p._count.children > 0,
      updatedAt: p.updatedAt.toISOString(),
    }));
    return { tree };
  });

  // Workspace overview: every live page with created/edited timestamps and an
  // approximate content size (word count). Word count needs the page content,
  // which the sidebar tree deliberately omits, so this is a separate endpoint
  // fetched only when the overview is open.
  app.get('/:id/overview', async (req) => {
    const { id } = req.params as { id: string };
    await requireMembership(id, req.currentUser!.id);
    const pages = await prisma.page.findMany({
      where: { workspaceId: id, deletedAt: null, isTemplate: false },
      select: {
        id: true,
        title: true,
        icon: true,
        parentId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { children: { where: { deletedAt: null } } } },
        favorites: { where: { userId: req.currentUser!.id }, select: { id: true } },
      },
    });
    const overview: WorkspaceOverviewPage[] = pages.map((p) => ({
      id: p.id,
      title: p.title,
      icon: p.icon,
      parentId: p.parentId,
      isFavorite: p.favorites.length > 0,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      wordCount: wordCount(p.content),
      childCount: p._count.children,
    }));
    return { pages: overview };
  });

  // Activity feed: a chronological log of real changes in the workspace,
  // scoped to a month (default) or a whole year. Built purely from durable
  // records — page creation dates and content Version snapshots — so it never
  // invents changes from transient UI state. Windowing keeps result size and
  // render cost bounded (spec §13).
  app.get('/:id/activity', async (req) => {
    const { id } = req.params as { id: string };
    await requireMembership(id, req.currentUser!.id);
    const q = req.query as { year?: string; month?: string };

    // Lightweight page metadata (no content) for titles/icons + creation events.
    const pages = await prisma.page.findMany({
      where: { workspaceId: id, deletedAt: null, isTemplate: false },
      select: { id: true, title: true, icon: true, createdAt: true },
    });
    const pageMap = new Map(pages.map((p) => [p.id, p]));

    // Overall span for the year/month navigator: earliest page creation → now.
    let earliest: Date | null = null;
    for (const p of pages) if (!earliest || p.createdAt < earliest) earliest = p.createdAt;
    const now = new Date();
    const range = earliest
      ? { earliest: earliest.toISOString(), latest: now.toISOString() }
      : null;

    // Resolve the requested window. No params → current month.
    const year = q.year ? parseInt(q.year, 10) : now.getUTCFullYear();
    const monthParam = q.month != null && q.month !== '' ? parseInt(q.month, 10) : null;
    // A whole-year view is requested when a year is given without a month;
    // otherwise default to the current month.
    const month = monthParam ?? (q.year ? null : now.getUTCMonth() + 1);
    const start = month
      ? new Date(Date.UTC(year, month - 1, 1))
      : new Date(Date.UTC(year, 0, 1));
    const end = month ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year + 1, 0, 1));

    // All version snapshots for this workspace's live pages, lightweight (no
    // content), ordered so each version's predecessor is the row before it —
    // used to compute per-page word deltas without an N+1 query.
    const allVersions = await prisma.version.findMany({
      where: { page: { workspaceId: id, deletedAt: null, isTemplate: false } },
      orderBy: [{ pageId: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, pageId: true, wordCount: true, createdAt: true, kind: true },
    });

    const events: ActivityEvent[] = [];

    // Creation events inside the window.
    for (const p of pages) {
      if (p.createdAt >= start && p.createdAt < end) {
        events.push({
          id: `created:${p.id}`,
          type: 'created',
          pageId: p.id,
          pageTitle: p.title,
          pageIcon: p.icon,
          at: p.createdAt.toISOString(),
          wordCount: 0,
          prevWordCount: null,
          versionId: null,
          prevVersionId: null,
          kind: null,
        });
      }
    }

    // Edit events (version snapshots) inside the window, with the predecessor
    // snapshot of the same page carried along for the diff + delta.
    let prevPageId: string | null = null;
    let prevId: string | null = null;
    let prevWords: number | null = null;
    for (const v of allVersions) {
      const isNewPage = v.pageId !== prevPageId;
      const predecessorId = isNewPage ? null : prevId;
      const predecessorWords = isNewPage ? null : prevWords;
      if (v.createdAt >= start && v.createdAt < end) {
        const pg = pageMap.get(v.pageId);
        if (pg) {
          events.push({
            id: v.id,
            type: 'edited',
            pageId: v.pageId,
            pageTitle: pg.title,
            pageIcon: pg.icon,
            at: v.createdAt.toISOString(),
            wordCount: v.wordCount,
            prevWordCount: predecessorWords,
            versionId: v.id,
            prevVersionId: predecessorId,
            kind: v.kind,
          });
        }
      }
      prevPageId = v.pageId;
      prevId = v.id;
      prevWords = v.wordCount;
    }

    // Newest first; cap busy windows (keep the most recent, flag truncation).
    events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    const truncated = events.length > ACTIVITY_CAP;
    const feed: ActivityFeed = {
      events: truncated ? events.slice(0, ACTIVITY_CAP) : events,
      range,
      window: { year, month },
      truncated,
    };
    return feed;
  });

  // Members list.
  app.get('/:id/members', async (req) => {
    const { id } = req.params as { id: string };
    await requireMembership(id, req.currentUser!.id);
    const members = await prisma.membership.findMany({
      where: { workspaceId: id },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      members: members.map((m) => ({ role: m.role, user: publicUser(m.user), joinedAt: m.createdAt })),
    };
  });

  // Trash for a workspace.
  app.get('/:id/trash', async (req) => {
    const { id } = req.params as { id: string };
    await requireMembership(id, req.currentUser!.id);
    const pages = await prisma.page.findMany({
      where: { workspaceId: id, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      select: { id: true, title: true, icon: true, deletedAt: true },
    });
    return { pages };
  });

  // Templates for a workspace.
  app.get('/:id/templates', async (req) => {
    const { id } = req.params as { id: string };
    await requireMembership(id, req.currentUser!.id);
    const templates = await prisma.page.findMany({
      where: { workspaceId: id, isTemplate: true, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, icon: true, updatedAt: true },
    });
    return { templates };
  });
}

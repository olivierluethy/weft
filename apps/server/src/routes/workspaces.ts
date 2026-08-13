import type { FastifyInstance } from 'fastify';
import { createWorkspaceSchema, type PageTreeNode } from '@weft/shared';
import { prisma } from '../db.js';
import { requireMembership, requireWorkspaceOwner } from '../lib/permissions.js';
import { createDefaultWorkspace } from '../lib/bootstrap.js';
import { publicUser } from '../lib/serialize.js';
import { notFound } from '../lib/http.js';

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

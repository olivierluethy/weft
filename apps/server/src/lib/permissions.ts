import { canEdit, canManage, type Role } from '@weft/shared';
import { prisma } from '../db.js';
import { forbidden, notFound } from './http.js';

/** Resolve a user's role in a workspace, or throw 403 if they're not a member. */
export async function requireMembership(workspaceId: string, userId: string): Promise<Role> {
  const m = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!m) throw forbidden('You are not a member of this workspace');
  return m.role as Role;
}

export async function requireWorkspaceEdit(workspaceId: string, userId: string): Promise<Role> {
  const role = await requireMembership(workspaceId, userId);
  if (!canEdit(role)) throw forbidden('You have view-only access to this workspace');
  return role;
}

export async function requireWorkspaceOwner(workspaceId: string, userId: string): Promise<Role> {
  const role = await requireMembership(workspaceId, userId);
  if (!canManage(role)) throw forbidden('Only workspace owners can do that');
  return role;
}

/** Load a page and the caller's role, enforcing membership. Returns both. */
export async function pageWithRole(pageId: string, userId: string) {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) throw notFound('Page not found');
  const role = await requireMembership(page.workspaceId, userId);
  return { page, role };
}

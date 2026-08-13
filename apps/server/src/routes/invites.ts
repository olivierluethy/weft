import type { FastifyInstance } from 'fastify';
import { addDays } from 'date-fns';
import { inviteSchema, updateMemberSchema } from '@weft/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { requireWorkspaceOwner } from '../lib/permissions.js';
import { sendMail } from '../lib/mail.js';
import { badRequest, conflict, notFound } from '../lib/http.js';

export default async function inviteRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Invite someone to a workspace by email.
  app.post('/workspaces/:id/invites', async (req) => {
    const { id } = req.params as { id: string };
    await requireWorkspaceOwner(id, req.currentUser!.id);
    const body = inviteSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();

    const already = await prisma.membership.findFirst({
      where: { workspaceId: id, user: { email } },
    });
    if (already) throw conflict('That person is already a member');

    const raw = randomToken();
    const workspace = await prisma.workspace.findUnique({ where: { id } });
    const invite = await prisma.invite.create({
      data: {
        workspaceId: id,
        email,
        role: body.role,
        tokenHash: sha256(raw),
        invitedById: req.currentUser!.id,
        expiresAt: addDays(new Date(), 14),
      },
    });
    const link = `${env.webOrigin}/invite?token=${raw}`;
    await sendMail({
      to: email,
      subject: `You've been invited to ${workspace?.name ?? 'a Weft workspace'}`,
      text: `You've been invited to collaborate in "${workspace?.name}" on Weft as a ${body.role}.\n\nAccept the invitation:\n${link}\n\nThis invite expires in 14 days.`,
    });
    return { invite: { id: invite.id, email, role: invite.role, expiresAt: invite.expiresAt } };
  });

  app.get('/workspaces/:id/invites', async (req) => {
    const { id } = req.params as { id: string };
    await requireWorkspaceOwner(id, req.currentUser!.id);
    const invites = await prisma.invite.findMany({
      where: { workspaceId: id, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });
    return { invites };
  });

  app.delete('/invites/:id', async (req) => {
    const { id } = req.params as { id: string };
    const invite = await prisma.invite.findUnique({ where: { id } });
    if (!invite) throw notFound('Invite not found');
    await requireWorkspaceOwner(invite.workspaceId, req.currentUser!.id);
    await prisma.invite.delete({ where: { id } });
    return { ok: true };
  });

  // Accept an invite (the logged-in user joins the workspace).
  app.post('/invites/accept', async (req) => {
    const { token } = req.body as { token?: string };
    if (!token) throw badRequest('Missing invite token');
    const invite = await prisma.invite.findUnique({ where: { tokenHash: sha256(token) } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw badRequest('This invite is invalid or has expired');
    }
    const membership = await prisma.membership.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: req.currentUser!.id } },
      create: { workspaceId: invite.workspaceId, userId: req.currentUser!.id, role: invite.role },
      update: {},
    });
    await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    return { workspaceId: membership.workspaceId };
  });

  // Change a member's role.
  app.patch('/workspaces/:id/members/:userId', async (req) => {
    const { id, userId } = req.params as { id: string; userId: string };
    await requireWorkspaceOwner(id, req.currentUser!.id);
    const body = updateMemberSchema.parse(req.body);
    const ws = await prisma.workspace.findUnique({ where: { id } });
    if (ws?.ownerId === userId) throw badRequest("The workspace owner's role can't be changed");
    const membership = await prisma.membership.update({
      where: { workspaceId_userId: { workspaceId: id, userId } },
      data: { role: body.role },
    });
    return { membership };
  });

  // Remove a member.
  app.delete('/workspaces/:id/members/:userId', async (req) => {
    const { id, userId } = req.params as { id: string; userId: string };
    await requireWorkspaceOwner(id, req.currentUser!.id);
    const ws = await prisma.workspace.findUnique({ where: { id } });
    if (ws?.ownerId === userId) throw badRequest("The workspace owner can't be removed");
    await prisma.membership
      .delete({ where: { workspaceId_userId: { workspaceId: id, userId } } })
      .catch(() => undefined);
    return { ok: true };
  });
}

import type { FastifyInstance } from 'fastify';
import { updateProfileSchema, updateEmailSchema, updatePasswordSchema } from '@weft/shared';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { publicUser } from '../lib/serialize.js';
import { badRequest, conflict, unauthorized } from '../lib/http.js';

export default async function accountRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Update display name / bio / avatar.
  app.patch('/profile', async (req) => {
    const body = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.currentUser!.id },
      data: { name: body.name, bio: body.bio, avatarUrl: body.avatarUrl },
    });
    return { user: publicUser(user) };
  });

  // Change email (requires current password).
  app.patch('/email', async (req) => {
    const body = updateEmailSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.currentUser!.id } });
    if (!user || !(await verifyPassword(user.passwordHash, body.currentPassword))) {
      throw unauthorized('Current password is incorrect');
    }
    const email = body.email.toLowerCase().trim();
    const taken = await prisma.user.findFirst({ where: { email, NOT: { id: user.id } } });
    if (taken) throw conflict('That email is already in use');
    const updated = await prisma.user.update({ where: { id: user.id }, data: { email } });
    return { user: publicUser(updated) };
  });

  // Change password (requires current password); keeps current session alive.
  app.patch('/password', async (req) => {
    const body = updatePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.currentUser!.id } });
    if (!user || !(await verifyPassword(user.passwordHash, body.currentPassword))) {
      throw unauthorized('Current password is incorrect');
    }
    if (body.newPassword.length < 8) throw badRequest('Password must be at least 8 characters');
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword) },
    });
    // Revoke all *other* sessions so a leaked password can't linger.
    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null, NOT: { id: req.currentUser!.sessionId } },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  });
}

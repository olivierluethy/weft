import type { FastifyInstance } from 'fastify';
import { addHours } from 'date-fns';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@weft/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { hashPassword, verifyPassword, randomToken, sha256 } from '../lib/crypto.js';
import { issueSession, rotateSession, clearAuthCookies } from '../lib/auth.js';
import { recordLoginEvent } from '../lib/audit.js';
import { createDefaultWorkspace } from '../lib/bootstrap.js';
import { publicUser } from '../lib/serialize.js';
import { badRequest, conflict, unauthorized } from '../lib/http.js';
import { sendMail } from '../lib/mail.js';

export default async function authRoutes(app: FastifyInstance) {
  // ── Register ─────────────────────────────────────────────────────────
  app.post('/register', async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict('An account with this email already exists');

    const user = await prisma.user.create({
      data: { email, name: body.name.trim(), passwordHash: await hashPassword(body.password) },
    });
    await createDefaultWorkspace(user.id, `${body.name.split(' ')[0]}'s workspace`);
    await issueSession(app, req, reply, user.id, false);
    await recordLoginEvent(req, user.id, 'register');
    return reply.send({ user: publicUser(user) });
  });

  // ── Login ────────────────────────────────────────────────────────────
  app.post('/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const email = body.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
      if (user) await recordLoginEvent(req, user.id, 'failed', false);
      throw unauthorized('Incorrect email or password');
    }
    await issueSession(app, req, reply, user.id, body.remember);
    await recordLoginEvent(req, user.id, 'login');
    return reply.send({ user: publicUser(user) });
  });

  // ── Refresh ──────────────────────────────────────────────────────────
  app.post('/refresh', async (req, reply) => {
    const rotated = await rotateSession(app, req, reply);
    if (!rotated) {
      clearAuthCookies(reply);
      throw unauthorized('Session expired');
    }
    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user) throw unauthorized();
    return reply.send({ user: publicUser(user) });
  });

  // ── Logout ───────────────────────────────────────────────────────────
  app.post('/logout', { preHandler: app.optionalAuth }, async (req, reply) => {
    if (req.currentUser) {
      await prisma.session
        .update({
          where: { id: req.currentUser.sessionId },
          data: { revokedAt: new Date() },
        })
        .catch(() => undefined);
      await recordLoginEvent(req, req.currentUser.id, 'logout');
    }
    clearAuthCookies(reply);
    return reply.send({ ok: true });
  });

  // ── Current user ─────────────────────────────────────────────────────
  app.get('/me', { preHandler: app.authenticate }, async (req) => {
    const user = await prisma.user.findUnique({ where: { id: req.currentUser!.id } });
    if (!user) throw unauthorized();
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      user: publicUser(user),
      workspaces: memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        icon: m.workspace.icon,
        role: m.role,
      })),
    };
  });

  // ── Forgot password ──────────────────────────────────────────────────
  app.post('/forgot', async (req, reply) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    // Always respond ok to avoid leaking which emails exist.
    if (user) {
      const raw = randomToken();
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(raw), expiresAt: addHours(new Date(), 1) },
      });
      const link = `${env.webOrigin}/reset-password?token=${raw}`;
      await sendMail({
        to: user.email,
        subject: 'Reset your Weft password',
        text: `Hi ${user.name},\n\nReset your password using the link below (valid for 1 hour):\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
      });
    }
    return reply.send({ ok: true });
  });

  // ── Reset password ───────────────────────────────────────────────────
  app.post('/reset', async (req, reply) => {
    const body = resetPasswordSchema.parse(req.body);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(body.token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw badRequest('This reset link is invalid or has expired');
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(body.password) },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all sessions on password reset for safety.
      prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await recordLoginEvent(req, record.userId, 'reset');
    return reply.send({ ok: true });
  });
}

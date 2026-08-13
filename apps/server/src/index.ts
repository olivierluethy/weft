import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { ZodError } from 'zod';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

import { env } from './env.js';
import { HttpError } from './lib/http.js';
import authenticatePlugin from './plugins/authenticate.js';
import { hocuspocus } from './collab.js';

import authRoutes from './routes/auth.js';
import accountRoutes from './routes/account.js';
import sessionRoutes from './routes/sessions.js';
import workspaceRoutes from './routes/workspaces.js';
import pageRoutes from './routes/pages.js';
import versionRoutes from './routes/versions.js';
import uploadRoutes from './routes/uploads.js';
import imageRoutes from './routes/images.js';
import searchRoutes from './routes/search.js';
import commentRoutes from './routes/comments.js';
import tagRoutes from './routes/tags.js';
import shareRoutes from './routes/share.js';
import publicRoutes from './routes/public.js';
import inviteRoutes from './routes/invites.js';
import graphRoutes from './routes/graph.js';

async function main() {
  const app = Fastify({
    logger: {
      level: env.isProd ? 'info' : 'warn',
      transport: env.isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
    },
    bodyLimit: env.maxUploadMb * 1024 * 1024,
  });

  // ── Core plugins ─────────────────────────────────────────────────────
  await app.register(cors, { origin: env.corsOrigins, credentials: true });
  await app.register(cookie);
  await app.register(jwt, { secret: env.jwtAccessSecret, cookie: { cookieName: 'weft_at', signed: false } });
  await app.register(multipart, { limits: { fileSize: env.maxUploadMb * 1024 * 1024 } });
  await app.register(websocket);
  await app.register(authenticatePlugin);

  // Static uploads.
  const uploadRoot = resolve(process.cwd(), env.uploadDir);
  await mkdir(uploadRoot, { recursive: true });
  await app.register(fastifyStatic, { root: uploadRoot, prefix: '/uploads/' });

  // ── Error handling ───────────────────────────────────────────────────
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: 'validation_error',
        message: err.errors[0]?.message ?? 'Invalid request',
        details: err.flatten(),
      });
    }
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ error: err.code, message: err.message });
    }
    if ((err as { statusCode?: number }).statusCode === 401) {
      return reply.status(401).send({ error: 'unauthorized', message: 'Not authenticated' });
    }
    app.log.error(err);
    return reply.status(500).send({ error: 'server_error', message: 'Something went wrong' });
  });

  app.get('/api/health', async () => ({ ok: true, app: 'Weft', time: new Date().toISOString() }));

  // ── Collaboration websocket ──────────────────────────────────────────
  app.get(env.collabPath, { websocket: true }, (socket, req) => {
    // @fastify/websocket v11 hands us the raw ws socket.
    hocuspocus.handleConnection(socket as never, req.raw);
  });

  // ── REST routes ──────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(accountRoutes, { prefix: '/api/account' });
  await app.register(sessionRoutes, { prefix: '/api/sessions' });
  await app.register(workspaceRoutes, { prefix: '/api/workspaces' });
  await app.register(pageRoutes, { prefix: '/api/pages' });
  await app.register(uploadRoutes, { prefix: '/api/uploads' });
  await app.register(imageRoutes, { prefix: '/api/images' });
  await app.register(searchRoutes, { prefix: '/api/search' });
  // These register absolute paths under /api (mix of /pages/:id/... and /...).
  await app.register(versionRoutes, { prefix: '/api' });
  await app.register(commentRoutes, { prefix: '/api' });
  await app.register(tagRoutes, { prefix: '/api' });
  await app.register(shareRoutes, { prefix: '/api' });
  await app.register(inviteRoutes, { prefix: '/api' });
  await app.register(graphRoutes, { prefix: '/api' });
  await app.register(publicRoutes, { prefix: '/api' });

  try {
    await app.listen({ port: env.port, host: env.host });
    app.log.info(`Weft server ready on http://${env.host}:${env.port}`);
    // eslint-disable-next-line no-console
    console.log(
      `\n\x1b[34m🧵 Weft server\x1b[0m listening on \x1b[36mhttp://${env.host}:${env.port}\x1b[0m` +
        `\n   Collaboration socket: \x1b[36mws://${env.host}:${env.port}${env.collabPath}\x1b[0m\n`,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

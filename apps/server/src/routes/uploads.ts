import type { FastifyInstance } from 'fastify';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { resolve, extname } from 'node:path';
import { nanoid } from 'nanoid';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { badRequest } from '../lib/http.js';

const uploadRoot = resolve(process.cwd(), env.uploadDir);

export default async function uploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Accept a single file (image or avatar) and return its public URL.
  app.post('/', async (req) => {
    const data = await req.file();
    if (!data) throw badRequest('No file provided');

    const wsId = (data.fields?.workspaceId as any)?.value as string | undefined;
    const safeExt = extname(data.filename || '').slice(0, 10).replace(/[^.a-z0-9]/gi, '');
    const filename = `${nanoid()}${safeExt}`;
    const dir = resolve(uploadRoot, new Date().toISOString().slice(0, 7)); // YYYY-MM buckets
    await mkdir(dir, { recursive: true });
    const dest = resolve(dir, filename);

    await pipeline(data.file, createWriteStream(dest));
    if (data.file.truncated) throw badRequest(`File exceeds ${env.maxUploadMb}MB limit`);

    const url = `/uploads/${new Date().toISOString().slice(0, 7)}/${filename}`;
    const record = await prisma.upload.create({
      data: {
        userId: req.currentUser!.id,
        workspaceId: wsId ?? null,
        filename,
        originalName: data.filename || filename,
        mime: data.mimetype,
        size: 0,
        url,
      },
    });
    return { upload: { id: record.id, url, name: record.originalName, mime: record.mime } };
  });
}

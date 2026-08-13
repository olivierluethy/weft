import type { FastifyRequest } from 'fastify';
import { prisma } from '../db.js';
import { parseUserAgent } from './ua.js';
import { geolocate } from './geo.js';
import { clientIp } from './http.js';

/** Append a formatted entry to the login audit log. Never throws. */
export async function recordLoginEvent(
  req: FastifyRequest,
  userId: string,
  kind: string,
  success = true,
): Promise<void> {
  try {
    const info = parseUserAgent(req.headers['user-agent']);
    const ip = clientIp(req);
    const location = await geolocate(ip);
    await prisma.loginEvent.create({
      data: { userId, kind, success, ip, location, ...info },
    });
  } catch {
    /* auditing must never block the request */
  }
}

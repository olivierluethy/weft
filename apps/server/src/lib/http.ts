/** Small typed HTTP error used across routes; the global error handler maps it. */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (m: string) => new HttpError(400, m, 'bad_request');
export const unauthorized = (m = 'Not authenticated') => new HttpError(401, m, 'unauthorized');
export const forbidden = (m = 'You do not have access') => new HttpError(403, m, 'forbidden');
export const notFound = (m = 'Not found') => new HttpError(404, m, 'not_found');
export const conflict = (m: string) => new HttpError(409, m, 'conflict');

/** Extract the client IP honouring a single proxy hop. */
export function clientIp(req: { ip: string; headers: Record<string, unknown> }): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0]!.trim();
  return req.ip;
}

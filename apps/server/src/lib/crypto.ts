import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';

/** Argon2id password hashing. */
export const hashPassword = (plain: string) => argon2.hash(plain, { type: argon2.argon2id });
export const verifyPassword = (hash: string, plain: string) =>
  argon2.verify(hash, plain).catch(() => false);

/** Opaque URL-safe random token (for refresh tokens, reset & invite links). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Deterministic hash we store instead of the raw token, so a DB leak can't be replayed. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

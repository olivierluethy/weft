import { z } from 'zod';
import { ROLES, SHARE_PERMISSIONS } from './roles.js';

/** Shared request/response contracts. The server validates with these; the web
 * app imports the inferred types so both ends stay in lock-step. */

// ── Auth ──────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(80),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: z.string().email() });
export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  bio: z.string().max(280).optional(),
  avatarUrl: z.string().nullable().optional(),
});
export const updateEmailSchema = z.object({
  email: z.string().email(),
  currentPassword: z.string().min(1),
});
export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// ── Pages ─────────────────────────────────────────────────────────────
export const createPageSchema = z.object({
  workspaceId: z.string(),
  parentId: z.string().nullable().optional(),
  title: z.string().max(300).optional(),
  icon: z.string().nullable().optional(),
  templateId: z.string().optional(),
});
export type CreatePageInput = z.infer<typeof createPageSchema>;

export const updatePageSchema = z.object({
  title: z.string().max(300).optional(),
  icon: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  coverOffsetY: z.number().optional(),
  backgroundUrl: z.string().nullable().optional(),
  content: z.any().optional(), // BlockNote document JSON
  isLocked: z.boolean().optional(),
  isFullWidth: z.boolean().optional(),
  width: z.number().min(400).max(1400).optional(),
  customCss: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
});
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

export const movePageSchema = z.object({
  parentId: z.string().nullable(),
  /** Fractional/integer order key within the new parent. */
  position: z.number(),
});

// ── Workspaces / members / invites ────────────────────────────────────
export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
  globalCss: z.string().optional(),
});
export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLES).default('editor'),
});
export const updateMemberSchema = z.object({ role: z.enum(ROLES) });

// ── Sharing ───────────────────────────────────────────────────────────
export const createShareLinkSchema = z.object({
  pageId: z.string(),
  permission: z.enum(SHARE_PERMISSIONS).default('view'),
  includeChildren: z.boolean().default(true),
});

// ── Comments ──────────────────────────────────────────────────────────
export const createCommentSchema = z.object({
  pageId: z.string(),
  body: z.string().min(1).max(4000),
  blockId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
});

// ── Tags ──────────────────────────────────────────────────────────────
export const createTagSchema = z.object({
  workspaceId: z.string(),
  name: z.string().min(1).max(40),
  color: z.string().max(20).optional(),
});

// ── Version history ───────────────────────────────────────────────────
export const createVersionSchema = z.object({
  pageId: z.string(),
  content: z.any(),
  label: z.string().max(120).optional(),
  kind: z.enum(['manual', 'auto', 'blur', 'restore']).default('auto'),
});

// ── Search ────────────────────────────────────────────────────────────
export const searchSchema = z.object({
  q: z.string().min(1),
  workspaceId: z.string().optional(),
});

// ── Public API view types (mirrors of Prisma rows, trimmed) ───────────
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface SessionView {
  id: string;
  current: boolean;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  remember: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface LoginEventView {
  id: string;
  kind: string;
  success: boolean;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  createdAt: string;
}

export interface PageTreeNode {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  position: number;
  isFavorite: boolean;
  isLocked: boolean;
  hasChildren: boolean;
  updatedAt: string;
}

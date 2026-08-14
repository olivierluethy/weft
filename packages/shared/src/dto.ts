import { z } from 'zod';
import { ROLES, SHARE_PERMISSIONS } from './roles.js';
import { PAGE_FONT_KEYS } from './constants.js';

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
  coverOffsetX: z.number().min(0).max(100).optional(),
  coverOffsetY: z.number().min(0).max(100).optional(),
  coverScale: z.number().min(1).max(4).optional(),
  backgroundUrl: z.string().nullable().optional(),
  content: z.any().optional(), // BlockNote document JSON
  isLocked: z.boolean().optional(),
  isFullWidth: z.boolean().optional(),
  width: z.number().min(400).max(1400).optional(),
  fontFamily: z.enum(PAGE_FONT_KEYS).optional(),
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

// ── Workspace overview ────────────────────────────────────────────────
/** One page as shown in the Workspace Overview: created/edited timestamps and
 * an approximate content size (word count) so pages can be compared at a
 * glance. Word count is computed server-side from the page's BlockNote content;
 * this is why the overview has its own endpoint rather than reusing the (lean)
 * sidebar tree. */
export interface WorkspaceOverviewPage {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  childCount: number;
}

// ── Activity history ──────────────────────────────────────────────────
/** A single real change in the workspace. Derived from durable records only —
 * page creation (`Page.createdAt`) and content snapshots (`Version` rows,
 * written when a user leaves an edited page / restores / saves) — never from
 * transient UI state, so the feed reflects actual document changes. */
export interface ActivityEvent {
  /** Stable React key: `created:<pageId>` for creation, the version id for edits. */
  id: string;
  type: 'created' | 'edited';
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  /** ISO timestamp of the change. */
  at: string;
  /** Word count at this point (0 for an empty/new page). */
  wordCount: number;
  /** Word count of the previous snapshot of the same page, for a delta. */
  prevWordCount: number | null;
  /** Version id (edits only) — fetch its content to show what changed. */
  versionId: string | null;
  /** Predecessor version id (edits only) — the other side of the diff. */
  prevVersionId: string | null;
  /** Version kind: manual | auto | blur | restore (edits only). */
  kind: string | null;
}

export interface ActivityFeed {
  events: ActivityEvent[];
  /** Overall activity span, so the client can build year/month navigation. */
  range: { earliest: string; latest: string } | null;
  /** The window these events cover. `year`/`month` describe the calendar
   * selection (month is null for a whole-year view; both null for a custom
   * range); `from`/`to` are the resolved ISO half-open bounds `[from, to)`. */
  window: { year: number | null; month: number | null; from: string; to: string };
  /** True when the window held more events than the returned cap. */
  truncated: boolean;
}

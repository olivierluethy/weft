/** Workspace/page membership roles, ordered from most to least privileged. */
export const ROLES = ['owner', 'editor', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { owner: 3, editor: 2, viewer: 1 };

/** True when `role` is at least as privileged as `required`. */
export function roleAtLeast(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

export const canEdit = (role: Role) => roleAtLeast(role, 'editor');
export const canManage = (role: Role) => roleAtLeast(role, 'owner');

/** Share link permission for public/invite links. */
export const SHARE_PERMISSIONS = ['view', 'edit'] as const;
export type SharePermission = (typeof SHARE_PERMISSIONS)[number];

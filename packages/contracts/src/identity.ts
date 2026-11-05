/**
 * @file Identity shapes shared by REST and the web client (docs/04 §3.2, §3.3, §3.5).
 * @description No response schema here ever carries a password, hash or stored secret. An arch test scans
 * for those names.
 */
import { z } from 'zod';

import { roleSchema } from './roles';

export const LOCALES = ['ar', 'en'] as const;
export const localeSchema = z.enum(LOCALES);

/** Token names of the avatar palette; a user gets one at creation (docs/03 §2). */
export const AVATAR_COLORS = [
  'teal',
  'indigo',
  'amber',
  'rose',
  'emerald',
  'sky',
  'violet',
  'orange',
  'lime',
  'pink',
  'cyan',
  'slate',
] as const;
export const avatarColorSchema = z.enum(AVATAR_COLORS);

export const API_TOKEN_KINDS = ['mcp', 'hook'] as const;
export type ApiTokenKind = (typeof API_TOKEN_KINDS)[number];

const password = z.string().min(1).max(1024);
const displayName = z.string().trim().min(1).max(80);
const totpCode = z.string().regex(/^\d{6}$/);

export const signInSchema = z.object({ email: z.email(), password });
export const totpVerifySchema = z.object({ challenge: z.string().min(1).max(2048), code: totpCode });
export const totpRecoverSchema = z.object({
  challenge: z.string().min(1).max(2048),
  recoveryCode: z.string().min(1).max(64),
});
export const totpCodeSchema = z.object({ code: totpCode });
export const passwordForgotSchema = z.object({ email: z.email() });
export const passwordResetSchema = z.object({ token: z.string().min(1).max(256), password });
export const passwordChangeSchema = z.object({ current: password, next: password });
export const acceptInviteSchema = z.object({
  displayName: displayName.optional(),
  password: password.optional(),
  locale: localeSchema.optional(),
});
export const updateProfileSchema = z.object({
  displayName: displayName.optional(),
  locale: localeSchema.optional(),
  avatarColor: avatarColorSchema.optional(),
});
export const createApiTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(API_TOKEN_KINDS).default('mcp'),
});
export const setDefaultProjectSchema = z.object({ slug: z.string().min(1).max(32) });

export const meWorkspaceSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  status: z.string(),
  roles: z.array(roleSchema),
  timezone: z.string(),
  defaultLocale: z.string(),
  totpRequired: z.boolean(),
});
export type MeWorkspace = z.infer<typeof meWorkspaceSchema>;

export const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  locale: z.string(),
  avatarColor: z.string(),
  totpEnabled: z.boolean(),
  createdAt: z.string(),
  /** Slug of the project a chat lands on when nothing else names one (docs/15 §5). */
  defaultProject: z.string().nullable(),
  workspaces: z.array(meWorkspaceSchema),
});
export type Me = z.infer<typeof meSchema>;

export const signInResultSchema = z.object({
  totpRequired: z.boolean(),
  user: meSchema.optional(),
  challenge: z.string().optional(),
});

export const refreshResultSchema = z.object({ expiresAt: z.string() });

export const totpSetupResultSchema = z.object({
  secret: z.string(),
  otpauthUrl: z.string(),
  qrDataUrl: z.string(),
});
export const totpConfirmResultSchema = z.object({ recoveryCodes: z.array(z.string()) });

export const sessionRowSchema = z.object({
  familyId: z.string(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  current: z.boolean(),
});

export const apiTokenRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(API_TOKEN_KINDS),
  prefix: z.string(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  revokedAt: z.string().nullable(),
});
export const apiTokenCreatedSchema = z.object({
  id: z.string(),
  /** The full token, shown this one time. */
  token: z.string(),
  prefix: z.string(),
  name: z.string(),
  kind: z.enum(API_TOKEN_KINDS),
});

export const invitePreviewSchema = z.object({
  email: z.string(),
  workspace: z.object({ slug: z.string(), name: z.string() }),
  roles: z.array(z.string()),
  expiresAt: z.string(),
  invitedBy: z.string(),
});
export const inviteAcceptedSchema = z.object({
  user: meSchema,
  workspace: z.object({ slug: z.string() }),
});
export const inviteRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  roles: z.array(z.string()),
  createdBy: z.string(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
});
export const createInviteSchema = z.object({
  email: z.email(),
  roles: z.array(z.string()).min(1).max(7),
});
export const inviteCreatedSchema = z.object({
  id: z.string(),
  email: z.string(),
  roles: z.array(z.string()),
  expiresAt: z.string(),
  /** The invite link, shown this one time. */
  url: z.string(),
});
/** A link shown one time: a resent invite, or a reset link an owner hands to a member. */
export const oneTimeUrlSchema = z.object({ url: z.string() });

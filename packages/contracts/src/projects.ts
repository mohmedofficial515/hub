/**
 * @file Project fields (a project is a workspace with extra details, D30, docs/15 §5) and source kinds.
 */
import { z } from 'zod';

export const PROJECT_STATUSES = ['active', 'paused', 'closed'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const projectLinkSchema = z.object({
  label: z.string().min(1).max(80),
  url: z.url(),
});
export type ProjectLink = z.infer<typeof projectLinkSchema>;

export const projectSlugSchema = z.string().regex(/^[a-z0-9-]{2,32}$/);
export const keyPrefixSchema = z.string().regex(/^[A-Z]{2,6}$/);

/** The `X-Hub-Project` header that `hub link <slug>` writes into a folder's `.mcp.json`. */
export const PROJECT_HEADER = 'x-hub-project';

export const SOURCE_KINDS = ['github_repo', 'openapi', 'lab', 'docs_folder', 'local_path'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** `kind: local_path` config (docs/15 §3): an absolute folder read directly, with no clone. */
export const localPathSourceConfigSchema = z.object({
  path: z.string().min(1),
  purpose: z.enum(['docs', 'lab']),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  kinds: z.record(z.string(), z.string()).optional(),
});
export type LocalPathSourceConfig = z.infer<typeof localPathSourceConfigSchema>;

const SOURCE_NAME = /^[a-z0-9-]{2,32}$/;
const markdown = z.string().max(20_000);
export const absolutePath = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => /^([A-Za-z]:[\\/]|\/)/.test(value) && !/(^|[\\/])\.\.([\\/]|$)/.test(value), {
    message: 'must be an absolute path without ..',
  });

export const githubRepoSourceConfigSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  defaultBranch: z.string().min(1).max(200).default('main'),
  app: z.string().min(1).max(40),
  clonePath: z.string().min(1).max(300).optional(),
});
export const openapiSourceConfigSchema = z.object({
  repoSourceId: z.uuid(),
  path: z.string().min(1).max(300),
  toRole: z.string().min(1).max(40),
  fromRole: z.string().min(1).max(40),
});
export const labSourceConfigSchema = z.object({
  root: z.string().min(1).max(500),
  apps: z.array(z.string().min(1).max(40)).max(20),
  publicBase: z.string().max(200).optional(),
});
export const docsFolderSourceConfigSchema = z.object({
  repoSourceId: z.uuid(),
  path: z.string().min(1).max(300),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  kinds: z.record(z.string(), z.string()).optional(),
});

/** Config per kind (docs/03 §4.3). */
export const SOURCE_CONFIG_SCHEMAS = {
  github_repo: githubRepoSourceConfigSchema,
  openapi: openapiSourceConfigSchema,
  lab: labSourceConfigSchema,
  docs_folder: docsFolderSourceConfigSchema,
  local_path: localPathSourceConfigSchema.extend({ path: absolutePath }),
} as const satisfies Record<SourceKind, z.ZodType>;

export const createProjectSchema = z.object({
  slug: projectSlugSchema,
  name: z.string().trim().min(1).max(80),
  keyPrefix: keyPrefixSchema,
  timezone: z.string().min(1).max(64).optional(),
  defaultLocale: z.enum(['ar', 'en']).optional(),
  description: markdown.optional(),
  goals: markdown.optional(),
  links: z.array(projectLinkSchema).max(50).optional(),
  repoPaths: z.array(absolutePath).max(50).optional(),
  /** Adds a `local_path` docs source named `docs` (docs/15 §5, the wizard's optional folder). */
  docsPath: absolutePath.optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().min(1).max(64).optional(),
  defaultLocale: z.enum(['ar', 'en']).optional(),
  description: markdown.nullable().optional(),
  goals: markdown.nullable().optional(),
  links: z.array(projectLinkSchema).max(50).optional(),
  repoPaths: z.array(absolutePath).max(50).optional(),
  /** Closing has its own route, because it needs the owner. */
  status: z.enum(['active', 'paused']).optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  timezone: z.string(),
  defaultLocale: z.string(),
  description: z.string().nullable(),
  goals: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  repoPaths: z.array(z.string()),
  status: z.enum(PROJECT_STATUSES),
  closedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export const projectCountsSchema = z.object({
  openDecisions: z.number().int(),
  pendingHandoffs: z.number().int(),
  openNeeds: z.number().int(),
  readyTasks: z.number().int(),
});
export type ProjectCounts = z.infer<typeof projectCountsSchema>;

export const projectDetailSchema = projectSchema.extend({
  myRoles: z.array(z.string()),
  counts: projectCountsSchema,
});

export const projectListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  status: z.string(),
  roles: z.array(z.string()),
  timezone: z.string(),
  defaultLocale: z.string(),
  totpRequired: z.boolean(),
  isDefault: z.boolean(),
  counts: projectCountsSchema,
  /** Cards waiting on this member here: the rule and number of `GET /cards?awaiting=me`. */
  awaitingCount: z.number().int(),
});

export const memberRowSchema = z.object({
  userId: z.string(),
  email: z.string(),
  displayName: z.string(),
  avatarColor: z.string(),
  roles: z.array(z.string()),
  status: z.string(),
  joinedAt: z.string(),
  lastSeenAt: z.string().nullable(),
  githubLogins: z.array(z.string()),
  totpEnabled: z.boolean(),
});
export type MemberRow = z.infer<typeof memberRowSchema>;
export const updateMemberRolesSchema = z.object({ roles: z.array(z.string()).min(1).max(7) });
export const githubLoginsSchema = z.object({
  logins: z.array(z.string().regex(/^[A-Za-z0-9-]{1,39}$/)).max(20),
});

export const settingRowSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  default: z.unknown(),
  isDefault: z.boolean(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
export type SettingRow = z.infer<typeof settingRowSchema>;
export const settingCatalogueRowSchema = z.object({
  key: z.string(),
  type: z.string(),
  schema: z.record(z.string(), z.unknown()),
  description: z.object({ ar: z.string(), en: z.string() }),
  group: z.string(),
});
export const putSettingSchema = z.object({ value: z.unknown() });

export const createSourceSchema = z.object({
  kind: z.string(),
  name: z.string().regex(SOURCE_NAME),
  config: z.record(z.string(), z.unknown()),
  /** Web only. Encrypted at rest and never returned. */
  secret: z.string().min(1).max(4096).optional(),
});
export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export const updateSourceSchema = z.object({
  name: z.string().regex(SOURCE_NAME).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  /** Web only. Null clears it. */
  secret: z.string().min(1).max(4096).nullable().optional(),
  enabled: z.boolean().optional(),
});
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export const sourceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  config: z.record(z.string(), z.unknown()),
  hasSecret: z.boolean(),
  enabled: z.boolean(),
  cursor: z.record(z.string(), z.unknown()),
  lastRunAt: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  lastError: z.string().nullable(),
  lagSec: z.number().nullable(),
  createdAt: z.string(),
});
export type SourceDto = z.infer<typeof sourceSchema>;
export const sourceTestResultSchema = z.object({
  ok: z.boolean(),
  details: z.object({ filesFound: z.number().int().optional() }),
});

export const onboardingGroupSchema = z.object({
  role: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      title: z.string(),
      ref: z.string(),
      done: z.boolean(),
      doneAt: z.string().nullable(),
      /** A `doc` item's card, once a source has indexed that path; null shows an honest "not indexed yet". */
      cardKey: z.string().nullable(),
    }),
  ),
});
export type OnboardingGroup = z.infer<typeof onboardingGroupSchema>;

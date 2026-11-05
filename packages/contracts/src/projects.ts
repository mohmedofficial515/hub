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

/**
 * @file Skills (docs/16 §11, D64 to D66): Hub's own skills, which the plugin carries to every device, and the owner's personal skills, shown read only with Move to Hub.
 * @description Hub's skills are folders of `packages/team-pack/plugin/skills` on the main machine. The panel writes them through Hub, which keeps each earlier text as a revision,
 * and every paired device takes the new plugin on the bridge's next sync. Personal skills are `~/.claude/skills` on the main machine: Hub only reads them, and Move to Hub copies one,
 * never deleting or changing the original. Skill text is plain Markdown and passes the secret filter like anything else Hub stores.
 */
import { z } from 'zod';

/** A skill's folder and its name in Claude Code: lowercase words joined by single dashes. `/hub:<name>` when a person types it. */
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const skillNameSchema = z.string().trim().min(1).max(64).regex(SKILL_NAME_PATTERN);

/**
 * Hub's own protocols. Hub's code and tests depend on their words (`/hub:work`'s report, `/hub:doc`'s draft, `/hub:suggest`'s proposals), so the panel shows them and does not edit them
 * (D65): they change with Hub's code. Their names cannot be taken by another skill.
 */
export const HUB_CORE_SKILLS = ['ask', 'doc', 'guide', 'plan', 'suggest', 'work'] as const;
export type HubCoreSkill = (typeof HUB_CORE_SKILLS)[number];
export const isCoreSkill = (name: string): boolean => (HUB_CORE_SKILLS as readonly string[]).includes(name);

export const SKILL_SOURCES = ['hub', 'personal'] as const;
export type SkillSource = (typeof SKILL_SOURCES)[number];

export const SKILL_LIMITS = {
  description: 1_024,
  body: 100_000,
  /** Move to Hub copies a whole folder: its files, each one and all together. */
  files: 200,
  fileBytes: 500_000,
  totalBytes: 2_000_000,
} as const;

/** How Hub's plugin reaches devices. `auto` syncs when a bridge connects and after each change; `manual` only on the owner's Sync now (a throwaway test stack). */
export const PLUGIN_SYNC_MODES = ['auto', 'manual'] as const;
export type PluginSyncMode = (typeof PLUGIN_SYNC_MODES)[number];

export const skillDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  online: z.boolean(),
  /** This device has this skill's current text. */
  synced: z.boolean(),
});
export type SkillDevice = z.infer<typeof skillDeviceSchema>;

export const skillSummarySchema = z.object({
  /** The folder's name. */
  name: z.string(),
  /** The `name` in the file, when it differs from the folder (a personal skill only). */
  declaredName: z.string().nullable(),
  description: z.string(),
  source: z.enum(SKILL_SOURCES),
  /** One of Hub's own protocols: read only here (D65). */
  core: z.boolean(),
  /** A person can type it: `/hub:<name>` for Hub's, `/<name>` for a personal one. */
  userInvocable: z.boolean(),
  /** Files in the folder, `SKILL.md` included. */
  files: z.number().int(),
  /** Of the whole folder, so a device can say whether it has this version. */
  hash: z.string(),
  updatedAt: z.string().nullable(),
  /** Hub's: each paired device and whether it has this text. Empty for a personal skill. */
  devices: z.array(skillDeviceSchema),
  /** Personal: a Hub skill already has this name, so Move to Hub needs another one. */
  nameInHub: z.boolean(),
});
export type SkillSummary = z.infer<typeof skillSummarySchema>;

export const pluginDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  online: z.boolean(),
  /** The plugin version the device last took, or null when it never synced. */
  version: z.string().nullable(),
  syncedAt: z.string().nullable(),
  /** What the last sync said when it failed. Cleared by the next good one. */
  error: z.string().nullable(),
  /** It has the current version. */
  current: z.boolean(),
});
export type PluginDevice = z.infer<typeof pluginDeviceSchema>;

export const skillsSchema = z.object({
  hub: z.array(skillSummarySchema),
  personal: z.array(skillSummarySchema),
  /** Where personal skills are read from on the main machine, for the page's words. Null when that folder does not exist. */
  personalFolder: z.string().nullable(),
  sync: z.object({
    /** The plugin version every device should have now: it changes with any file of the plugin. */
    version: z.string(),
    mode: z.enum(PLUGIN_SYNC_MODES),
    devices: z.array(pluginDeviceSchema),
  }),
});
export type Skills = z.infer<typeof skillsSchema>;

export const skillDetailSchema = skillSummarySchema.extend({
  /** The Markdown after the front matter. Personal text is shown with any secret-looking value masked. */
  body: z.string(),
  /** The folder's other files, relative, for the page to name. Hub never shows a file it did not write. */
  otherFiles: z.array(z.string()),
});
export type SkillDetail = z.infer<typeof skillDetailSchema>;

const descriptionSchema = z.string().trim().min(1).max(SKILL_LIMITS.description);
const bodySchema = z.string().max(SKILL_LIMITS.body);

export const createSkillSchema = z.object({
  name: skillNameSchema,
  description: descriptionSchema,
  body: bodySchema,
  userInvocable: z.boolean().default(true),
});
export type CreateSkillInput = z.infer<typeof createSkillSchema>;

export const updateSkillSchema = z.object({
  description: descriptionSchema,
  body: bodySchema,
  userInvocable: z.boolean(),
  /** The `hash` the page showed: a save over a newer text is refused (`hub.skills.stale_base`). */
  baseHash: z.string().min(1).max(128),
});
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;

export const moveSkillSchema = z.object({
  /** The personal skill's folder. */
  name: skillNameSchema,
  /** The name in Hub, when the folder's own name is taken. */
  as: skillNameSchema.optional(),
});
export type MoveSkillInput = z.infer<typeof moveSkillSchema>;

export const SKILL_REVISION_REASONS = ['edit', 'restore'] as const;

export const skillRevisionSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The text this revision keeps: what the file held before that save. */
  hash: z.string(),
  reason: z.enum(SKILL_REVISION_REASONS),
  savedBy: z.object({ id: z.string(), displayName: z.string() }).nullable(),
  createdAt: z.string(),
});
export type SkillRevision = z.infer<typeof skillRevisionSchema>;

export const skillRevisionDetailSchema = skillRevisionSchema.extend({ text: z.string() });
export type SkillRevisionDetail = z.infer<typeof skillRevisionDetailSchema>;

export const restoreSkillRevisionSchema = z.object({ baseHash: z.string().min(1).max(128) });

export const skillWrittenSchema = z.object({
  skill: skillDetailSchema,
  /** The earlier text, kept as a revision. Null for a new skill or a save that changed nothing. */
  revisionId: z.string().nullable(),
  /** Devices asked to take the new plugin now. Others take it when their bridge next connects. */
  syncing: z.number().int(),
});
export type SkillWritten = z.infer<typeof skillWrittenSchema>;

export const pluginSyncResultSchema = z.object({
  devices: z.array(pluginDeviceSchema),
});

// ── The bridge's side (`plugin.sync`) ────────────────────────────────────────────────────────────

/** A plugin version Hub made: the package's own, then `-sync.` and the start of the files' hash. */
export const PLUGIN_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-sync\.[0-9a-f]{8,64})?$/;

export const PLUGIN_SYNC_OUTCOMES = ['installed', 'updated', 'up_to_date'] as const;
export const pluginSyncAnswerSchema = z.object({
  outcome: z.enum(PLUGIN_SYNC_OUTCOMES),
  version: z.string().regex(PLUGIN_VERSION_PATTERN),
});
export type PluginSyncAnswer = z.infer<typeof pluginSyncAnswerSchema>;

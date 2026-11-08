/**
 * @file Nightly backups and publishing over Tailscale (docs/16 §10, "Slice 6 as built", D61 to D63).
 * @description A backup is one folder on the machine Hub runs on: a `pg_dump` of Hub's database, the current text of every document Hub
 * wrote through `save_doc`, and a manifest. Nothing in it is a secret: `.env` and the device credentials are never copied. The history
 * is the database's `backups` table; a file the owner deleted keeps its row, marked deleted, so the history never loses a line.
 */
import { z } from 'zod';

export const BACKUP_STATUSES = ['running', 'done', 'failed'] as const;
export type BackupStatus = (typeof BACKUP_STATUSES)[number];

/** `catch_up` is a nightly run that starts late, because Hub was off at its time. */
export const BACKUP_TRIGGERS = ['scheduled', 'catch_up', 'manual'] as const;
export type BackupTrigger = (typeof BACKUP_TRIGGERS)[number];

/** Who removed a backup's files: the owner's press, or the retention rule. */
export const BACKUP_REMOVERS = ['owner', 'retention'] as const;
export type BackupRemover = (typeof BACKUP_REMOVERS)[number];

/** D62: every night at 03:00 machine time, the last 14 unpinned backups kept, pinned ones forever. */
export const BACKUP_DEFAULTS = { time: '03:00', keep: 14, enabled: true } as const;
export const BACKUP_LIMITS = { keepMin: 1, keepMax: 365, folderMax: 260, historyMax: 200 } as const;
/** The history warns when the backup drive has less free space than this, or less than this share of the drive. */
export const BACKUP_LOW_DISK = { minFreeBytes: 5 * 1024 ** 3, minFreeRatio: 0.1 } as const;

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');

export const backupSchema = z.object({
  id: z.uuid(),
  status: z.enum(BACKUP_STATUSES),
  trigger: z.enum(BACKUP_TRIGGERS),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  /** The backup's folder on the main machine. */
  path: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  /** Documents whose current text was copied beside the dump. */
  docs: z.number().int().nullable(),
  pinned: z.boolean(),
  /** What went wrong, in plain words, never a secret. */
  failure: z.string().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.enum(BACKUP_REMOVERS).nullable(),
  /** A finished backup whose folder is no longer on the disk, though nobody deleted it through Hub. */
  missing: z.boolean(),
});
export type BackupDto = z.infer<typeof backupSchema>;

export const backupSettingsSchema = z.object({
  folder: z.string(),
  /** `default` while the owner has not chosen one: a `HubBackups` folder at the root of Hub's own drive. */
  folderSource: z.enum(['setting', 'default']),
  defaultFolder: z.string(),
  time: timeOfDay,
  keep: z.number().int(),
  enabled: z.boolean(),
  /** The machine's timezone, which the nightly time is read in. */
  timezone: z.string(),
});
export type BackupSettingsDto = z.infer<typeof backupSettingsSchema>;

export const backupDiskSchema = z.object({
  freeBytes: z.number().int(),
  totalBytes: z.number().int(),
  low: z.boolean(),
});
export type BackupDisk = z.infer<typeof backupDiskSchema>;

export const backupsSchema = z.object({
  items: z.array(backupSchema),
  settings: backupSettingsSchema,
  /** Null when the folder's drive cannot be read. */
  disk: backupDiskSchema.nullable(),
  /** The next nightly start, or null when the schedule is off. */
  nextAt: z.string().nullable(),
  running: z.boolean(),
});
export type BackupsDto = z.infer<typeof backupsSchema>;

export const backupSettingsInputSchema = z
  .object({
    /** An absolute folder outside any Git checkout. Null goes back to the default. */
    folder: z.string().trim().min(1).max(BACKUP_LIMITS.folderMax).nullable(),
    time: timeOfDay,
    keep: z.number().int().min(BACKUP_LIMITS.keepMin).max(BACKUP_LIMITS.keepMax),
    enabled: z.boolean(),
  })
  .partial();
export type BackupSettingsInput = z.infer<typeof backupSettingsInputSchema>;

export const pinBackupSchema = z.object({ pinned: z.boolean() });
export type PinBackupInput = z.infer<typeof pinBackupSchema>;

/** True when the drive is short of space, by either rule. */
export function isLowDisk(freeBytes: number, totalBytes: number): boolean {
  if (freeBytes < BACKUP_LOW_DISK.minFreeBytes) return true;
  return totalBytes > 0 && freeBytes / totalBytes < BACKUP_LOW_DISK.minFreeRatio;
}

// ── Publishing over Tailscale (D43, docs/16 §10) ─────────────────────────────────────────────────

export const publishingSchema = z.object({
  /** `HUB_PUBLIC_URL`: what links, cookies and CORS follow. */
  publicUrl: z.string(),
  /** Where another device reaches `/mcp`, `/bridge` and the connect script; null means the browser's host on the API port. */
  apiPublicUrl: z.string().nullable(),
  /** On when `HUB_PUBLIC_URL` is https, so a browser on another device keeps the session cookies. */
  secureCookies: z.boolean(),
  /** The address the API listens on; null is every interface. */
  bindHost: z.string().nullable(),
  tailscale: z.object({
    installed: z.boolean(),
    /** Signed in and connected to the tailnet. */
    running: z.boolean(),
    /** This machine's name on the tailnet, such as `main-pc.tail1234.ts.net`. */
    dnsName: z.string().nullable(),
    /** `tailscale serve` sends https `/` to Hub's web. */
    servesWeb: z.boolean(),
    /** It also sends `/mcp` and `/bridge` to Hub's API. */
    servesApi: z.boolean(),
    /** The served address is the one `HUB_PUBLIC_URL` names. */
    matchesPublicUrl: z.boolean(),
  }),
});
export type PublishingDto = z.infer<typeof publishingSchema>;

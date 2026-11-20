/**
 * @file Devices and the bridge channel (docs/16 §4, §5): pairing, the health panel, and the socket's frames.
 * @description A device is one machine running `hub-bridge`. It connects out to Hub, so Hub can only ask it to run one of
 * `BRIDGE_ACTIONS`, a closed list: there is no action that takes a command. Frames are versioned, and an action's answer is one
 * `result` with any number of `event` frames before it, which is what lets Slice 3 stream a chat turn over this same channel.
 * The bridge is plain Node with no dependencies, so `packages/bridge/lib/protocol.mjs` restates these names and a test holds the two together.
 */
import { z } from 'zod';

import { absolutePath } from './projects';

export const BRIDGE_PROTOCOL_VERSION = 1;

/** The socket's address on the API origin, outside `/api/v1`, as `/mcp` is. */
export const BRIDGE_SOCKET_PATH = '/bridge';

/**
 * Close codes the bridge acts on. A revoked device stops trying; anything else retries with a backoff.
 * `unavailable` (the standard "try again later") is sent when Hub could not check the credential, for example while its database is down, so a passing fault is never read as a revocation.
 */
export const BRIDGE_CLOSE = {
  revoked: 4401,
  replaced: 4409,
  unsupportedProtocol: 4426,
  unavailable: 1013,
} as const;

/**
 * Everything Hub can ask of a bridge. Nothing here takes a command, and a folder argument must be on the allowlist.
 */
export const BRIDGE_ACTIONS = [
  'health.check',
  'health.fix',
  'folder.link',
  'turn.start',
  'turn.answer',
  'turn.stop',
  'turn.mode',
  'turn.files',
  'chat.close',
  'chat.diff',
  'engine.status',
  'doc.read',
  'doc.write',
  'schema.read',
  'vscode.open',
  'plugin.sync',
  'folder.status',
  'worktree.prepare',
  'worktree.remove',
  'file.read',
] as const;
export type BridgeAction = (typeof BRIDGE_ACTIONS)[number];

/** Why a bridge refused an action. Stable, because the API and the panel branch on them. */
export const BRIDGE_REFUSALS = [
  'unknown_action',
  'bad_arguments',
  'folder_not_allowed',
  'folder_missing',
  'not_implemented',
  'not_fixable',
  'turn_running',
  'vscode_missing',
  'failed',
  'not_a_repository',
  'worktree_dirty',
  'file_missing',
  'file_too_large',
  'file_type',
] as const;
export type BridgeRefusal = (typeof BRIDGE_REFUSALS)[number];

/** `folder.status`: what Git says about a folder before a queued run starts in it (docs/16 §9.2). Read only. */
export const folderStatusSchema = z.object({
  repository: z.boolean(),
  /** Files with changes not committed, untracked ones included. 0 when it is not a repository. */
  changed: z.number().int().min(0),
  branch: z.string().nullable(),
});
export type FolderStatus = z.infer<typeof folderStatusSchema>;

/** `worktree.prepare`: the run's own copy, made or found again. `folder` is where the run works. */
export const worktreePreparedSchema = z.object({
  folder: z.string(),
  branch: z.string(),
  /** The commit it started from, and the branch that commit was on. */
  base: z.string(),
  baseBranch: z.string().nullable(),
  /** True when the copy was already there, as for a plan's next step. */
  reused: z.boolean(),
  /** How many `node_modules` folders of the repository it links to. */
  linked: z.number().int().min(0),
});
export type WorktreePrepared = z.infer<typeof worktreePreparedSchema>;

/** `worktree.remove`: the copy is gone and its branch stays, with every commit on it. */
export const worktreeRemovedSchema = z.object({ branch: z.string().nullable() });
export type WorktreeRemoved = z.infer<typeof worktreeRemovedSchema>;

export const DEVICE_PLATFORMS = ['win32', 'darwin', 'linux'] as const;
export const devicePlatformSchema = z.enum(DEVICE_PLATFORMS);

const deviceName = z.string().trim().min(1).max(80);

export const USER_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
export const userCodeSchema = z.string().trim().toUpperCase().regex(USER_CODE_PATTERN);

export const pairingStartSchema = z.object({ name: deviceName, platform: devicePlatformSchema });
export const pairingPollSchema = z.object({ deviceCode: z.string().min(32).max(128) });

export const PAIRING_STATUSES = ['pending', 'approved', 'denied', 'claimed', 'expired'] as const;
export type PairingStatus = (typeof PAIRING_STATUSES)[number];

/** Pairing lasts ten minutes, and a device asks every three seconds. */
export const PAIRING_TTL_SECONDS = 600;
export const PAIRING_POLL_SECONDS = 3;

/** The health panel's rows: what `hub doctor` checks, as data. `fix` names a closed list, never a command. */
export const HEALTH_CHECK_IDS = [
  'claude_found',
  'claude_version',
  'claude_path_version',
  'claude_signed_in',
  'mcp_server',
  'plugin',
  'login_start',
  'vscode',
] as const;
export type HealthCheckId = (typeof HEALTH_CHECK_IDS)[number];

export const HEALTH_FIXES = ['mcp_server', 'plugin', 'login_start'] as const;
export type HealthFix = (typeof HEALTH_FIXES)[number];

export const healthCheckSchema = z.object({
  id: z.enum(HEALTH_CHECK_IDS),
  ok: z.boolean(),
  /** `warn` does not stop anything: an older copy of Claude Code on PATH while a current one exists. */
  level: z.enum(['ok', 'warn', 'error']),
  /** Versions and paths, shown as they are. Sentences are the page's, by `id`. */
  detail: z.string().max(500).nullable(),
  fix: z.enum(HEALTH_FIXES).nullable(),
  /** What the owner can run when Hub cannot fix it. */
  hint: z.string().max(300).nullable(),
});
export type HealthCheck = z.infer<typeof healthCheckSchema>;

export const fixDeviceSchema = z.object({ fix: z.enum(HEALTH_FIXES) });

export const deviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.string(),
  online: z.boolean(),
  bridgeVersion: z.string().nullable(),
  claudeVersion: z.string().nullable(),
  vscodeFound: z.boolean().nullable(),
  lastSeenAt: z.string().nullable(),
  pairedAt: z.string(),
  health: z.array(healthCheckSchema),
  healthAt: z.string().nullable(),
});
export type DeviceDto = z.infer<typeof deviceSchema>;

export const linkFolderSchema = z.object({ folder: absolutePath });

/**
 * What the Link button did (D44). `linked`: trust and the folder's `hub` server were written, or were already right.
 * `shape_unexpected`: `~/.claude.json` was not as expected, so nothing in it changed, and the owner accepts the dialog once.
 */
export const LINK_OUTCOMES = ['linked', 'already_linked', 'shape_unexpected', 'mcp_failed'] as const;
export type LinkOutcome = (typeof LINK_OUTCOMES)[number];

export const linkResultSchema = z.object({
  outcome: z.enum(LINK_OUTCOMES),
  folder: z.string(),
  project: z.string(),
  /** Set when this press wrote `~/.claude.json`. */
  backup: z.string().nullable(),
  registered: z.boolean(),
});
export type LinkResult = z.infer<typeof linkResultSchema>;

// ── The socket ──────────────────────────────────────────────────────────────────────────────────

export interface AllowedFolder {
  readonly path: string;
  readonly project: string;
}

/** A bridge's report about itself. Sent on connect and with each heartbeat. */
const bridgeStatus = z.object({
  bridgeVersion: z.string().max(40).optional(),
  claudeVersion: z.string().max(40).nullable().optional(),
  vscodeFound: z.boolean().nullable().optional(),
});

/** What a bridge sends. Validated before anything reads it: the API trusts a device's credential, not its bytes. */
export const bridgeFrameSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    protocol: z.number().int(),
    status: bridgeStatus,
    actions: z.array(z.string().max(40)).max(32),
  }),
  z.object({ type: z.literal('heartbeat'), status: bridgeStatus }),
  /** One piece of an action's stream, in order by `seq`. Slice 3's turn events travel here. */
  z.object({
    type: z.literal('event'),
    id: z.string().max(64),
    seq: z.number().int().min(0),
    kind: z.string().max(64),
    data: z.unknown(),
  }),
  /** The one and only answer to an action. */
  z.object({
    type: z.literal('result'),
    id: z.string().max(64),
    ok: z.boolean(),
    data: z.unknown().optional(),
    error: z.object({ code: z.enum(BRIDGE_REFUSALS), message: z.string().max(500) }).optional(),
  }),
]);
export type BridgeFrame = z.infer<typeof bridgeFrameSchema>;

/** What Hub sends. */
export type HubFrame =
  | {
      readonly type: 'welcome';
      readonly protocol: number;
      readonly deviceId: string;
      readonly folders: readonly AllowedFolder[];
      /** Docs roots this device holds (docs/16 §10). A chat cannot run in one unless it is also a folder. */
      readonly docRoots?: readonly string[];
    }
  | {
      readonly type: 'allowlist';
      readonly folders: readonly AllowedFolder[];
      readonly docRoots?: readonly string[];
    }
  | {
      readonly type: 'action';
      readonly id: string;
      readonly action: BridgeAction;
      readonly args: Readonly<Record<string, unknown>>;
    };

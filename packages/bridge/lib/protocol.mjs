/**
 * @file The socket's names, as the bridge knows them. `@hub/contracts` (`devices.ts`) is the source; `test/protocol.spec.mjs` holds the two together.
 * @description The bridge has no dependencies, so it restates them. An action is answered by one `result` frame, with any number of `event` frames before it.
 */
export const BRIDGE_VERSION = '0.1.0';
export const BRIDGE_PROTOCOL_VERSION = 1;
export const BRIDGE_SOCKET_PATH = '/bridge';
export const BRIDGE_CLOSE = { revoked: 4401, replaced: 4409, unsupportedProtocol: 4426 };
export const BRIDGE_ACTIONS = [
  'health.check',
  'health.fix',
  'folder.link',
  'turn.start',
  'turn.answer',
  'turn.stop',
  'turn.files',
  'chat.close',
  'chat.diff',
  'engine.status',
  'doc.read',
  'doc.write',
  'vscode.open',
];
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
];
export const VSCODE_PROMPT_CHARS = 500;
export const VSCODE_LINK_PREFIX = 'vscode://anthropic.claude-code/open?prompt=';
export const HEALTH_FIXES = ['mcp_server', 'plugin', 'login_start'];
export const HEALTH_CHECK_IDS = [
  'claude_found',
  'claude_version',
  'claude_path_version',
  'claude_signed_in',
  'mcp_server',
  'plugin',
  'login_start',
  'vscode',
];

/** A refusal the dispatcher turns into a `result` with `ok: false`. */
export class Refusal extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}

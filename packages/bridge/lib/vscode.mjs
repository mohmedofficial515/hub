/**
 * @file Finding VS Code and handing it a folder and a prompt (docs/16 §8, S1 Q10, C8).
 * @description `code` on PATH is broken on the owner's machine: it resolves to a Cursor shim whose target is gone, and exits 9009. So on Windows the answer comes from the registry's `vscode://` handler, which points at the real `Code.exe`, and `bin\code.cmd` sits beside it.
 * `code.cmd` needs a shell, and a shell is what the bridge never uses, so `program` is what gets run: `Code.exe` itself on Windows, the resolved `code` elsewhere. It starts detached, because a `Code.exe` that is the first window keeps running until the owner closes it. A clean start only proves the handover, so the answer is `sent`, never "opened".
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

import { Refusal, VSCODE_LINK_PREFIX, VSCODE_PROMPT_CHARS } from './protocol.mjs';

/** The window gets a moment to open, so the link lands in it and not in whichever window was last used. */
const FOCUS_WAIT_MS = 3_000;

export function parseRegistryHandler(output) {
  const quoted = /"([^"]+\.exe)"/i.exec(output ?? '');
  return quoted?.[1] ?? null;
}

function hasClaudeExtension(system) {
  const extensions = join(system.home, '.vscode', 'extensions');
  if (!existsSync(extensions)) return false;
  return readdirSync(extensions).some((entry) => entry.startsWith('anthropic.claude-code-'));
}

const NOT_FOUND = { found: false, code: null, program: null, extension: false };

export async function resolveVsCode(system) {
  if (system.platform === 'win32') {
    const answer = await system.run('reg.exe', ['query', 'HKCR\\vscode\\shell\\open\\command', '/ve'], {
      timeoutMs: 10_000,
    });
    const exe = answer.status === 0 ? parseRegistryHandler(answer.stdout) : null;
    const codeCmd = exe ? join(dirname(exe), 'bin', 'code.cmd') : null;
    if (!codeCmd || !existsSync(codeCmd)) return NOT_FOUND;
    return { found: true, code: codeCmd, program: exe, extension: hasClaudeExtension(system) };
  }
  for (const folder of (system.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    const code = join(folder, 'code');
    if (existsSync(code)) return { found: true, code, program: code, extension: hasClaudeExtension(system) };
  }
  return NOT_FOUND;
}

/** Throws `bad_arguments` for what could not become a link: half a character cannot be encoded. */
export function linkFor(prompt) {
  if (typeof prompt !== 'string' || prompt === '' || prompt.length > VSCODE_PROMPT_CHARS) {
    throw new Refusal('bad_arguments');
  }
  try {
    return `${VSCODE_LINK_PREFIX}${encodeURIComponent(prompt)}`;
  } catch {
    throw new Refusal('bad_arguments');
  }
}

/** `vscode.open`. The folder rule has already run in `dispatch`. */
export async function openInVsCode(args, { system }) {
  const { folder, prompt } = args;
  const link = linkFor(prompt);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new Refusal('folder_missing');
  const { found, program } = await resolveVsCode(system);
  if (!found) throw new Refusal('vscode_missing');
  if (!system.spawnDetached(program, [folder])) throw new Refusal('vscode_missing');
  await system.sleep(FOCUS_WAIT_MS);
  // The same arguments Windows itself uses for this link, from the registry entry.
  if (!system.spawnDetached(program, ['--open-url', '--', link])) throw new Refusal('vscode_missing');
  return { sent: true };
}

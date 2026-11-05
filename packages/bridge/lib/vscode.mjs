/**
 * @file Finding VS Code (docs/16 S1 Q10, C8).
 * @description `code` on PATH is broken on the owner's machine: it resolves to a Cursor shim whose target is gone, and exits 9009. So on Windows the answer comes from
 * the registry's `vscode://` handler, which points at the real `Code.exe`, and `bin\code.cmd` sits beside it. Slice 4 opens a folder and the link with this.
 */
import { existsSync, readdirSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

export function parseRegistryHandler(output) {
  const quoted = /"([^"]+\.exe)"/i.exec(output ?? '');
  return quoted?.[1] ?? null;
}

function hasClaudeExtension(system) {
  const extensions = join(system.home, '.vscode', 'extensions');
  if (!existsSync(extensions)) return false;
  return readdirSync(extensions).some((entry) => entry.startsWith('anthropic.claude-code-'));
}

export async function resolveVsCode(system) {
  if (system.platform === 'win32') {
    const answer = await system.run('reg.exe', ['query', 'HKCR\\vscode\\shell\\open\\command', '/ve'], {
      timeoutMs: 10_000,
    });
    const exe = answer.status === 0 ? parseRegistryHandler(answer.stdout) : null;
    const codeCmd = exe ? join(dirname(exe), 'bin', 'code.cmd') : null;
    if (!codeCmd || !existsSync(codeCmd)) return { found: false, code: null, extension: false };
    return { found: true, code: codeCmd, extension: hasClaudeExtension(system) };
  }
  for (const folder of (system.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    const code = join(folder, 'code');
    if (existsSync(code)) return { found: true, code, extension: hasClaudeExtension(system) };
  }
  return { found: false, code: null, extension: false };
}

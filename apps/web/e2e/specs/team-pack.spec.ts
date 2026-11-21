/**
 * @file The quick start's Claude Code steps, for real: the installer, `doctor` and `link` with the real `claude` CLI against the running stack, in an isolated
 * home and CLAUDE_CONFIG_DIR, with `setx` skipped, so nothing global changes. No model call. On request: `E2E_PACK=1 pnpm test:e2e:web --grep "team pack"`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from '../support/hub';
import { API_URL } from '../support/ports';
import { shared } from '../support/state';

const BIN = resolve(__dirname, '../../../../packages/team-pack/bin/hub.mjs');
const LIB = resolve(__dirname, '../../../../packages/team-pack/lib/commands.mjs');

interface PackRun {
  status: number;
  stdout: string;
  stderr: string;
}
interface PackSystem {
  home: string;
  out: (line: string) => void;
  run: (command: string, args: string[]) => PackRun;
}
interface Pack {
  init(system: PackSystem, options: { url: string; token: string }): Promise<void>;
  realSystem(): PackSystem;
}

test('team pack: init, doctor and link work on this machine, with no secret on disk in .mcp.json', async ({
  locale,
  ws,
}) => {
  test.skip(!process.env['E2E_PACK'] || locale !== 'en', 'Set E2E_PACK=1 to run it, once.');
  test.setTimeout(240_000);
  const token = shared().token;
  const home = mkdtempSync(join(tmpdir(), 'hub-pack-'));
  const config = join(home, 'cc');
  mkdirSync(config);
  const folder = mkdtempSync(join(tmpdir(), 'hub-folder-'));
  const before = { ...process.env };
  process.env['CLAUDE_CONFIG_DIR'] = config;
  process.env['HUB_MCP_BEARER'] = token;
  process.env['USERPROFILE'] = home;
  process.env['HOME'] = home;
  try {
    const pack = (await import(pathToFileURL(LIB).href)) as Pack;
    const real = pack.realSystem();
    await pack.init(
      {
        ...real,
        home,
        out: () => undefined,
        run: (command, args) =>
          command === 'setx' || command === 'reg'
            ? { status: 0, stdout: '', stderr: '' }
            : real.run(command, args),
      },
      { url: API_URL, token },
    );

    const env = { ...process.env };
    const doctor = execFileSync(process.execPath, [BIN, 'doctor'], { env, encoding: 'utf8' });
    expect(doctor).not.toContain(token);

    execFileSync(process.execPath, [BIN, 'link', ws], { env, cwd: folder, encoding: 'utf8' });
    const linked = readFileSync(join(folder, '.mcp.json'), 'utf8');
    expect(linked).toContain(ws);
    expect(linked).not.toContain(token);
    expect(readFileSync(join(config, '.claude.json'), 'utf8')).not.toContain(token);
  } finally {
    process.env = before;
    rmSync(home, { recursive: true, force: true });
    rmSync(folder, { recursive: true, force: true });
  }
});

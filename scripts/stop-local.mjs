/**
 * @file `pnpm stop:local`: stops the API and web of a `pnpm start:local` whose terminal is gone. Only those processes, and never the containers.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pidFile = join(dirname(fileURLToPath(import.meta.url)), '../.tmp/local-pids.json');

if (!existsSync(pidFile)) {
  process.stdout.write('Hub is not running from pnpm start:local.\n');
  process.exit(0);
}
for (const pid of JSON.parse(readFileSync(pidFile, 'utf8'))) {
  if (process.platform === 'win32')
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(pid);
    } catch {
      /* Already gone. */
    }
  }
}
rmSync(pidFile, { force: true });
process.stdout.write('Hub stopped. The containers stay up: pnpm compose:down stops them.\n');

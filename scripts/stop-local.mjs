/**
 * @file `pnpm stop:local`: stops the API, web and lab of a `pnpm start:local` whose terminal is gone, and HubServer, the logon task's copy, when
 * that is what runs Hub. Only those processes, and never the containers.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runningHubServer, stopTree } from './lib/hub-local.mjs';

const pidFile = join(dirname(fileURLToPath(import.meta.url)), '../.tmp/local-pids.json');
const say = (text) => process.stdout.write(`${text}\n`);

const server = runningHubServer();
if (server) {
  stopTree(server.pid);
  for (const pid of server.children ?? []) stopTree(pid);
  say(
    'HubServer stopped. The task starts it again at your next logon; `pnpm hub:service uninstall` removes it.',
  );
}

if (!existsSync(pidFile)) {
  if (!server) say('Hub is not running from pnpm start:local.');
  process.exit(0);
}
for (const pid of JSON.parse(readFileSync(pidFile, 'utf8'))) stopTree(pid);
rmSync(pidFile, { force: true });
say('Hub stopped. The containers stay up: pnpm compose:down stops them.');

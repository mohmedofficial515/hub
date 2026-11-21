/**
 * @file `pnpm hub:restore <backup folder | hub.dump>` (docs/16 D61 to D63): puts a backup back into Hub's database. The owner runs it; Hub has no
 * restore button.
 * @description It refuses while Hub is running (the API answers, or HubServer is alive), because a running API would write over what comes
 * back; `--force` skips that check. It asks you to type the database's name unless `--yes`. It runs `pg_restore --clean --if-exists
 * --single-transaction` inside the Postgres container that publishes DATABASE_URL's port, so either everything comes back or nothing changes.
 * A `goteav-*` container is refused whatever is asked. The documents copied beside the dump are not written back by themselves: their folder
 * is printed, to copy what you need. `--database-url`, `--api-url` and `--container` point it elsewhere: the tests use them on a throwaway database.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

import { readEnvFile, root, runningHubServer } from './lib/hub-local.mjs';

const say = (text) => process.stdout.write(`${text}\n`);

function options(argv) {
  const found = { force: false, yes: false, target: null, databaseUrl: null, apiUrl: null, container: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--force') found.force = true;
    else if (arg === '--yes') found.yes = true;
    else if (arg === '--database-url') found.databaseUrl = argv[++index];
    else if (arg === '--api-url') found.apiUrl = argv[++index];
    else if (arg === '--container') found.container = argv[++index];
    else if (!found.target) found.target = arg;
  }
  return found;
}

function dumpFileOf(target) {
  const full = resolve(target);
  if (!existsSync(full)) return null;
  if (statSync(full).isDirectory()) {
    const file = join(full, 'hub.dump');
    return existsSync(file) ? { file, folder: full } : null;
  }
  return { file: full, folder: null };
}

async function apiAnswers(apiUrl) {
  try {
    const response = await fetch(`${apiUrl}/api/v1/health/live`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

function containerFor(port, chosen) {
  const name =
    chosen ||
    (
      spawnSync('docker', ['ps', '--filter', `publish=${port}`, '--format', '{{.Names}}'], {
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
      }).stdout ?? ''
    )
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
  if (!name) return { error: `No running Postgres container publishes port ${port}. Is Docker running?` };
  if (/^goteav[-_]/i.test(name))
    return { error: `Refused container ${name}: it belongs to another project.` };
  return { name };
}

function restore(container, target, file) {
  return new Promise((done) => {
    const child = spawn(
      'docker',
      [
        'exec',
        '-i',
        container,
        'pg_restore',
        '-U',
        target.user,
        '-d',
        target.database,
        '--clean',
        '--if-exists',
        '--no-owner',
        '--single-transaction',
        '--exit-on-error',
      ],
      { shell: false, windowsHide: true, stdio: ['pipe', 'inherit', 'pipe'] },
    );
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', () => done({ status: 127, stderr: 'docker was not found' }));
    child.on('close', (code) => done({ status: code ?? 1, stderr }));
    createReadStream(file).pipe(child.stdin);
  });
}

async function main() {
  const opts = options(process.argv.slice(2));
  if (!opts.target) {
    say('Usage: pnpm hub:restore <backup folder | hub.dump> [--yes] [--force]');
    say(
      'Stop Hub first (pnpm stop:local, or pnpm hub:service stop). The backups are listed in Settings › Backups.',
    );
    return 1;
  }
  const dump = dumpFileOf(opts.target);
  if (!dump) {
    say(
      `No backup at ${resolve(opts.target)}: give a backup folder (with hub.dump inside) or the hub.dump file itself.`,
    );
    return 1;
  }
  const env = readEnvFile(join(root, '.env'));
  const databaseUrl = opts.databaseUrl ?? env.DATABASE_URL;
  if (!databaseUrl) {
    say('No DATABASE_URL: the root .env is missing.');
    return 1;
  }
  const url = new URL(databaseUrl);
  const target = {
    user: decodeURIComponent(url.username || 'postgres'),
    database: decodeURIComponent(url.pathname.replace(/^\//, '') || 'postgres'),
    port: Number(url.port || 5432),
  };
  const apiUrl = opts.apiUrl ?? `http://localhost:${env.PORT || 7310}`;
  if (!opts.force && ((await apiAnswers(apiUrl)) || (!opts.apiUrl && runningHubServer()))) {
    say(`Hub is running (${apiUrl} answers). Stop it first: pnpm stop:local, or pnpm hub:service stop.`);
    say('A running Hub would write over what the restore brings back. --force restores anyway.');
    return 1;
  }
  const container = containerFor(target.port, opts.container ?? env.HUB_BACKUP_PG_CONTAINER);
  if (container.error) {
    say(container.error);
    return 1;
  }
  say(
    `This replaces everything in database "${target.database}" (container ${container.name}) with ${dump.file}.`,
  );
  if (!opts.yes) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await prompt.question(`Type the database name (${target.database}) to go on: `);
    prompt.close();
    if (answer.trim() !== target.database) {
      say('Nothing was changed.');
      return 1;
    }
  }
  const result = await restore(container.name, target, dump.file);
  if (result.status !== 0) {
    say(
      `The restore failed, and in one transaction, so the database is as it was:\n${result.stderr.trim().slice(-800)}`,
    );
    return 1;
  }
  say('Restored.');
  if (dump.folder && existsSync(join(dump.folder, 'docs'))) {
    say(
      `The documents Hub had written are copied in ${join(dump.folder, 'docs')}. They are not put back by themselves: copy what you need.`,
    );
  }
  say('Start Hub again: pnpm start:local, or pnpm hub:service start.');
  return 0;
}

process.exitCode = await main();

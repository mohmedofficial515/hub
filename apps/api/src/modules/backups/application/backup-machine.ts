/**
 * @file What a backup needs from the machine, as one injectable, so tests can run a backup with no Docker and fake a full drive.
 * @description The dump runs `pg_dump` inside the Postgres container that serves DATABASE_URL, found by its published port, so the
 * dump's version is the server's and the machine needs no Postgres tools. A `goteav-*` container is refused whatever is asked: those
 * belong to another project. No shell is used, the password never appears on a command line, and the output streams to the file.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';

const DUMP_TIMEOUT_MS = 30 * 60_000;
const DOCKER_TIMEOUT_MS = 15_000;

export interface DiskSpace {
  readonly freeBytes: number;
  readonly totalBytes: number;
}

export interface DatabaseTarget {
  readonly user: string;
  readonly database: string;
  readonly port: number;
}

/** User, database and port of a `postgres://` URL. */
export function databaseTarget(url: string): DatabaseTarget {
  const parsed = new URL(url);
  return {
    user: decodeURIComponent(parsed.username || 'postgres'),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '') || 'postgres'),
    port: Number(parsed.port || 5432),
  };
}

/** Another project's container is never touched, by name, whatever the settings say. */
export function isForeignContainer(name: string): boolean {
  return /^goteav[-_]/i.test(name.trim());
}

function run(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise((done) => {
    const child = spawn(command, args, { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.on('error', () => {
      clearTimeout(timer);
      done({ status: 127, stdout, stderr: `${command} was not found` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ status: code ?? 1, stdout, stderr });
    });
  });
}

/** The last useful line of a tool's error output, short, with any URL removed in case it held a password. */
export function plainFailure(stderr: string): string {
  const line =
    stderr
      .split(/\r?\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .at(-1) ?? 'no message';
  return line.replace(/\w+:\/\/\S+/g, '<url>').slice(0, 300);
}

@Injectable()
export class BackupMachine {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** The container `pg_dump` runs in: the setting, else the one publishing the database's port. */
  async container(): Promise<string> {
    const chosen = this.config.HUB_BACKUP_PG_CONTAINER?.trim();
    const name =
      chosen ||
      (
        await run(
          'docker',
          [
            'ps',
            '--filter',
            `publish=${databaseTarget(this.config.DATABASE_URL).port}`,
            '--format',
            '{{.Names}}',
          ],
          DOCKER_TIMEOUT_MS,
        )
      ).stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
    if (!name)
      throw new Error('No running Postgres container publishes the database port. Is Docker running?');
    if (isForeignContainer(name)) throw new Error(`Refused container ${name}: it belongs to another project`);
    return name;
  }

  /** `pg_dump --format=custom` of Hub's database into `file`. */
  async dump(file: string): Promise<void> {
    const container = await this.container();
    const target = databaseTarget(this.config.DATABASE_URL);
    await new Promise<void>((done, fail) => {
      const out = createWriteStream(file);
      const child = spawn(
        'docker',
        [
          'exec',
          container,
          'pg_dump',
          '-U',
          target.user,
          '-d',
          target.database,
          '--format=custom',
          '--no-owner',
        ],
        { shell: false, windowsHide: true },
      );
      let stderr = '';
      const timer = setTimeout(() => child.kill(), DUMP_TIMEOUT_MS);
      child.stdout.pipe(out);
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
      child.on('error', () => {
        clearTimeout(timer);
        fail(new Error('docker was not found'));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        out.end(() => (code === 0 ? done() : fail(new Error(`pg_dump failed: ${plainFailure(stderr)}`))));
      });
    });
  }

  /** Free and total bytes of the drive holding `folder`, or of its nearest existing parent. Null when unreadable. */
  async disk(folder: string): Promise<DiskSpace | null> {
    let current = resolve(folder);
    while (!existsSync(current)) {
      const parent = dirname(current);
      if (parent === current) return null;
      current = parent;
    }
    try {
      const stats = await statfs(current);
      return { freeBytes: stats.bavail * stats.bsize, totalBytes: stats.blocks * stats.bsize };
    } catch {
      return null;
    }
  }
}

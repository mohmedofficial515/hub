/**
 * @file Connection details shared from `global-setup` to the test contexts through a temp file.
 * @description Pattern from F:/Goteav/backend/test/setup/e2e-state.ts. The file is per run, because several
 * e2e runs may share a machine: one run's teardown must not take away another's containers.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface E2eState {
  readonly databaseUrl: string;
  readonly redisUrl: string;
}

const DIR = join(tmpdir(), 'hub-e2e');
const RUN = 'HUB_E2E_RUN';

function file(): string {
  return join(DIR, `state-${process.env[RUN]}.json`);
}

export function writeE2eState(state: E2eState): void {
  process.env[RUN] = randomUUID(); // The jest workers inherit it.
  mkdirSync(DIR, { recursive: true });
  writeFileSync(file(), JSON.stringify(state));
}

export function readE2eState(): E2eState {
  return JSON.parse(readFileSync(file(), 'utf8')) as E2eState;
}

export function removeE2eState(): void {
  rmSync(file(), { force: true });
}

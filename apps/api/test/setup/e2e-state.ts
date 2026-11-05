/**
 * @file Connection details shared from `global-setup` to the test contexts through a temp file.
 * @description Pattern from F:/Goteav/backend/test/setup/e2e-state.ts.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface E2eState {
  readonly databaseUrl: string;
  readonly redisUrl: string;
}

const DIR = join(tmpdir(), 'hub-e2e');
const FILE = join(DIR, 'state.json');

export function writeE2eState(state: E2eState): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(state));
}

export function readE2eState(): E2eState {
  return JSON.parse(readFileSync(FILE, 'utf8')) as E2eState;
}

export function removeE2eState(): void {
  rmSync(FILE, { force: true });
}

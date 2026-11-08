/**
 * @file What global setup leaves for the tests, in files, because tests run in another process.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// `E2E_RESULTS` keeps two runs at once, on their own ports, from overwriting each other's sessions.
const DIR = resolve(process.env['E2E_RESULTS'] ?? resolve(__dirname, '../../test-results'), 'e2e-state');
export const SHARED_FILE = join(DIR, 'shared.json');
/** Every bridge a test started, so the run's teardown can stop one a dead worker left behind. */
export const BRIDGE_PIDS_FILE = join(DIR, 'scripted-bridges.txt');
/** How a test restarts the API on the same database (`api-restart.ts`): its command, folder and throwaway variables. */
export const API_FILE = join(DIR, 'api.json');
/** Every API a test started, so the run's teardown stops them. */
export const API_PIDS_FILE = join(DIR, 'api-pids.txt');
export const storageFile = (who: string) => join(DIR, `${who}.storage.json`);

export interface Person {
  id: string;
  email: string;
  name: string;
  /** Their MCP token: what their Claude Code would present. */
  token: string;
}

export interface Shared {
  /** The owner's MCP token: what Claude Code would present. */
  token: string;
  labRoot: string;
  /** For a script that runs on this stack (`connect.spec.ts`). */
  apiEnv: Record<string, string>;
  owner: Person;
  people: Record<string, Person>;
}

export const shared = () => JSON.parse(readFileSync(SHARED_FILE, 'utf8')) as Shared;

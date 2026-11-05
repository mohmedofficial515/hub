/**
 * @file What global setup leaves for the tests, in files, because tests run in another process.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = resolve(__dirname, '../../test-results/e2e-state');
export const SHARED_FILE = join(DIR, 'shared.json');
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
  owner: Person;
  people: Record<string, Person>;
}

export const shared = () => JSON.parse(readFileSync(SHARED_FILE, 'utf8')) as Shared;

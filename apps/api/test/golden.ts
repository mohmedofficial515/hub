/**
 * @file Golden files for rendered text. `UPDATE_GOLDEN=1` writes them; review the diff before committing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(__dirname, 'golden');

export function expectGolden(name: string, actual: string): void {
  const path = join(ROOT, name);
  if (process.env['UPDATE_GOLDEN'] === '1') {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, actual);
  }
  if (!existsSync(path)) throw new Error(`No golden file at ${path}. Run with UPDATE_GOLDEN=1.`);
  expect(actual).toBe(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'));
}

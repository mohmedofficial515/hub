/**
 * @file `schema.read` (docs/17 §2): read only, `.prisma` files only, inside an allowlisted folder.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { dispatch } from '../lib/actions.mjs';
import { aFolder, fakeSystem, URL } from './helpers.mjs';

const noEmit = () => {};
const contextFor = (system, folders) => ({ system, url: URL, folders: () => folders });

function repo(system) {
  const folder = aFolder(system, 'backend');
  mkdirSync(join(folder, 'prisma', 'schema'), { recursive: true });
  writeFileSync(join(folder, 'prisma', 'schema', 'a.prisma'), 'model A {\n  id Int @id\n}\n');
  writeFileSync(join(folder, 'prisma', 'schema', 'b.prisma'), 'enum B {\n  X\n}\n');
  writeFileSync(join(folder, 'prisma', 'schema', 'notes.md'), 'not a schema');
  writeFileSync(join(folder, '.env'), 'SECRET=1');
  return folder;
}

describe('schema.read', () => {
  it('reads the .prisma files of the folder, and nothing else', async () => {
    const system = fakeSystem();
    const folder = repo(system);
    const answer = await dispatch(
      { action: 'schema.read', args: { folder, schemaDir: 'prisma/schema' } },
      contextFor(system, [{ path: folder, project: 'demo' }]),
      noEmit,
    );
    expect(answer.ok).toBe(true);
    expect(answer.data.files.map((file) => file.path)).toEqual([
      'prisma/schema/a.prisma',
      'prisma/schema/b.prisma',
    ]);
    expect(answer.data.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses a folder outside the allowlist', async () => {
    const system = fakeSystem();
    const folder = repo(system);
    const other = aFolder(system, 'other');
    const answer = await dispatch(
      { action: 'schema.read', args: { folder, schemaDir: 'prisma/schema' } },
      contextFor(system, [{ path: other, project: 'demo' }]),
      noEmit,
    );
    expect(answer).toMatchObject({ ok: false, error: { code: 'folder_not_allowed' } });
  });

  it('refuses a schema folder that climbs out, an absolute one, or a file that is not .prisma', async () => {
    const system = fakeSystem();
    const folder = repo(system);
    const context = contextFor(system, [{ path: folder, project: 'demo' }]);
    for (const [schemaDir, code] of [
      ['../other', 'folder_not_allowed'],
      [folder, 'bad_arguments'],
      ['.env', 'bad_arguments'],
      ['prisma/schema/notes.md', 'bad_arguments'],
      ['missing', 'folder_missing'],
    ]) {
      const answer = await dispatch({ action: 'schema.read', args: { folder, schemaDir } }, context, noEmit);
      expect(answer).toMatchObject({ ok: false, error: { code } });
    }
  });
});

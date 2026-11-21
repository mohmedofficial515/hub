/**
 * @file `file.read`: a picture, clip or captions file on this device, for a plan's evidence or explainer, read in pieces under the folder rule.
 */
import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { dispatch } from '../lib/actions.mjs';
import { FILE_PIECE_BYTES } from '../lib/media-files.mjs';
import { aFolder, fakeSystem, URL } from './helpers.mjs';

const noEmit = () => {};
const read = (system, folders, args) =>
  dispatch({ action: 'file.read', args }, { system, url: URL, folders: () => folders }, noEmit);

describe('file.read', () => {
  it('reads a file in a registered folder in pieces, and the pieces make the file', async () => {
    const system = fakeSystem();
    const folder = aFolder(system);
    const bytes = Buffer.alloc(FILE_PIECE_BYTES + 1000, 7);
    bytes[0] = 1;
    bytes[bytes.length - 1] = 9;
    writeFileSync(join(folder, 'after.png'), bytes);
    const folders = [{ path: folder, project: 'demo' }];
    const first = await read(system, folders, { path: join(folder, 'after.png') });
    expect(first).toMatchObject({ ok: true, data: { size: bytes.length, offset: 0 } });
    const second = await read(system, folders, { path: join(folder, 'after.png'), offset: FILE_PIECE_BYTES });
    const whole = Buffer.concat([
      Buffer.from(first.data.data, 'base64'),
      Buffer.from(second.data.data, 'base64'),
    ]);
    expect(whole.equals(bytes)).toBe(true);
  });

  it('refuses a folder not registered, a relative path, another kind of file, a missing one and one over the cap', async () => {
    const system = fakeSystem();
    // The real path, as the owner registers it: a missing file cannot be resolved to compare with a short name.
    const folder = realpathSync.native(aFolder(system));
    const outside = aFolder(system, 'elsewhere');
    writeFileSync(join(folder, 'a.png'), 'x');
    writeFileSync(join(folder, '.env'), 'SECRET=1');
    writeFileSync(join(outside, 'b.png'), 'x');
    const folders = [{ path: folder, project: 'demo' }];
    const code = async (args) => (await read(system, folders, args)).error?.code;
    expect(await code({ path: join(outside, 'b.png') })).toBe('folder_not_allowed');
    expect(await code({ path: 'a.png' })).toBe('bad_arguments');
    expect(await code({ path: join(folder, '.env') })).toBe('file_type');
    expect(await code({ path: join(folder, 'gone.png') })).toBe('file_missing');
    expect(await code({ path: join(folder, 'a.png'), maxBytes: 0 })).toBe('bad_arguments');
    writeFileSync(join(folder, 'big.mp4'), Buffer.alloc(2000));
    expect(await code({ path: join(folder, 'big.mp4'), maxBytes: 1000 })).toBe('file_too_large');
  });

  it('a link inside the folder cannot lead out of it, nor dress another file as a picture', async () => {
    const system = fakeSystem();
    const folder = aFolder(system);
    const outside = aFolder(system, 'elsewhere');
    writeFileSync(join(outside, 'secret.png'), 'x');
    writeFileSync(join(folder, 'notes.txt'), 'x');
    mkdirSync(join(folder, 'shots'), { recursive: true });
    const folders = [{ path: folder, project: 'demo' }];
    try {
      symlinkSync(join(outside, 'secret.png'), join(folder, 'shots', 'out.png'));
      symlinkSync(join(folder, 'notes.txt'), join(folder, 'shots', 'notes.png'));
    } catch {
      // Windows without the right to make links: nothing to test here.
      return;
    }
    expect((await read(system, folders, { path: join(folder, 'shots', 'out.png') })).error?.code).toBe(
      'folder_not_allowed',
    );
    expect((await read(system, folders, { path: join(folder, 'shots', 'notes.png') })).error?.code).toBe(
      'file_type',
    );
  });
});

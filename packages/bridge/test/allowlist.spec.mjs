/**
 * @file The folder rule: nothing outside a registered folder, however it is written.
 */
import { mkdirSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { allowedEntry } from '../lib/allowlist.mjs';

const platform = process.platform;

function layout() {
  const root = mkdtempSync(join(tmpdir(), 'hub-allow-'));
  const inside = join(root, 'repo');
  const outside = join(root, 'other');
  mkdirSync(join(inside, 'src'), { recursive: true });
  mkdirSync(outside);
  return { root, inside, outside, entries: [{ path: inside, project: 'demo' }] };
}

describe('allowedEntry', () => {
  it('allows a registered folder and what is under it', () => {
    const { inside, entries } = layout();
    expect(allowedEntry(inside, entries, platform)?.project).toBe('demo');
    expect(allowedEntry(join(inside, 'src'), entries, platform)?.project).toBe('demo');
  });

  it('refuses a folder outside, and a name that only starts the same', () => {
    const { outside, inside, entries } = layout();
    expect(allowedEntry(outside, entries, platform)).toBeNull();
    expect(allowedEntry(`${inside}-copy`, entries, platform)).toBeNull();
  });

  it('refuses .. even when it would land inside, a relative path and anything that is not a string', () => {
    const { inside, entries } = layout();
    expect(allowedEntry(join(inside, 'src') + '/../src', entries, platform)).toBeNull();
    expect(allowedEntry('repo', entries, platform)).toBeNull();
    expect(allowedEntry(undefined, entries, platform)).toBeNull();
    expect(allowedEntry(['x'], entries, platform)).toBeNull();
  });

  it('refuses a link inside the project that leads out of it', () => {
    const { inside, outside, entries } = layout();
    const link = join(inside, 'escape');
    try {
      symlinkSync(outside, link, 'junction');
    } catch {
      return; // This machine does not allow links here.
    }
    expect(allowedEntry(link, entries, platform)).toBeNull();
  });

  it('ignores case and slash direction on Windows only', () => {
    const entries = [{ path: 'F:\\Goteav\\Hub', project: 'hub' }];
    expect(allowedEntry('f:/goteav/hub/src', entries, 'win32')?.project).toBe(
      process.platform === 'win32' ? 'hub' : undefined,
    );
  });

  it('checks the project when one is named', () => {
    const { inside, entries } = layout();
    expect(allowedEntry(inside, entries, platform, 'demo')).not.toBeNull();
    expect(allowedEntry(inside, entries, platform, 'someone-else')).toBeNull();
  });

  it('an empty list allows nothing', () => {
    const { inside } = layout();
    expect(allowedEntry(inside, [], platform)).toBeNull();
  });
});

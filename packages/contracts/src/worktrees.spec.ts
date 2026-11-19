/**
 * @file Hub's worktree rules, here and in the bridge, which is plain Node and restates them (`packages/bridge/lib/worktrees.mjs`): both answer the same for every case.
 */
import { describe, expect, it } from 'vitest';

// @ts-expect-error The bridge is plain JavaScript with no types.
import * as untyped from '../../bridge/lib/worktrees.mjs';
import {
  QUEUE_DEFAULTS,
  WORKTREE_KEY_PATTERN,
  worktreeBaseOf,
  worktreeBranchOf,
  worktreeFolderFor,
  worktreeKeyOf,
} from './index';

/** What this spec reads from the bridge's module. */
interface BridgeWorktrees {
  readonly WORKTREE_KEY_PATTERN: RegExp;
  worktreeFolderFor(folder: string, key: string): string | null;
  worktreeBranchOf(key: string): string;
  isWorktreeOf(inner: string, outer: string, platform: string): boolean;
}
const bridge = untyped as unknown as BridgeWorktrees;

const FOLDERS = ['F:\\Goteav\\backend', 'F:/Goteav/backend/', '/home/me/web', '/web', 'C:\\x'];
const KEYS = ['GTV-37', 'gtv-37', 'run-0a1b2c3d', 'payments', 'GTV-', 'run-xyz', 'ABCDEFG-1'];

describe('the worktree rules', () => {
  it('name the same copy here and in the bridge', () => {
    for (const folder of FOLDERS) {
      for (const key of KEYS) {
        expect([folder, key, worktreeFolderFor(folder, key)]).toEqual([
          folder,
          key,
          bridge.worktreeFolderFor(folder, key),
        ]);
      }
    }
    expect(WORKTREE_KEY_PATTERN.source).toBe(bridge.WORKTREE_KEY_PATTERN.source);
    expect(worktreeBranchOf('GTV-37')).toBe(bridge.worktreeBranchOf('GTV-37'));
  });

  it("take a card's key, else the run's own, and make a branch of Hub's", () => {
    expect(worktreeKeyOf({ cardKey: 'gtv-37', id: 'x' })).toBe('GTV-37');
    expect(worktreeKeyOf({ cardKey: null, id: '019a7c2e-1234-7abc-8def-0123456789ab' })).toBe('run-456789ab');
    expect(worktreeBranchOf('GTV-37')).toBe('hub/gtv-37');
    expect(worktreeFolderFor('F:\\Goteav\\backend', 'GTV-37')).toBe('F:\\Goteav\\wt-GTV-37\\backend');
  });

  it("know a copy of a registered repository, and nothing beside it, as the bridge's allowlist does", () => {
    const repos = ['F:\\Goteav\\backend', 'F:\\Goteav\\web'];
    const cases: [string, string | null][] = [
      ['F:\\Goteav\\wt-GTV-37\\backend', 'F:\\Goteav\\backend'],
      ['f:/goteav/wt-gtv-37/web/src', 'F:\\Goteav\\web'],
      ['F:\\Goteav\\wt-payments\\web', null],
      ['F:\\Goteav\\wt-GTV-37\\other', null],
      ['F:\\Goteav\\wt-GTV-37\\..\\backend', null],
      ['F:\\Goteav\\backend', null],
    ];
    for (const [folder, base] of cases) {
      expect([folder, worktreeBaseOf(folder, repos, 'win32')]).toEqual([folder, base]);
      const canonical = (path: string) => path.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
      const viaBridge =
        repos.find((repo) => bridge.isWorktreeOf(canonical(folder), canonical(repo), 'win32')) ?? null;
      expect([folder, folder.includes('..') ? null : viaBridge]).toEqual([folder, base]);
    }
  });

  it('isolate a run in its own copy unless the owner says otherwise', () => {
    expect(QUEUE_DEFAULTS.isolation).toBe('worktree');
  });
});

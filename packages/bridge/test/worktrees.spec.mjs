/**
 * @file Hub's own worktrees against a real Git repository in a temp folder (docs/16 §9.2): the naming rule, the allowlist, making a copy, linking packages,
 * and removing a copy without ever reaching the repository's own `node_modules`.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { dispatch } from '../lib/actions.mjs';
import { allowedEntry } from '../lib/allowlist.mjs';
import { isOwnBranchCommit } from '../lib/permissions.mjs';
import { realSystem } from '../lib/system.mjs';
import {
  findPackageFolders,
  folderStatus,
  isHubWorktree,
  prepareWorktree,
  removeWorktree,
  worktreeFolderFor,
} from '../lib/worktrees.mjs';

const system = realSystem();

// Each test here runs 10 to 25 real Git processes against a temp repository (1.1 to 1.8 s on an idle Windows machine). Under
// `pnpm test`, with the other packages' suites running beside it, that went past Vitest's 5 s default, so this file gets 20 s.
vi.setConfig({ testTimeout: 20_000 });

/** A repository at `<temp>/backend` with one commit, an ignored `node_modules` beside its `package.json`, and a nested app with its own. */
function aRepository() {
  const parent = realpathSync.native(mkdtempSync(join(tmpdir(), 'hub-wt-')));
  const repo = join(parent, 'backend');
  mkdirSync(join(repo, 'node_modules', 'left-pad'), { recursive: true });
  writeFileSync(join(repo, 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1;\n');
  mkdirSync(join(repo, 'apps', 'web', 'node_modules'), { recursive: true });
  writeFileSync(join(repo, 'apps', 'web', 'node_modules', 'marker.txt'), 'real\n');
  writeFileSync(join(repo, 'apps', 'web', 'package.json'), '{"name":"web"}\n');
  writeFileSync(join(repo, 'package.json'), '{"name":"backend"}\n');
  writeFileSync(join(repo, '.gitignore'), 'node_modules\n');
  writeFileSync(join(repo, 'a.txt'), 'one\n');
  const git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  git('init', '-q', '-b', 'feat/first');
  git('config', 'user.email', 'a@b.c');
  git('config', 'user.name', 'a');
  git('add', '.');
  git('commit', '-qm', 'first');
  return { parent, repo, git };
}

describe('the naming rule', () => {
  it('puts the copy beside the repository, with its own separators', () => {
    expect(worktreeFolderFor('F:\\Goteav\\backend', 'GTV-37')).toBe('F:\\Goteav\\wt-GTV-37\\backend');
    expect(worktreeFolderFor('/home/me/backend/', 'run-0a1b2c3d')).toBe('/home/me/wt-run-0a1b2c3d/backend');
    expect(worktreeFolderFor('F:\\Goteav\\backend', 'payments')).toBeNull();
    expect(worktreeFolderFor('/backend', 'GTV-1')).toBeNull();
  });
});

describe('the allowlist', () => {
  const entries = [{ path: 'F:\\Goteav\\backend', project: 'goteav' }];

  it("lets the bridge into Hub's copy of a registered repository, and inside it", () => {
    expect(allowedEntry('F:\\Goteav\\wt-GTV-37\\backend', entries, 'win32')).toEqual(entries[0]);
    expect(allowedEntry('f:/goteav/wt-gtv-37/backend/src', entries, 'win32', 'goteav')).toEqual(entries[0]);
  });

  it("keeps the owner's own folders beside it outside, and every other name", () => {
    expect(allowedEntry('F:\\Goteav\\wt-payments\\backend', entries, 'win32')).toBeNull();
    expect(allowedEntry('F:\\Goteav\\wt-GTV-37\\web', entries, 'win32')).toBeNull();
    expect(allowedEntry('F:\\Goteav\\wt-GTV-37\\backend', entries, 'win32', 'other')).toBeNull();
    expect(allowedEntry('F:\\Goteav\\wt-GTV-37\\..\\backend', entries, 'win32')).toBeNull();
  });
});

describe('folder.status', () => {
  it('counts changed and untracked files, and says when there is no repository', async () => {
    const { parent, repo } = aRepository();
    expect(await folderStatus(system, repo)).toEqual({ repository: true, changed: 0, branch: 'feat/first' });
    writeFileSync(join(repo, 'a.txt'), 'two\n');
    writeFileSync(join(repo, 'new.txt'), 'new\n');
    expect(await folderStatus(system, repo)).toMatchObject({ changed: 2 });
    expect(await folderStatus(system, parent)).toEqual({ repository: false, changed: 0, branch: null });
  });
});

describe('worktree.prepare', () => {
  it('makes the copy on its own branch from the current commit, and links the ignored packages', async () => {
    const { repo, git } = aRepository();
    const head = git('rev-parse', 'HEAD').stdout.trim();
    const made = await prepareWorktree(system, repo, 'GTV-37');
    const copy = worktreeFolderFor(repo, 'GTV-37');
    expect(made).toEqual({
      folder: copy,
      branch: 'hub/gtv-37',
      base: head,
      baseBranch: 'feat/first',
      reused: false,
      linked: 2,
    });
    expect(isHubWorktree(copy)).toBe(true);
    expect(lstatSync(join(copy, 'node_modules')).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(copy, 'node_modules', 'left-pad', 'index.js'), 'utf8')).toContain(
      'module.exports',
    );
    expect(readFileSync(join(copy, 'apps', 'web', 'node_modules', 'marker.txt'), 'utf8')).toBe('real\n');
    // The links are ignored, so the copy starts clean and a commit can never take them.
    expect(await folderStatus(system, copy)).toMatchObject({ changed: 0, branch: 'hub/gtv-37' });
  });

  it("finds a copy again for a plan's next step, and keeps its work", async () => {
    const { repo } = aRepository();
    const first = await prepareWorktree(system, repo, 'GTV-50');
    writeFileSync(join(first.folder, 'step1.txt'), 'done\n');
    const again = await prepareWorktree(system, repo, 'GTV-50');
    expect(again).toMatchObject({ folder: first.folder, branch: 'hub/gtv-50', reused: true });
    expect(existsSync(join(again.folder, 'step1.txt'))).toBe(true);
  });

  it('copies only a repository, and only from its top folder', async () => {
    const { parent, repo } = aRepository();
    await expect(prepareWorktree(system, parent, 'GTV-1')).rejects.toMatchObject({
      code: 'not_a_repository',
    });
    await expect(prepareWorktree(system, join(repo, 'apps'), 'GTV-1')).rejects.toMatchObject({
      code: 'not_a_repository',
    });
    await expect(prepareWorktree(system, repo, 'payments')).rejects.toMatchObject({ code: 'bad_arguments' });
  });

  it("never copies one of Hub's copies, which would nest them", async () => {
    const { parent, repo } = aRepository();
    const made = await prepareWorktree(system, repo, 'GTV-2');
    const context = { system, url: 'http://hub.test', folders: () => [{ path: repo, project: 'demo' }] };
    const answer = await dispatch(
      { action: 'worktree.prepare', args: { folder: made.folder, key: 'GTV-3' } },
      context,
      () => {},
    );
    expect(answer).toMatchObject({ ok: false, error: { code: 'bad_arguments' } });
    expect(existsSync(join(parent, 'wt-GTV-2', 'wt-GTV-3'))).toBe(false);
  });
});

describe('worktree.remove', () => {
  it('refuses a copy with changes not committed, so they are never lost', async () => {
    const { repo } = aRepository();
    const made = await prepareWorktree(system, repo, 'GTV-8');
    writeFileSync(join(made.folder, 'wip.txt'), 'not yet\n');
    await expect(removeWorktree(system, made.folder)).rejects.toMatchObject({ code: 'worktree_dirty' });
    expect(existsSync(join(made.folder, 'wip.txt'))).toBe(true);
  });

  it("unlinks the packages first, so the repository's own node_modules is untouched, and keeps the branch", async () => {
    const { parent, repo, git } = aRepository();
    const made = await prepareWorktree(system, repo, 'GTV-9');
    writeFileSync(join(made.folder, 'b.txt'), 'b\n');
    spawnSync('git', ['add', 'b.txt'], { cwd: made.folder });
    spawnSync('git', ['commit', '-qm', 'b'], { cwd: made.folder });
    expect(await removeWorktree(system, made.folder)).toEqual({ branch: 'hub/gtv-9' });
    expect(existsSync(made.folder)).toBe(false);
    expect(existsSync(join(parent, 'wt-GTV-9'))).toBe(false);
    expect(readFileSync(join(repo, 'node_modules', 'left-pad', 'index.js'), 'utf8')).toContain(
      'module.exports',
    );
    expect(readFileSync(join(repo, 'apps', 'web', 'node_modules', 'marker.txt'), 'utf8')).toBe('real\n');
    expect(git('rev-parse', '--verify', 'hub/gtv-9').status).toBe(0);
    expect(git('worktree', 'list').stdout).not.toContain('wt-GTV-9');
  });

  it('removes nothing that is not one of its copies', async () => {
    const { repo } = aRepository();
    await expect(removeWorktree(system, repo)).rejects.toMatchObject({ code: 'bad_arguments' });
    expect(existsSync(join(repo, 'a.txt'))).toBe(true);
  });
});

describe('the package folders', () => {
  it('finds node_modules beside a package.json, not inside node_modules', () => {
    const { repo } = aRepository();
    mkdirSync(join(repo, 'node_modules', 'left-pad', 'node_modules'), { recursive: true });
    writeFileSync(join(repo, 'node_modules', 'left-pad', 'package.json'), '{}');
    expect(
      findPackageFolders(repo)
        .map((rel) => rel.replaceAll('\\', '/'))
        .sort(),
    ).toEqual(['apps/web/node_modules', 'node_modules']);
  });
});

describe('a commit in its own branch', () => {
  it.each([
    'git commit -m "step 1"',
    'git add -A && git commit -m "step 1"',
    "git add src/a.ts src/b.ts && git commit -m 'fix: it'",
  ])('is only a commit: %s', (command) => {
    expect(isOwnBranchCommit('Bash', { command })).toBe(true);
  });

  it.each([
    'git push',
    'git commit -m x && git push',
    'git commit -m x; rm -rf /',
    'git commit -m "$(rm -rf ~)"',
    'git -C ../other commit -m x',
    'git commit --git-dir=../other/.git -m x',
    'cd ../other && git commit -m x',
    'git merge main',
    'git commit -m x | tee log',
    'git rebase -i HEAD~2',
  ])('anything more is not: %s', (command) => {
    expect(isOwnBranchCommit('Bash', { command })).toBe(false);
  });

  it('is a shell call only', () => {
    expect(isOwnBranchCommit('Write', { command: 'git commit -m x' })).toBe(false);
  });
});

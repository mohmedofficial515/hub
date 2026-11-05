/**
 * @file Session text and matching rules.
 */
import { hookSessionPayloadSchema } from '@hub/contracts';

import {
  factsBody,
  factsTitle,
  firstLine,
  isIdleSession,
  isInsideFolder,
  keysInText,
  repoSlugOfRemote,
  summaryBody,
  summaryTitle,
} from './session';

const payload = (over: object = {}) =>
  hookSessionPayloadSchema.parse({
    sessionId: 'session-1',
    cwd: 'F:\\Goteav\\backend',
    endedAt: '2026-11-05T10:00:00.000Z',
    ...over,
  });

describe('session text', () => {
  it('takes a title from the first real line, without list marks', () => {
    expect(firstLine('\n\n- Fixed the refund\n- Other')).toBe('Fixed the refund');
    expect(summaryTitle('- Fixed the refund')).toBe('Session: Fixed the refund');
    expect(firstLine('x'.repeat(200))).toHaveLength(100);
  });

  it('writes the summary body with remaining only when there is some', () => {
    expect(summaryBody({ changed: 'a' })).toBe('### Changed\na');
    expect(summaryBody({ changed: 'a', remaining: 'b' })).toBe('### Changed\na\n\n### Remaining\nb');
  });

  it('writes the facts-only card', () => {
    const facts = payload({
      branch: 'feat/x',
      filesChanged: 2,
      additions: 3,
      deletions: 1,
      durationSec: 600,
      commits: [{ sha: 'abcdef1234', message: 'fix it' }],
    });
    expect(factsTitle(facts)).toBe('Session on feat/x: 1 commit, 2 files');
    expect(factsBody(facts)).toContain('`abcdef1` fix it');
    expect(factsBody(facts)).toContain('Duration: 10 min');
  });

  it('calls a session with no Git facts idle', () => {
    expect(isIdleSession(payload())).toBe(true);
    expect(isIdleSession(payload({ dirtyFiles: 1 }))).toBe(false);
  });
});

describe('matching', () => {
  it('finds the project keys in text, once each', () => {
    expect(keysInText('see GTV-12, GTV-12 and HUB-3 not XGTV-9', 'GTV')).toEqual(['GTV-12']);
  });

  it.each([
    ['git@github.com:Owner/Repo.git', 'owner/repo'],
    ['https://github.com/owner/repo.git', 'owner/repo'],
    ['https://github.com/owner/repo/', 'owner/repo'],
  ])('reads %s', (remote, slug) => {
    expect(repoSlugOfRemote(remote)).toBe(slug);
  });

  it('matches a folder whatever the case and the slashes', () => {
    expect(isInsideFolder('F:\\Goteav\\backend\\src', 'f:/goteav/backend/')).toBe(true);
    expect(isInsideFolder('F:/Goteav/backend-old', 'F:/Goteav/backend')).toBe(false);
  });
});

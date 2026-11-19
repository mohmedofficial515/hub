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
    expect(factsTitle(facts)).toBe('Session on feat/x: fix it');
    expect(factsBody(facts)).toContain('`abcdef1` fix it');
    expect(factsBody(facts)).toContain('Duration: 10 min');
  });

  it('names the facts card after what the member asked, and keeps the counts in the body', () => {
    const facts = payload({
      dirtyFiles: 2,
      topic: 'Fix the refund rounding\nin the wallet',
      outcome: 'Rounded half up and added a test.',
    });
    expect(factsTitle(facts)).toBe('Session: Fix the refund rounding');
    expect(factsBody(facts)).toContain('### Asked\nFix the refund rounding\nin the wallet');
    expect(factsBody(facts)).toContain('### Last reply\nRounded half up and added a test.');
    expect(factsBody(facts)).toContain('Uncommitted files at the end: 2');
  });

  it('writes the Arabic card: a title from the work, then a full body', () => {
    const facts = payload({
      branch: 'feat/x',
      filesChanged: 2,
      additions: 3,
      deletions: 1,
      durationSec: 9196 * 60,
      dirtyFiles: 4,
      commits: [
        { sha: 'abcdef1234', message: 'fix(wallet): round half up' },
        { sha: '1234567abc', message: 'test(wallet): rounding' },
      ],
      outcome: 'تم التقريب وأضيف اختبار.',
    });
    expect(factsTitle(facts, 'ar')).toBe('جلسة على feat/x: fix(wallet): round half up (+1 commits أخرى)');
    const body = factsBody(facts, 'ar');
    expect(body).toContain('لم يُكتب ملخص لهذه الجلسة');
    expect(body).toContain('- المدة: 6 يوم و9 ساعة');
    expect(body).toContain('- ملفات غير ملتزم بها في النهاية: 4');
    expect(body).toContain('### الـ commits\n- `abcdef1` fix(wallet): round half up');
    expect(body).toContain('### آخر رد\nتم التقريب وأضيف اختبار.');
    expect(body).toContain('/hub:done');
    expect(summaryTitle('- أصلحت الاسترداد', 'ar')).toBe('جلسة: أصلحت الاسترداد');
    expect(summaryBody({ changed: 'أ', remaining: 'ب' }, 'ar')).toBe('### ما تم\nأ\n\n### المتبقي\nب');
  });

  it('falls back to counts in Arabic when there is neither a topic nor a commit', () => {
    const facts = payload({ branch: 'main', filesChanged: 5, dirtyFiles: 5 });
    expect(factsTitle(facts, 'ar')).toBe('جلسة على main: 0 commits، 5 ملفات');
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

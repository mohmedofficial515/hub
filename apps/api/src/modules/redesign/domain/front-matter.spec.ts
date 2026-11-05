/**
 * @file Front-matter round trips and review scores (docs/10 §10).
 */
import { appendReviewNote, parseFrontMatter, reviewOf, setFrontMatter, textField } from './front-matter';

const README = `---
version: v2-flight-path
title: Flight path
status: draft # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-10-27
tokens: inherit
touches-components: [app/globals.css (tokens), components/a.tsx]
ported:
custom-key: "keep me"
---

# Flight path

Body with --- a rule and   odd   spacing.
`;

describe('front-matter', () => {
  it('parses scalars, inline lists, comments and quotes', () => {
    const { data, body } = parseFrontMatter(README);
    expect(data).toMatchObject({
      version: 'v2-flight-path',
      status: 'draft',
      'touches-components': ['app/globals.css (tokens)', 'components/a.tsx'],
      ported: [],
      'custom-key': 'keep me',
    });
    expect(body.startsWith('\n# Flight path')).toBe(true);
    expect(textField(data, 'ported')).toBeNull();
  });

  it('parses a block list', () => {
    const { data } = parseFrontMatter('---\nsources:\n  - a.tsx\n  - b.tsx\nstatus: x\n---\n');
    expect(data['sources']).toEqual(['a.tsx', 'b.tsx']);
    expect(data['status']).toBe('x');
  });

  it('changes only the lines it sets, and leaves the body byte for byte', () => {
    const out = setFrontMatter(README, {
      status: 'approved',
      'decision-note': 'Ship it: good',
      'decided-by': 'Mohamed',
    });
    expect(out).toContain('status: approved # draft | review | approved | rejected | ported');
    expect(out).toContain('decision-note: "Ship it: good"');
    expect(out).toContain('decided-by: Mohamed\n---\n');
    expect(out).toContain('custom-key: "keep me"');
    expect(out.slice(out.indexOf('# Flight path'))).toBe(README.slice(README.indexOf('# Flight path')));
    expect(parseFrontMatter(out).data['decision-note']).toBe('Ship it: good');
  });

  it('sets an empty key where it stands, and keeps CRLF', () => {
    const out = setFrontMatter(README, { ported: 'feat/x@abc (web)' });
    const lines = out.split('\n');
    expect(lines[lines.indexOf('custom-key: "keep me"') - 1]).toBe('ported: feat/x@abc (web)');
    const crlf = setFrontMatter('---\r\nstatus: draft\r\n---\r\n\r\nBody\r\n', {
      status: 'review',
      by: 'me',
    });
    expect(crlf).toBe('---\r\nstatus: review\r\nby: me\r\n---\r\n\r\nBody\r\n');
  });

  it('refuses a file with no front-matter rather than guessing', () => {
    expect(() => setFrontMatter('# nothing', { status: 'x' })).toThrow();
  });

  it('appends review notes, making the heading once', () => {
    const once = appendReviewNote(README, '2026-11-05 Sara: tighten the header');
    expect(once.endsWith('## Review notes\n\n- 2026-11-05 Sara: tighten the header\n')).toBe(true);
    const twice = appendReviewNote(once, '2026-11-06 Sara: better');
    expect(twice.match(/## Review notes/g)).toHaveLength(1);
    expect(twice.endsWith('- 2026-11-05 Sara: tighten the header\n- 2026-11-06 Sara: better\n')).toBe(true);
  });

  it('reads a review score from the pillar table, and the paragraph after it', () => {
    const review = `# Review\n\nReviewer: x\n\n| Pillar | Score /10 | One-line verdict |\n|---|---|---|\n| A | 8 | ok |\n| B | 7 | ok |\n| C | 8 | ok |\n| D | 7.4 | ok |\n\nThe verdict in a line.\nStill the verdict.\n\nNot this.\n`;
    expect(reviewOf(review)).toEqual({ score: 76, summary: 'The verdict in a line. Still the verdict.' });
  });

  it('a score key wins, a plain score works, a Summary heading wins', () => {
    expect(reviewOf('---\nscore: 86\n---\n# R\n').score).toBe(86);
    expect(reviewOf('Overall: 71 / 100').score).toBe(71);
    expect(reviewOf('# R\n\n## Summary\n\nShort.\n\n## Other\n').summary).toBe('Short.');
    expect(reviewOf('nothing here')).toEqual({ score: null, summary: null });
  });
});

/**
 * @file The lab's own front-matter reader keeps working with the keys Hub writes (docs/10 §10).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { field, parseFrontMatter } from './frontmatter.ts';

test('reads scalars, inline lists and block lists', () => {
  const { data, body } = parseFrontMatter(
    '---\ntitle: Flight path\nstatus: review # note\ntouches: [a, b]\nlist:\n  - one\n  - two\n---\n# Body\n',
  );
  assert.equal(field(data, 'title'), 'Flight path');
  assert.equal(field(data, 'status'), 'review');
  assert.deepEqual(data['touches'], ['a', 'b']);
  assert.deepEqual(data['list'], ['one', 'two']);
  assert.equal(body, '# Body\n');
});

test('keeps the keys Hub writes without breaking the gallery', () => {
  const { data } = parseFrontMatter(
    '---\nstatus: approved\ndecision-note: "Go"\ndecided-at: 2026-11-06T09:30:00.000Z\nhub-card: GTV-258\n---\n',
  );
  assert.equal(field(data, 'status'), 'approved');
  assert.equal(field(data, 'decision-note'), 'Go');
  assert.equal(field(data, 'hub-card'), 'GTV-258');
});

test('a file with no front-matter is all body', () => {
  assert.deepEqual(parseFrontMatter('# Only text\n'), { data: {}, body: '# Only text\n' });
});

/**
 * @file The queue's words exist in both languages, key for key, and no plural form is missing.
 */
import { describe, expect, it } from 'vitest';

import ar from '../../../messages/ar/queue.json';
import en from '../../../messages/en/queue.json';

const keys = (value: unknown, path = ''): string[] =>
  value && typeof value === 'object'
    ? Object.entries(value).flatMap(([key, inner]) => keys(inner, path ? `${path}.${key}` : key))
    : [path];

describe('queue.json', () => {
  it('holds the same keys in ar and en, apart from plural forms', () => {
    const plain = (list: string[]) =>
      list.filter((path) => !path.startsWith('files.') && !path.startsWith('tabs.running.'));
    expect(plain(keys(ar)).sort()).toEqual(plain(keys(en)).sort());
    expect(Object.keys(ar.files)).toEqual(expect.arrayContaining(['one', 'other']));
    expect(Object.keys(ar.tabs.running)).toEqual(expect.arrayContaining(['one', 'two', 'few', 'other']));
  });
});

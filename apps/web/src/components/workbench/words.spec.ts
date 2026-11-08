/**
 * @file words.spec.ts
 * @description The panel's catalog: both languages say the same things, and a form's `{name}` holes match, so no control is silent in one language.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

type Tree = { [key: string]: string | string[] | Tree };
const read = (locale: string): Tree =>
  JSON.parse(readFileSync(resolve(__dirname, `../../../messages/${locale}/chat.json`), 'utf8')) as Tree;

function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]): [string, string][] => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') return [[path, value]];
    if (Array.isArray(value)) return value.map((item, i): [string, string] => [`${path}.${i}`, item]);
    return leaves(value, path);
  });
}

const en = new Map(leaves(read('en')));
const ar = new Map(leaves(read('ar')));
/** A plural form may use the count in one language and a word in the other: Arabic's "one" often does. */
const isPluralForm = (path: string) => /\.(zero|one|two|few|many|other)$/.test(path);
const holes = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('chat.json', () => {
  it('has the same keys in both languages', () => {
    expect([...en.keys()].filter((key) => !ar.has(key))).toEqual([]);
    expect([...ar.keys()].filter((key) => !en.has(key))).toEqual([]);
  });

  it('fills the same holes in both languages', () => {
    const wrong = [...en.entries()].filter(
      ([path, text]) => !isPluralForm(path) && holes(text).join() !== holes(ar.get(path) ?? '').join(),
    );
    expect(wrong.map(([path]) => path)).toEqual([]);
  });

  it('keeps no fixed time or version from the prototype', () => {
    for (const map of [en, ar]) {
      const stale = [...map.entries()].filter(([, text]) =>
        /15:45|2\.1\.3\d\d|2\.1\.202|Monday 08:00/.test(text),
      );
      expect(stale.map(([path]) => path)).toEqual([]);
    }
  });

  it('keeps no prototype-only words; the queue words are the real queue’s (docs/16 §9)', () => {
    const paths = [...en.keys()];
    expect(paths.filter((path) => /.demo|pro.gaps|pro.links/i.test(path))).toEqual([]);
    expect(paths.filter((path) => /schedule/i.test(path) && !path.startsWith('tips.items.queue:'))).toEqual(
      [],
    );
  });
});

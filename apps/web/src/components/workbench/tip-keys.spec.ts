/**
 * @file tip-keys.spec.ts
 * @description Every tooltip key the panel and the sheet name exists in both catalogs, template keys included (review 2026-11-08 B1: `mode.${mode}` named no key, a cast hid it, and the mode tips showed no text).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

type Tips = { items: Record<string, unknown>; off: Record<string, unknown> };
const catalog = (locale: string): Tips =>
  (
    JSON.parse(readFileSync(resolve(__dirname, `../../../messages/${locale}/chat.json`), 'utf8')) as {
      tips: Tips;
    }
  ).tips;
const catalogs = { en: catalog('en'), ar: catalog('ar') };

const here = __dirname;
const sources = [
  ...readdirSync(here)
    .filter((name) => name.endsWith('.tsx') && !name.includes('.spec.'))
    .map((name) => join(here, name)),
  resolve(here, '../cards/card-sheet.tsx'),
].map((path) => ({ path, text: readFileSync(path, 'utf8') }));

/** What a `${…}` in a key may stand for. A new placeholder must be added here, so it is checked rather than skipped. */
const PLACEHOLDERS: Record<string, readonly string[]> = { mode: ['ask', 'plan', 'execute'] };

const prefixes = [...new Set(Object.keys(catalogs.en.items).map((key) => key.split(':')[0]))];
/** A tip key always has a colon. `doc.draft` and the like are event kinds, and a dotted `k=` is caught above. */
const keyLike = new RegExp(`['"\`]((?:${prefixes.join('|')}):[\\w:.-]+)['"\`]`, 'g');

function itemKeys(): { key: string; where: string }[] {
  const found: { key: string; where: string }[] = [];
  for (const { path, text } of sources) {
    const where = path.split(/[\\/]/).slice(-2).join('/');
    for (const match of text.matchAll(/\bk=(?:"([^"]+)"|\{'([^']+)'\})/g)) {
      found.push({ key: match[1] ?? match[2] ?? '', where });
    }
    for (const match of text.matchAll(/\bk=\{`([^`]+)`/g)) {
      const template = match[1] ?? '';
      const holes = [...template.matchAll(/\$\{(\w+)\}/g)].map((m) => m[1] ?? '');
      for (const hole of holes)
        expect(PLACEHOLDERS[hole], `${where}: unknown \${${hole}} in a tip key`).toBeDefined();
      const expand = (rest: string): string[] => {
        const next = /\$\{(\w+)\}/.exec(rest);
        if (!next) return [rest];
        return (PLACEHOLDERS[next[1] ?? ''] ?? []).flatMap((value) => expand(rest.replace(next[0], value)));
      };
      for (const key of expand(template)) found.push({ key, where });
    }
    // Keys held in data, such as `tip: 'strip:chat'`, and then passed as `k={tip}`.
    for (const match of text.matchAll(keyLike)) {
      const key = match[1] ?? '';
      if (!key.includes('{') && !/\.(tsx?|json)$/.test(key)) found.push({ key, where });
    }
  }
  return found;
}

describe('tooltip keys', () => {
  it('finds the keys it is meant to check', () => {
    const keys = itemKeys().map((item) => item.key);
    expect(keys).toEqual(expect.arrayContaining(['mode:ask', 'mode:plan', 'mode:execute', 'strip:chat']));
  });

  it('names only keys that exist, in both languages', () => {
    const missing = itemKeys().flatMap(({ key, where }) =>
      (['en', 'ar'] as const)
        .filter((locale) => !(key in catalogs[locale].items))
        .map((locale) => `${where} ${key} (${locale})`),
    );
    expect(missing).toEqual([]);
  });

  it('names only reasons for a disabled control that exist, in both languages', () => {
    const missing: string[] = [];
    for (const { path, text } of sources) {
      for (const match of text.matchAll(/\boff=(?:"([^"]+)"|\{'([^']+)'\})/g)) {
        const key = match[1] ?? match[2] ?? '';
        for (const locale of ['en', 'ar'] as const) {
          if (!(key in catalogs[locale].off)) missing.push(`${path} ${key} (${locale})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('never casts a tip key, which is how a wrong one got past the types', () => {
    const casts = sources.filter(({ text }) => /\bk=\{[^}]*\bas '[^']+'/.test(text)).map(({ path }) => path);
    expect(casts).toEqual([]);
  });
});

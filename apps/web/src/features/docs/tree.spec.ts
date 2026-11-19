/**
 * @file The docs tree: twins, sizes, links between docs, and recents.
 */
import { describe, expect, it } from 'vitest';

import type { DocCard } from '@/features/cards/types';

import {
  type DocFolder,
  docTwin,
  fileName,
  filterTree,
  findDocByPath,
  folderSize,
  folderTrail,
  hideTwins,
  neighbours,
  recentDocs,
  resolveDocLink,
  resolvePath,
  treeContains,
} from './tree';

const doc = (key: string, path: string, lastEventAt = '2026-11-01T00:00:00Z', sourceName = 'backend') =>
  ({ key, type: 'doc', lastEventAt, doc: { path, sourceName } }) as unknown as DocCard;

const a = doc('A', 'docs/21-safety.md', '2026-11-03T00:00:00Z');
const aAr = doc('B', 'docs/21-safety.ar.md', '2026-11-04T00:00:00Z');
const adr = doc('C', 'docs/adr/0005-pay.md');
const lone = doc('D', 'docs/only.ar.md');
const root: DocFolder = {
  path: 'docs',
  name: 'docs',
  docs: [a, aAr, lone],
  folders: [{ path: 'docs/adr', name: 'adr', docs: [adr], folders: [] }],
};

describe('tree', () => {
  it('hides a twin only when its pair is there', () => {
    const shown = hideTwins(root);
    expect(shown.docs.map((d) => d.key)).toEqual(['A', 'D']);
    expect(folderSize(shown)).toBe(3);
  });
  it('finds the twin in either direction', () => {
    expect(docTwin(a, [a, aAr])?.key).toBe('B');
    expect(docTwin(aAr, [a, aAr])?.key).toBe('A');
    expect(docTwin(adr, [a, aAr])).toBeUndefined();
  });
  it('knows which folder holds a doc', () => {
    expect(treeContains(root, 'C')).toBe(true);
    expect(treeContains(root, null)).toBe(false);
  });
  it('names a file without its extension', () => {
    expect(fileName('docs/adr/0005-pay.md')).toBe('0005-pay');
  });
});

describe('links between docs', () => {
  const all = [a, aAr, adr, doc('X', 'docs/adr/0005-pay.md', undefined, 'dashboard')];
  it('normalises a relative path', () => {
    expect(resolvePath('docs/adr/x.md', '../21-safety.md#refund')).toBe('docs/21-safety.md');
    expect(resolvePath('docs/x.md', './adr/0005-pay.md')).toBe('docs/adr/0005-pay.md');
  });
  it('prefers the same source, and leaves external links alone', () => {
    expect(resolveDocLink(a, './adr/0005-pay.md', all)?.key).toBe('C');
    expect(resolveDocLink(a, 'https://x.dev/a.md', all)).toBeUndefined();
    expect(resolveDocLink(a, '#anchor', all)).toBeUndefined();
    expect(resolveDocLink(a, './missing.md', all)).toBeUndefined();
  });
  it('finds a reading path by its exact or trailing path', () => {
    expect(findDocByPath('docs/21-safety.md', all)?.key).toBe('A');
    expect(findDocByPath('adr/0005-pay.md', all)?.key).toBe('C');
  });
});

describe('recentDocs', () => {
  it('is newest first without twins', () => {
    expect(recentDocs([adr, aAr, a]).map((d) => d.key)).toEqual(['A', 'C']);
  });
});

describe('filterTree', () => {
  it('keeps the docs whose name or path holds the text, and their folders', () => {
    const out = filterTree(root, '21');
    expect(out.docs.map((d) => d.key)).toEqual(['A', 'B']);
    expect(out.folders).toEqual([]);
    expect(filterTree(root, 'PAY').folders[0]?.docs.map((d) => d.key)).toEqual(['C']);
  });
  it('is the whole tree for no text, and empty for no match', () => {
    expect(filterTree(root, '  ')).toBe(root);
    expect(folderSize(filterTree(root, 'nothing-like-this'))).toBe(0);
  });
});

describe('reading order', () => {
  it('gives the docs on either side, and a twin its pair’s place', () => {
    const order = [a, adr, lone];
    expect(neighbours(adr, order, [a, aAr, adr, lone])).toEqual({ prev: a, next: lone });
    expect(neighbours(a, order, []).prev).toBeUndefined();
    expect(neighbours(aAr, order, [a, aAr]).next?.key).toBe('C');
  });
  it('names the folders of a path', () => {
    expect(folderTrail('docs/adr/0005-pay.md')).toEqual(['docs', 'adr']);
  });
});

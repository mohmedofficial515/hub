/**
 * @file tree.ts
 * @description The docs tree with no React (docs/09 §11): twins in another language have no row of their own, and a relative link
 * between docs resolves to the viewer when its target is indexed.
 */
import type { DocCard } from '@/features/cards/types';

export interface DocFolder {
  /** Folder path inside its source; '' at the root. */
  path: string;
  name: string;
  docs: DocCard[];
  folders: DocFolder[];
}

export interface DocSource {
  id: string;
  name: string;
  root: DocFolder;
}

export const fileName = (path: string) => (path.split('/').pop() ?? path).replace(/\.md$/, '');

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Names in the order a person counts: `2-x` before `10-x`, README first, case ignored. */
export function naturalCompare(a: string, b: string) {
  const readme = (n: string) => (/^readme$/i.test(n) ? 0 : 1);
  return readme(a) - readme(b) || collator.compare(a, b);
}

/** A file name as words: its leading number kept apart, dashes and underscores as spaces. `15-planning_v2` → { n: '15', words: 'planning v2' }. */
export function readableName(path: string): { n: string | null; words: string } {
  const base = fileName(path).replace(/\.ar$/, '');
  const match = /^(\d+(?:\.\d+)*)[-_. ]+(.+)$/.exec(base);
  const rest = (match ? match[2] : base) ?? base;
  return { n: match ? (match[1] ?? null) : null, words: rest.replace(/[-_]+/g, ' ').trim() || base };
}

/** The same tree with folders and docs in natural order at every level. */
export function sortTree(folder: DocFolder): DocFolder {
  return {
    ...folder,
    docs: [...folder.docs].sort((a, b) => naturalCompare(fileName(a.doc.path), fileName(b.doc.path))),
    folders: [...folder.folders].sort((a, b) => naturalCompare(a.name, b.name)).map(sortTree),
  };
}

export const isTwinFile = (path: string) => path.endsWith('.ar.md');

const twinOfPath = (path: string) => (isTwinFile(path) ? path.replace(/\.ar\.md$/, '.md') : path.replace(/\.md$/, '.ar.md'));

/** A doc's language pair, in the same source. */
export function docTwin(card: DocCard, all: readonly DocCard[]): DocCard | undefined {
  const path = twinOfPath(card.doc.path);
  return all.find((d) => d.doc.sourceName === card.doc.sourceName && d.doc.path === path);
}

/** Every doc of a tree, twins too, in reading order. */
export function allDocs(folder: DocFolder): DocCard[] {
  return [...folder.docs, ...folder.folders.flatMap(allDocs)];
}

/** Hide a twin only when its other language is there to reach it through the toggle. */
export function hideTwins(folder: DocFolder, all: readonly DocCard[] = allDocs(folder)): DocFolder {
  return {
    ...folder,
    docs: folder.docs.filter((d) => !isTwinFile(d.doc.path) || !docTwin(d, all)),
    folders: folder.folders.map((f) => hideTwins(f, all)),
  };
}

/**
 * The tree cut down to the docs whose title, readable name or path holds `q`, case ignored, and the folders on the way to them. An empty `q` is the
 * whole tree. A file a reader knows by name is then a few letters away (knowledge-04); the full text is the Ask page's job.
 */
export function filterTree(folder: DocFolder, q: string): DocFolder {
  const needle = q.trim().toLocaleLowerCase();
  if (!needle) return folder;
  const hit = (d: DocCard) =>
    [d.title ?? '', readableName(d.doc.path).words, d.doc.path].some((s) =>
      s.toLocaleLowerCase().includes(needle),
    );
  const cut = (f: DocFolder): DocFolder => ({
    ...f,
    docs: f.docs.filter(hit),
    folders: f.folders.map(cut).filter((sub) => folderSize(sub) > 0),
  });
  return cut(folder);
}

/** Every doc in the order the tree reads, without twins: what comes before and after the one open (knowledge-05). */
export const readingOrder = (sources: readonly DocSource[]): DocCard[] => sources.flatMap((s) => allDocs(s.root));

/** The docs on either side of `card` in reading order. A twin stands in its pair's place. */
export function neighbours(
  card: DocCard,
  order: readonly DocCard[],
  all: readonly DocCard[],
): { prev?: DocCard | undefined; next?: DocCard | undefined } {
  let at = order.findIndex((d) => d.key === card.key);
  if (at < 0) {
    const twin = docTwin(card, all);
    at = twin ? order.findIndex((d) => d.key === twin.key) : -1;
  }
  if (at < 0) return {};
  return { prev: order[at - 1], next: order[at + 1] };
}

/** The folders a doc sits in, inside its source: `docs/adr/0005-pay.md` → ['docs', 'adr']. */
export const folderTrail = (path: string) => path.split('/').filter(Boolean).slice(0, -1);

/** How many docs a reader sees under a folder. */
export const folderSize = (folder: DocFolder): number =>
  folder.docs.length + folder.folders.reduce((n, f) => n + folderSize(f), 0);

export const treeContains = (folder: DocFolder, key: string | null): boolean =>
  !!key && (folder.docs.some((d) => d.key === key) || folder.folders.some((f) => treeContains(f, key)));

/** Normalises `./a/../b.md` against the doc's own folder. */
export function resolvePath(from: string, href: string): string {
  const parts = from.split('/').slice(0, -1);
  for (const piece of (href.split('#')[0] ?? '').split('/')) {
    if (piece === '' || piece === '.') continue;
    if (piece === '..') parts.pop();
    else parts.push(piece);
  }
  return parts.join('/');
}

/** A relative link goes to the viewer when its target is indexed, in this source first. */
export function resolveDocLink(card: DocCard, href: string, all: readonly DocCard[]): DocCard | undefined {
  if (/^[a-z]+:/i.test(href) || href.startsWith('#')) return undefined;
  const path = resolvePath(card.doc.path, href);
  const same = all.filter((d) => d.doc.path === path);
  return same.find((d) => d.doc.sourceName === card.doc.sourceName) ?? same[0];
}

/** A doc path as a reading path names it: the exact path, otherwise one that ends with it. */
export function findDocByPath(path: string, all: readonly DocCard[]): DocCard | undefined {
  return all.find((d) => d.doc.path === path) ?? all.find((d) => d.doc.path.endsWith(`/${path}`));
}

/** What changed lately, without twins. */
export const recentDocs = (all: readonly DocCard[], limit = 6) =>
  all
    .filter((d) => !isTwinFile(d.doc.path))
    .sort((a, b) => Date.parse(b.lastEventAt) - Date.parse(a.lastEventAt))
    .slice(0, limit);

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

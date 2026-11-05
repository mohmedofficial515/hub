/**
 * @file lab.ts
 * @description The lab's rules with no React: reading a screenshot's file name, choosing the closest picture, the default compare
 * pair (docs/15 §3). A version's address is the gallery's: `versionQuery` in `gallery.ts`.
 */
import type { CardAttachment } from '@/features/cards/types';

export type ShotDir = 'rtl' | 'ltr';
export type ShotTheme = 'light' | 'dark';

export interface ShotMeta {
  name: string;
  url: string;
  /** Absent on a named state (`sheet-decide.png`), which is not part of the size, language and theme matrix. */
  width?: number | undefined;
  dir?: ShotDir | undefined;
  theme?: ShotTheme | undefined;
}

export type MatrixShot = ShotMeta & { width: number; dir: ShotDir; theme: ShotTheme };

const NAME = /^(\d+)-(rtl|ltr|ar|en)-(light|dark)\.(?:png|jpe?g|webp)$/i;

/** `1440-rtl-dark.png` and `1440-ar-dark.png` are both in the lab. */
export function parseShot(name: string, url: string): ShotMeta {
  const match = NAME.exec(name);
  if (!match) return { name, url };
  const lang = match[2]?.toLowerCase();
  return {
    name,
    url,
    width: Number(match[1]),
    dir: lang === 'rtl' || lang === 'ar' ? 'rtl' : 'ltr',
    theme: match[3]?.toLowerCase() === 'dark' ? 'dark' : 'light',
  };
}

const inMatrix = (shot: ShotMeta): shot is MatrixShot => shot.width !== undefined;

/** The screenshots of a version, widest first. */
export const shotsFrom = (
  attachments: readonly Pick<CardAttachment, 'kind' | 'name' | 'url'>[],
): ShotMeta[] =>
  attachments
    .filter((a) => a.kind === 'screenshot')
    .map((a) => parseShot(a.name, a.url))
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0) || a.name.localeCompare(b.name));

/** The exact picture when it exists, otherwise the nearest width, then the same direction, then the same theme. */
export function pickShot(
  shots: readonly ShotMeta[],
  want: { width: number; dir: ShotDir; theme: ShotTheme },
): MatrixShot | undefined {
  const score = (s: MatrixShot) =>
    Math.abs(s.width - want.width) * 10 + (s.dir === want.dir ? 0 : 3) + (s.theme === want.theme ? 0 : 2);
  return shots.filter(inMatrix).sort((a, b) => score(a) - score(b))[0];
}

interface VersionRef {
  key: string;
  redesign: { version: string; base?: string | undefined };
}

/** Default pair for a version (09 §10, "base vs this"): its base, or the version beside it on the page. */
export function compareDefaults(card: VersionRef, versions: readonly VersionRef[]): [string, string] {
  const base = versions.find((v) => v.redesign.version === card.redesign.base);
  const at = versions.findIndex((v) => v.key === card.key);
  const fallback = versions[at - 1] ?? versions[at + 1] ?? card;
  return [(base ?? fallback).key, card.key];
}

/** Two at most, and only from one page: picking a version of another page starts again. */
export function togglePicked(picked: readonly string[], key: string, pageKeys: readonly string[]): string[] {
  if (picked.includes(key)) return picked.filter((k) => k !== key);
  return [...picked.filter((k) => pageKeys.includes(k)), key].slice(-2);
}

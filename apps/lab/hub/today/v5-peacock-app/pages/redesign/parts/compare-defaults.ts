import type { RedesignCard } from '@lab/mocks/hub-app';
import { labPages } from '@lab/mocks/hub-app/redesign';
import { getCard } from '../../../kit/card-store';

/** Default pair for a version (09 §10, "base vs this"): its base, or the version before it on the page. */
export function compareDefaults(card: RedesignCard): [string, string] {
  const page = labPages.find((p) => p.versionKeys.includes(card.key));
  const versions = (page?.versionKeys ?? []).map((k) => getCard(k)).filter((x): x is RedesignCard => x?.type === 'redesign');
  const base = versions.find((v) => v.redesign.version === card.redesign.base);
  const at = versions.findIndex((v) => v.key === card.key);
  const fallback = versions[at - 1] ?? versions[at + 1] ?? card;
  return [(base ?? fallback).key, card.key];
}

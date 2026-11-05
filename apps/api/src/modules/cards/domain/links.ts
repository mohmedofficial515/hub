/**
 * @file How a link a client asks for maps to its stored row, and the cycle check (docs/03 §5, docs/04 §3.8).
 * @description A row reads `from <kind> to`: `from` blocks `to`, and `from`'s parent is `to`. `blocked_by` and
 * `child` are the same rows seen from the other end.
 */
import type { LinkInputKind } from '@hub/contracts';

export interface StoredLink {
  readonly fromCardId: string;
  readonly toCardId: string;
  readonly kind: string;
}

export function toStoredLink(kind: LinkInputKind, selfId: string, otherId: string): StoredLink {
  switch (kind) {
    case 'blocked_by':
      return { fromCardId: otherId, toCardId: selfId, kind: 'blocks' };
    case 'child':
      return { fromCardId: otherId, toCardId: selfId, kind: 'parent' };
    default:
      return { fromCardId: selfId, toCardId: otherId, kind };
  }
}

const INVERSE: Readonly<Record<LinkInputKind, LinkInputKind>> = {
  blocks: 'blocked_by',
  blocked_by: 'blocks',
  parent: 'child',
  child: 'parent',
  relates: 'relates',
  duplicates: 'duplicates',
};

/** The same link as the card at the other end names it. */
export function inverseLinkKind(kind: LinkInputKind): LinkInputKind {
  return INVERSE[kind];
}

/** Links with a direction that must not loop. */
export function isDirected(kind: string): boolean {
  return kind === 'blocks' || kind === 'parent';
}

/**
 * True when adding `from → to` would close a loop, that is, when `to` already reaches `from`. Walks level by
 * level through `targetsOf`, which returns the cards a set of cards point at.
 */
export async function wouldCreateCycle(
  fromCardId: string,
  toCardId: string,
  targetsOf: (ids: readonly string[]) => Promise<readonly string[]>,
): Promise<boolean> {
  const seen = new Set<string>([toCardId]);
  let frontier: readonly string[] = [toCardId];
  while (frontier.length > 0) {
    if (frontier.includes(fromCardId)) return true;
    const next = (await targetsOf(frontier)).filter((id) => !seen.has(id));
    for (const id of next) seen.add(id);
    frontier = [...new Set(next)];
  }
  return false;
}

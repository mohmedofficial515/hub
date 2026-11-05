/**
 * @file Link mapping and cycle detection.
 */
import { inverseLinkKind, toStoredLink, wouldCreateCycle } from './links';

const graph = (edges: Record<string, string[]>) => async (ids: readonly string[]) =>
  ids.flatMap((id) => edges[id] ?? []);

describe('toStoredLink', () => {
  it('stores blocked_by and child as the inverse row', () => {
    expect(toStoredLink('blocked_by', 'me', 'other')).toEqual({
      fromCardId: 'other',
      toCardId: 'me',
      kind: 'blocks',
    });
    expect(toStoredLink('child', 'me', 'other')).toEqual({
      fromCardId: 'other',
      toCardId: 'me',
      kind: 'parent',
    });
    expect(toStoredLink('blocks', 'me', 'other')).toEqual({
      fromCardId: 'me',
      toCardId: 'other',
      kind: 'blocks',
    });
  });

  it('names the inverse for the mirror event', () => {
    expect(inverseLinkKind('blocks')).toBe('blocked_by');
    expect(inverseLinkKind('child')).toBe('parent');
    expect(inverseLinkKind('relates')).toBe('relates');
  });
});

describe('wouldCreateCycle', () => {
  it('finds a direct back edge', async () => {
    await expect(wouldCreateCycle('a', 'b', graph({ b: ['a'] }))).resolves.toBe(true);
  });

  it('finds a long way round', async () => {
    await expect(wouldCreateCycle('a', 'b', graph({ b: ['c'], c: ['d'], d: ['a'] }))).resolves.toBe(true);
  });

  it('allows a diamond', async () => {
    await expect(wouldCreateCycle('a', 'd', graph({ b: ['d'], c: ['d'], a: ['b', 'c'] }))).resolves.toBe(
      false,
    );
  });

  it('ends on a graph that already loops elsewhere', async () => {
    await expect(wouldCreateCycle('a', 'b', graph({ b: ['c'], c: ['b'] }))).resolves.toBe(false);
  });
});

/**
 * @file Which finished cards wait for a release, the date spine, and who wrote the notes.
 */
import { describe, expect, it } from 'vitest';

import type { CardListItem, ReleaseCard } from '@/features/cards/types';

import { eligibleForRelease, hasNotes, notesAuthor, shippedByMonth } from './rules';

const card = (key: string, type: string, status: string, closedAt: string) =>
  ({ key, type, status, closedAt, lastEventAt: closedAt }) as unknown as CardListItem;

const release = (key: string, status: string, releasedAt: string | undefined, includedKeys: string[] = []) =>
  ({
    key,
    status,
    createdAt: '2026-01-01T00:00:00Z',
    release: { releasedAt, includedKeys, notes: { team: '', owner: '', accountant: '' } },
  }) as unknown as ReleaseCard;

describe('eligibleForRelease', () => {
  const shipped = release('R1', 'released', '2026-10-10T00:00:00Z', ['T0']);
  const planned = release('R2', 'planned', undefined, ['T1']);

  it('takes each type only in its finished status', () => {
    const cards = [
      card('T2', 'task', 'done', '2026-10-20T00:00:00Z'),
      card('T3', 'task', 'ready', '2026-10-20T00:00:00Z'),
      card('H1', 'handoff', 'applied', '2026-10-20T00:00:00Z'),
      card('D1', 'decision', 'decided', '2026-10-20T00:00:00Z'),
      card('X1', 'redesign', 'ported', '2026-10-20T00:00:00Z'),
      card('X2', 'redesign', 'approved', '2026-10-20T00:00:00Z'),
    ];
    expect(eligibleForRelease(cards, [shipped]).map((c) => c.key)).toEqual(['T2', 'H1', 'D1', 'X1']);
  });
  it('leaves out what a release already holds, shipped or planned', () => {
    const cards = [
      card('T0', 'task', 'done', '2026-10-20T00:00:00Z'),
      card('T1', 'task', 'done', '2026-10-20T00:00:00Z'),
    ];
    expect(eligibleForRelease(cards, [shipped, planned])).toEqual([]);
  });
  it('leaves out what finished before the last shipped release', () => {
    expect(eligibleForRelease([card('T9', 'task', 'done', '2026-10-01T00:00:00Z')], [shipped])).toEqual([]);
  });
});

describe('shippedByMonth', () => {
  it('groups newest first and ignores what is planned', () => {
    const groups = shippedByMonth([
      release('A', 'released', '2026-10-02T12:00:00Z'),
      release('B', 'released', '2026-11-02T12:00:00Z'),
      release('C', 'released', '2026-10-20T12:00:00Z'),
      release('D', 'planned', undefined),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2026-11', '2026-10']);
    expect(groups[1]?.rows.map((r) => r.key)).toEqual(['C', 'A']);
  });
});

describe('notes', () => {
  it('says whether any audience has text', () => {
    expect(hasNotes({ team: '', owner: '', accountant: '' })).toBe(false);
    expect(hasNotes({ team: 'x', owner: '', accountant: '' })).toBe(true);
  });
  it('names the last hand on the notes, and the system for a template', () => {
    const edit = {
      kind: 'field_changed',
      actorKind: 'agent' as const,
      actorId: 'u1',
      data: { field: 'notes' },
    };
    const other = {
      kind: 'field_changed',
      actorKind: 'user' as const,
      actorId: 'u2',
      data: { field: 'tag' },
    };
    expect(notesAuthor([edit, other])).toEqual({ kind: 'agent', memberId: 'u1' });
    expect(notesAuthor([other])).toEqual({ kind: 'system' });
  });
});

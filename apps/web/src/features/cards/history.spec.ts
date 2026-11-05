/**
 * @file History shows what a member can read, and no internals (review M1).
 */
import { describe, expect, it } from 'vitest';

import { eventFacts } from './history';

const NAMES = { priority: 'Priority', reason: 'Reason', channels: 'Channels', by: 'By', note: 'Note' };
const SARA = '01a1ac5f-6ceb-7e24-91f9-e020e7744d58';
const nameOf = (id: string) => (id === SARA ? 'Sara' : undefined);
const facts = (data: Record<string, unknown>) => eventFacts(data, NAMES, nameOf);

describe('eventFacts', () => {
  it('hides what GTV-51 printed: an id, an object and an import path', () => {
    expect(
      facts({
        userId: '01a1ac5f-6ceb-7e24-91f9-e020e7744d58',
        snapshot: { a: 1 },
        importedFrom: 'import:suggestion:dashboard.agent-assisted-changes',
      }),
    ).toEqual({ change: null, rows: [] });
  });

  it('shows named fields, and never an object or a flag under a known name', () => {
    expect(facts({ reason: 'Too late', note: { a: 1 }, by: true, priority: '' }).rows).toEqual([
      { key: 'reason', label: 'Reason', value: 'Too late' },
    ]);
  });

  it('turns a member id into a name, and drops an id nobody can name', () => {
    expect(facts({ by: SARA }).rows).toEqual([{ key: 'by', label: 'By', value: 'Sara' }]);
    expect(facts({ by: '11111111-2222-4333-8444-555555555555' }).rows).toEqual([]);
  });

  it('lists an array of words, not an array of anything else', () => {
    expect(facts({ channels: ['inbox', 'push'] }).rows[0]?.value).toBe('inbox · push');
    expect(facts({ channels: [{ a: 1 }] }).rows).toEqual([]);
    expect(facts({ channels: [] }).rows).toEqual([]);
  });

  it('a status change has no label; a named field has its own', () => {
    expect(facts({ from: 'open', to: 'decided' }).change).toEqual({
      label: null,
      from: 'open',
      to: 'decided',
    });
    expect(facts({ field: 'priority', from: 'P2', to: 'P0' }).change).toEqual({
      label: 'Priority',
      from: 'P2',
      to: 'P0',
    });
  });

  it('hides a change to a field that has no name, and one holding an id or an object', () => {
    expect(facts({ field: 'presence', to: 'missing', from: 'present' }).change).toBeNull();
    expect(facts({ field: 'priority', from: { a: 1 }, to: 'P0' }).change).toBeNull();
    expect(facts({ from: '11111111-2222-4333-8444-555555555555', to: 'x' }).change).toBeNull();
  });

  it('a null side reads as nothing, and two of them hide the line', () => {
    expect(facts({ field: 'priority', from: null, to: 'P0' }).change?.from).toBeNull();
    expect(facts({ field: 'priority', from: null, to: null }).change).toBeNull();
  });

  it('the change fields never come back as rows', () => {
    expect(facts({ from: 'a', to: 'b', field: 'priority', title: 'T', selfVerified: true }).rows).toEqual([]);
  });
});

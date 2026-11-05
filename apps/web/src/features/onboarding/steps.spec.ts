/**
 * @file The union of a member's paths, phases, and where a step leads.
 */
import { describe, expect, it } from 'vitest';

import { mergeGroups, nextStepOf, stepTarget } from './steps';

const doc = { id: 'what', kind: 'doc', title: 'What', ref: 'docs/README.md' } as const;

describe('mergeGroups', () => {
  it('lists a step once, with every role that holds it', () => {
    const steps = mergeGroups([
      { role: 'frontend', items: [doc, { id: 'api', kind: 'doc', title: 'API', ref: 'x.md' }] },
      { role: 'qa', items: [doc] },
    ]);
    expect(steps.map((s) => s.id)).toEqual(['what', 'api']);
    expect(steps[0]?.roles).toEqual(['frontend', 'qa']);
  });

  it('places a step by what it is', () => {
    const steps = mergeGroups([
      {
        role: 'frontend',
        items: [
          doc,
          { id: 'pack', kind: 'action', title: 'Pack', ref: 'install_pack' },
          { id: 'claim', kind: 'action', title: 'Claim', ref: 'first_claim' },
          { id: 'alerts', kind: 'url', title: 'Alerts', ref: 'settings/notifications' },
          { id: 'dec', kind: 'card', title: 'Decide', ref: 'decisions' },
        ],
      },
    ]);
    expect(steps.map((s) => [s.id, s.phase])).toEqual([
      ['what', 'read'],
      ['pack', 'setup'],
      ['alerts', 'setup'],
      ['claim', 'work'],
      ['dec', 'work'],
    ]);
  });

  it('lets an action tick itself, and gives the first session its command', () => {
    const [read, session] = mergeGroups([
      {
        role: 'qa',
        items: [{ id: 'session', kind: 'action', title: 'Run', ref: 'first_session' }, doc],
      },
    ]);
    expect(session).toMatchObject({ auto: true, command: '/hub:start' });
    expect(read?.auto).toBe(false);
  });

  it('finds the first step not done', () => {
    const steps = mergeGroups([
      {
        role: 'qa',
        items: [
          { ...doc, done: true },
          { id: 'b', kind: 'doc', title: 'B', ref: 'b.md', done: false },
        ],
      },
    ]);
    expect(nextStepOf(steps)?.id).toBe('b');
  });
});

describe('stepTarget', () => {
  it('opens an indexed doc in the viewer, and the Docs page otherwise', () => {
    expect(stepTarget(doc, 'GTV-1')).toEqual({ kind: 'view', view: 'docs', query: { doc: 'GTV-1' } });
    expect(stepTarget(doc)).toEqual({ kind: 'view', view: 'docs' });
  });
  it('opens a card key in the sheet', () => {
    expect(stepTarget({ kind: 'card', ref: 'GTV-12' })).toEqual({ kind: 'card', card: 'GTV-12' });
  });
  it('knows the actions that open a page, and has nothing to open for a command', () => {
    expect(stepTarget({ kind: 'action', ref: 'install_pack' })).toMatchObject({ view: 'settings' });
    expect(stepTarget({ kind: 'action', ref: 'first_session' })).toBeNull();
  });
  it('keeps a page of the app inside, and an address outside', () => {
    expect(stepTarget({ kind: 'url', ref: 'settings/notifications' })).toEqual({
      kind: 'view',
      view: 'settings',
      query: { tab: 'notifications' },
    });
    expect(stepTarget({ kind: 'url', ref: 'https://x.dev' })).toEqual({
      kind: 'external',
      href: 'https://x.dev',
    });
  });
});

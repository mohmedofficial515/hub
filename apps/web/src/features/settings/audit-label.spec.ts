/**
 * @file Audit rows read as words, whatever the code (review m6).
 */
import { describe, expect, it } from 'vitest';

import { auditActionLabel, isMachineSummary, isOpaqueId, summaryInRow } from './audit-label';

const words = {
  codes: { 'identity:sign_in': 'Signed in' },
  verbs: { create: 'Create', link: 'Link', change: 'Change' },
  groups: { cards: 'Cards', members: 'Members', system: 'System' },
  actions: { decide: 'Decide' },
  actionsByType: { redesign: { approve: 'Approve the version' } },
  types: { redesign: 'Redesign', decision: 'Decision', task: 'Task' },
};

describe('auditActionLabel', () => {
  it('names a card action by its verb and type, with or without the cards prefix', () => {
    expect(auditActionLabel('cards.redesign.create', words)).toBe('Create · Redesign');
    expect(auditActionLabel('task.create', words)).toBe('Create · Task');
    expect(auditActionLabel('cards.decision.decide', words)).toBe('Decide · Decision');
    expect(auditActionLabel('cards.redesign.approve', words)).toBe('Approve the version · Redesign');
  });

  it('a generic card action has no type word', () => {
    expect(auditActionLabel('card.link', words)).toBe('Link');
    expect(auditActionLabel('cards.card.link', words)).toBe('Link');
  });

  it('a whole code wins', () => {
    expect(auditActionLabel('identity.sign_in', words)).toBe('Signed in');
  });

  it('an unknown card verb says a change happened, and anything else its group', () => {
    expect(auditActionLabel('cards.task.new_verb', words)).toBe('Change · Task');
    expect(auditActionLabel('members.new_thing', words)).toBe('Members');
    expect(auditActionLabel('nothing.known', words)).toBe('System');
  });
});

describe('isMachineSummary', () => {
  it.each(['redesign.create GTV-309', 'cards.task.claim EAR-1', 'settings.update'])('%s is code', (s) => {
    expect(isMachineSummary(s)).toBe(true);
  });

  it.each(['Lab file changed GTV-1', 'تغيّر الملف', 'Invited a@x.test'])('%s is a sentence', (s) => {
    expect(isMachineSummary(s)).toBe(false);
  });
});

describe('isOpaqueId', () => {
  it('knows a record id from something a person can read', () => {
    expect(isOpaqueId('01a1ad5f-21f5-75c6-b840-388220757239')).toBe(true);
    expect(isOpaqueId('digest.morning_time')).toBe(false);
    expect(isOpaqueId('a@x.test')).toBe(false);
  });
});

describe('summaryInRow', () => {
  it('keeps the server’s English out of the Arabic row, and in the English one', () => {
    expect(summaryInRow('Lab file changed GTV-301', 'ar')).toBe(false);
    expect(summaryInRow('Lab file changed GTV-301', 'en')).toBe(true);
  });

  it('keeps Arabic a person wrote, and never shows a code', () => {
    expect(summaryInRow('سلّمت الجزء الأول إلى الفريق', 'ar')).toBe(true);
    expect(summaryInRow('redesign.create GTV-309', 'en')).toBe(false);
  });
});

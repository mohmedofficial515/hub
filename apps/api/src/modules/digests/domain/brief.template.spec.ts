/**
 * @file Golden files of the brief and the weekly summary, in both languages (docs/07 §8).
 */
import type { BriefCard, BriefSections, WeeklySections } from '@hub/contracts';

import { expectGolden } from '../../../../test/golden';
import { renderBrief, renderWeekly } from './brief.template';

const card = (key: string, title: string, overrides: Partial<BriefCard> = {}): BriefCard => ({
  key,
  type: 'decision',
  title,
  status: 'open',
  priority: 'P1',
  dueAt: null,
  overdue: false,
  escalated: false,
  action: null,
  ...overrides,
});

const empty: BriefSections = {
  awaitingMe: { decisions: [], needs: [], handoffs: [], reviews: [] },
  deadlines: [],
  changes: { since: '2026-11-04T04:30:00.000Z', repos: [], sessions: [], handoffs: [] },
  decided: [],
  readyTasks: [],
  mySessions: [],
  blocked: [],
  releases: [],
};

const full: BriefSections = {
  awaitingMe: {
    decisions: [card('GTV-1', 'Gateway', { dueAt: '2026-11-06T09:00:00.000Z', action: 'decide' })],
    needs: [card('GTV-2', 'Tax number', { type: 'need' })],
    handoffs: [card('GTV-3', 'Refund route', { type: 'handoff' })],
    reviews: [card('GTV-4', 'Wallet v7', { type: 'redesign' })],
  },
  deadlines: [
    card('GTV-1', 'Gateway', { dueAt: '2026-11-05T09:00:00.000Z', overdue: true, escalated: true }),
  ],
  changes: {
    since: '2026-11-04T04:30:00.000Z',
    repos: [{ name: 'backend', commitCount: 5, authors: ['Sara'], prs: [] }],
    sessions: [{ key: 'GTV-5', title: 'Refunds', author: 'Yousef' }],
    handoffs: [{ key: 'GTV-3', title: 'Refund route' }],
  },
  decided: [{ key: 'GTV-6', title: 'Currency', option: 'USD', rationale: 'Settles directly' }],
  readyTasks: [card('GTV-7', 'Fix RTL', { type: 'task', priority: 'P2' })],
  mySessions: [{ sessionId: 's1', repo: 'hub', branch: 'feat/x' }],
  blocked: [{ key: 'GTV-8', title: 'Launch doc', blockerKey: 'GTV-1', blockerRole: 'accountant' }],
  releases: [{ key: 'GTV-9', version: '2026-11-03', title: 'Split payments' }],
};

const weekly: WeeklySections = {
  from: '2026-11-02',
  to: '2026-11-08',
  counts: {
    byType: { task: 4 },
    byKind: { created: 4, decided: 1 },
    commits: 3,
    prsMerged: 1,
    sessions: 2,
    sessionsNoSummary: 1,
  },
  decided: [card('GTV-6', 'Currency')],
  released: [card('GTV-9', 'Split payments', { type: 'release' })],
  merged: [card('GTV-10', 'PR 12', { type: 'change' })],
  handoffs: { created: 2, applied: 1, pending: [{ ...card('GTV-3', 'Refund route'), ageHours: 50 }] },
  needs: { delivered: 1, verified: 1, open: 2 },
  redesign: { approved: 1, ported: 0, inReview: 2 },
  overdue: [card('GTV-1', 'Gateway', { overdue: true })],
  nextWeek: [card('GTV-11', 'Launch')],
  topRepos: [{ name: 'backend', commits: 3 }],
  contributors: [{ user: { kind: 'user', userId: 'u', displayName: 'Sara', via: 'web' }, events: 9 }],
};

const quietWeek: WeeklySections = {
  ...weekly,
  counts: { byType: {}, byKind: {}, commits: 0, prsMerged: 0, sessions: 0, sessionsNoSummary: 0 },
  decided: [],
  released: [],
  merged: [],
  handoffs: { created: 0, applied: 0, pending: [] },
  needs: { delivered: 0, verified: 0, open: 0 },
  redesign: { approved: 0, ported: 0, inReview: 0 },
  overdue: [],
  nextWeek: [],
  topRepos: [],
  contributors: [],
};

describe.each(['en', 'ar'] as const)('templates in %s', (locale) => {
  it('brief with everything', () => {
    expectGolden(`brief-full.${locale}.md`, renderBrief(full, '2026-11-05', locale));
  });
  it('brief with nothing shows the two empty lines only', () => {
    expectGolden(`brief-empty.${locale}.md`, renderBrief(empty, '2026-11-05', locale));
  });
  it('weekly', () => {
    expectGolden(`weekly-full.${locale}.md`, renderWeekly(weekly, '2026-W45', locale));
  });
  it('a quiet week', () => {
    expectGolden(`weekly-quiet.${locale}.md`, renderWeekly(quietWeek, '2026-W45', locale));
  });
});

/**
 * @file Numbers and the awaiting stack, and where sign-in lands.
 */
import { describe, expect, it } from 'vitest';

import type { CardListItem } from '../cards/types';
import { landingFor } from './auth';
import { buildAwaiting, toMyCounts } from './session';

const soon = new Date(Date.now() + 3_600_000).toISOString();
const row = (key: string, awaiting: string | null, extra: Partial<CardListItem> = {}) =>
  ({ key, awaiting, priority: 'P2', type: 'decision', status: 'open', ...extra }) as unknown as CardListItem;

describe('buildAwaiting', () => {
  it('keeps only rows with a verb from the API, and uses that verb', () => {
    const rows = buildAwaiting([row('A', null), row('B', 'apply')]);
    expect(rows.map((r) => [r.key, r.action])).toEqual([['B', 'apply']]);
  });

  it('puts urgent first, then the next 24 h, then the rest by priority', () => {
    const rows = buildAwaiting([
      row('REST', 'decide', { priority: 'P3' }),
      row('REST0', 'decide', { priority: 'P0' }),
      row('SOON', 'decide', { dueAt: soon }),
      row('LATE', 'decide', { flags: { overdue: true } }),
    ]);
    expect(rows.map((r) => r.key)).toEqual(['LATE', 'SOON', 'REST0', 'REST']);
    expect(rows.map((r) => r.group)).toEqual(['urgent', 'soon', 'rest', 'rest']);
  });
});

describe('toMyCounts', () => {
  it('is all zero before the API answers, so no badge invents a number', () => {
    const counts = toMyCounts(undefined);
    expect(counts.inbox).toBe(0);
    expect(counts.decisions.mine).toBe(0);
  });
});

describe('landingFor', () => {
  const ws = (slug: string) => ({ slug }) as never;

  it('honours where the member was going', () => {
    expect(landingFor({ workspaces: [ws('a')] }, 'ar', '/ar/a/tasks?x=1')).toBe('/ar/a/tasks?x=1');
  });

  it('refuses a next that leaves the site', () => {
    expect(landingFor({ workspaces: [ws('a')] }, 'ar', '//evil.example')).toBe('/ar/a/today');
    expect(landingFor({ workspaces: [ws('a')] }, 'ar', 'https://evil.example')).toBe('/ar/a/today');
  });

  it('goes to the only project, or to the list', () => {
    expect(landingFor({ workspaces: [ws('a')] }, 'en', null)).toBe('/en/a/today');
    expect(landingFor({ workspaces: [ws('a'), ws('b')] }, 'en', null)).toBe('/en/workspaces');
    expect(landingFor({ workspaces: [] }, 'en', null)).toBe('/en/workspaces');
  });
});

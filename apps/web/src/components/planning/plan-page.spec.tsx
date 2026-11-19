/**
 * @file A plan's own page as a journey (v5-live-plan, batch 1): phases on the map and in the chapter, the step drawer, effort and the finish estimate,
 * a plan saved before phases, twenty phases, and a form save that keeps each step in its phase.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { PlanningPage } from './planning-page';

let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/en/demo/planning',
}));

const me = {
  id: 'u1',
  displayName: 'Owner',
  avatarColor: 'teal',
  workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles: ['owner'] }],
};

const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

const plan = (key: string, detail: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  id: `id-${key}`,
  key,
  type: 'plan',
  status: 'in_progress',
  title: `Title ${key}`,
  priority: 'P2',
  ownerRole: 'owner',
  createdAt: new Date().toISOString(),
  lastEventAt: new Date().toISOString(),
  createdBy: { kind: 'user', userId: 'u1', displayName: 'Owner', via: 'web' },
  flags: {},
  tags: [],
  commentCount: 0,
  body: 'The approach',
  allowedActions: ['plan.update'],
  detail: { revision: 2, ...detail },
  ...over,
});

const page = (items: unknown[]) => ({
  body: { data: items, meta: { pagination: { nextCursor: null, limit: 100 } } },
});

function api(cards: Record<string, unknown>) {
  return stubFetch((url) => {
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return { body: { data: me } };
    if (path.endsWith('/members')) return page([]);
    const key = Object.keys(cards).find((k) => path.endsWith(`/cards/${k}`));
    if (key) return { body: { data: cards[key] } };
    if (path.endsWith('/work-reports')) return { body: { data: [] } };
    if (path.endsWith('/events') || path.endsWith('/comments')) return page([]);
    if (path.endsWith('/ideas') || path.endsWith('/plans')) return page([]);
    return undefined;
  });
}

const show = (ui: ReactNode) => renderWithApp(<Tooltip.Provider>{ui}</Tooltip.Provider>);

const phases = [
  { id: 'p0', title: 'Setup', note: 'The owner' },
  { id: 'p1', title: 'Build' },
];
const steps = [
  {
    id: 's1',
    title: 'Decide the scope',
    done: true,
    doneAt: day(6),
    phaseId: 'p0',
    role: 'owner',
    size: 'S',
  },
  { id: 's2', title: 'Write the contract', done: true, doneAt: day(4), phaseId: 'p0', role: 'owner' },
  { id: 's3', title: 'Draw the screens', done: true, doneAt: day(2), phaseId: 'p1', role: 'designer' },
  {
    id: 's4',
    title: 'Build the page',
    done: false,
    phaseId: 'p1',
    role: 'frontend',
    size: 'L',
    why: 'Nobody can book without it.',
    acceptance: 'The page loads\nThe tests pass',
  },
  { id: 's5', title: 'Ship it', done: false, phaseId: 'p1', role: 'frontend', after: ['s4'] },
];

beforeEach(() => {
  vi.unstubAllGlobals();
  search = '';
});

describe('a plan with phases', () => {
  it('draws the journey: a stop per phase and the finish line, with the next phase picked', async () => {
    search = 'plan=P-1';
    api({ 'P-1': plan('P-1', { phases, steps }) });
    show(<PlanningPage />);
    const map = await screen.findByRole('group', { name: 'The plan as a journey' });
    const stops = within(map).getAllByRole('button');
    expect(stops).toHaveLength(2);
    expect(stops[0]?.getAttribute('aria-label')).toMatch(/^Phase 0 of 1: Setup\. 2 of 2 steps done\. Done$/);
    expect(stops[1]?.getAttribute('aria-pressed')).toBe('true');
    expect(stops[1]?.getAttribute('aria-current')).toBe('step');
    expect(within(map).getByText('Finish line')).toBeTruthy();
    // The chapter is the phase holding the next step.
    expect(screen.getByRole('heading', { level: 3, name: 'Build' })).toBeTruthy();
    expect(screen.getByText('2 phases')).toBeTruthy();
  });

  it('weighs effort by size and estimates the finish from three dated steps', async () => {
    search = 'plan=P-1';
    api({ 'P-1': plan('P-1', { phases, steps }) });
    show(<PlanningPage />);
    // S 1 + M 3 + M 3 done, of 1 + 3 + 3 + 8 + 3.
    expect(await screen.findByText('Effort 7 of 18 points')).toBeTruthy();
    expect(screen.getByText(/^Estimated finish /)).toBeTruthy();
  });

  it('hides the estimate with fewer than three dated steps', async () => {
    search = 'plan=P-1';
    const undated = steps.map(({ doneAt: _doneAt, ...step }) => step);
    api({ 'P-1': plan('P-1', { phases, steps: undated }) });
    show(<PlanningPage />);
    expect(await screen.findByText('Effort 7 of 18 points')).toBeTruthy();
    expect(screen.queryByText(/^Estimated finish /)).toBeNull();
  });

  it('moves the chapter when another stop is picked, and locks a step that waits for another', async () => {
    search = 'plan=P-1';
    api({ 'P-1': plan('P-1', { phases, steps }) });
    show(<PlanningPage />);
    expect(await screen.findByText('Waits for step 4')).toBeTruthy();
    const map = screen.getByRole('group', { name: 'The plan as a journey' });
    fireEvent.click(within(map).getAllByRole('button')[0]!);
    expect(await screen.findByRole('heading', { level: 3, name: 'Setup' })).toBeTruthy();
    expect(screen.getByText('No steps left in this phase.')).toBeTruthy();
  });

  it('opens a step in the drawer: why, its checks, what it opens the way to, and Esc closes it', async () => {
    search = 'plan=P-1';
    api({ 'P-1': plan('P-1', { phases, steps }) });
    show(<PlanningPage />);
    const chapter = await screen.findByRole('region', { name: 'Build' });
    fireEvent.click(within(chapter).getByRole('button', { name: /Step 4: Build the page/ }));
    const drawer = await screen.findByRole('dialog', { name: 'Build the page' });
    expect(within(drawer).getByText('Nobody can book without it.')).toBeTruthy();
    expect(within(drawer).getByText('The tests pass')).toBeTruthy();
    expect(within(drawer).getByRole('heading', { name: 'Opens the way to' })).toBeTruthy();
    // A linked step opens in its place.
    fireEvent.click(within(drawer).getByRole('button', { name: /Ship it/ }));
    expect(await screen.findByRole('dialog', { name: 'Ship it' })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('lists every phase folded, and opens one', async () => {
    search = 'plan=P-1';
    api({ 'P-1': plan('P-1', { phases, steps }) });
    show(<PlanningPage />);
    const all = await screen.findByRole('region', { name: 'All phases' });
    const toggle = within(all).getByRole('button', { name: /Phase 0: Setup/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps all twenty phases on the map', async () => {
    search = 'plan=P-9';
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, title: `Phase title ${i}` }));
    api({
      'P-9': plan('P-9', {
        phases: many,
        steps: many.map((p, i) => ({ id: `s${i}`, title: `Step ${i}`, done: i < 5, phaseId: p.id })),
      }),
    });
    show(<PlanningPage />);
    const map = await screen.findByRole('group', { name: 'The plan as a journey' });
    expect(within(map).getAllByRole('button')).toHaveLength(20);
    expect(screen.getByRole('heading', { level: 3, name: 'Phase title 5' })).toBeTruthy();
  });

  it('keeps each step in its phase when the form saves', async () => {
    search = 'plan=P-1&action=edit';
    const { calls } = api({ 'P-1': plan('P-1', { phases, steps }) });
    show(<PlanningPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const sent = calls.find((c) => c.method === 'PATCH')?.body as {
      steps: { phaseId?: string }[];
      phases?: unknown;
    };
    expect(sent.steps.map((s) => s.phaseId)).toEqual(['p0', 'p0', 'p1', 'p1', 'p1']);
    // The form does not edit phases, so it leaves them as they are.
    expect(sent.phases).toBeUndefined();
  });
});

describe('a plan saved before phases', () => {
  it('shows the head and one plain list, with no ring, no map and no roles chart', async () => {
    search = 'plan=P-2';
    const legacy = steps.map(({ phaseId: _phaseId, ...step }) => step);
    api({ 'P-2': plan('P-2', { phases: [], steps: legacy }) });
    show(<PlanningPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Title P-2' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'The plan as a journey' })).toBeNull();
    expect(document.querySelector('[data-plan-ring]')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Who carries the plan' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Steps' })).toBeTruthy();
    expect(screen.getByText(/This plan has no phases/)).toBeTruthy();
    expect(screen.queryByText(/^Effort /)).toBeNull();
  });

  it('a plan whose detail has no phases at all reads the same', async () => {
    search = 'plan=P-3';
    api({ 'P-3': plan('P-3', { steps: [{ id: 's1', title: 'Only step', done: false }] }) });
    show(<PlanningPage />);
    expect(await screen.findByRole('region', { name: 'Steps' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'The plan as a journey' })).toBeNull();
  });
});

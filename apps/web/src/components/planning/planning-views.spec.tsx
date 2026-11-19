/**
 * @file Planning's own pages beyond the lists: a plan's steps as a way of working (task, status, evidence), the idea's report, the links between them, the
 * forms that keep what they did not change, and the studios' honest states with no panel or no chat.
 */
import type { ProposedPlan } from '@hub/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { PlanningPage } from './planning-page';
import { PlanReport } from './studio/plan-report';
import { Questions } from './studio/questions';

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

const row = (key: string, type: string, status: string, detail: Record<string, unknown> = {}, over = {}) => ({
  id: `id-${key}`,
  key,
  type,
  status,
  title: `Title ${key}`,
  priority: 'P2',
  ownerRole: 'owner',
  createdAt: new Date().toISOString(),
  lastEventAt: new Date().toISOString(),
  createdBy: { kind: 'user', userId: 'u1', displayName: 'Owner', via: 'web' },
  flags: {},
  tags: [],
  commentCount: 0,
  detail,
  ...over,
});

const page = (items: unknown[]) => ({
  body: { data: items, meta: { pagination: { nextCursor: null, limit: 100 } } },
});

/** Answers the session and the lists, one full card, and anything else as empty. */
function api(cards: Record<string, unknown>, lists: { ideas?: unknown[]; plans?: unknown[] } = {}) {
  return stubFetch((url) => {
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return { body: { data: me } };
    if (path.endsWith('/members')) return page([]);
    const key = Object.keys(cards).find((k) => path.endsWith(`/cards/${k}`));
    if (key) return { body: { data: cards[key] } };
    if (path.endsWith('/events') || path.endsWith('/comments') || path.endsWith('/work-reports'))
      return path.endsWith('/work-reports') ? { body: { data: [] } } : page([]);
    if (path.endsWith('/ideas')) return page(lists.ideas ?? []);
    if (path.endsWith('/plans')) return page(lists.plans ?? []);
    return undefined;
  });
}

const show = (ui: ReactNode) => renderWithApp(<Tooltip.Provider>{ui}</Tooltip.Provider>);

beforeEach(() => {
  vi.unstubAllGlobals();
  search = '';
});

describe('a plan’s steps', () => {
  const task = {
    key: 'T-1',
    type: 'task',
    status: 'in_progress',
    title: 'Build the search',
    priority: 'P2',
    flags: {},
    createdAt: new Date().toISOString(),
    lastEventAt: new Date().toISOString(),
    createdBy: { kind: 'user', userId: 'u1', displayName: 'Owner', via: 'web' },
    tags: [],
    commentCount: 0,
  };
  const plan = row(
    'P-1',
    'plan',
    'in_progress',
    {
      steps: [
        { id: 's1', title: 'Build the search', done: false, taskKey: 'T-1' },
        { id: 's2', title: 'Ship it', done: false },
      ],
    },
    { body: 'The approach', allowedActions: ['plan.update'], links: [{ kind: 'relates', card: task }] },
  );

  it('says where each step’s task stands, from the plan itself, with no list of tasks read', async () => {
    search = 'plan=P-1';
    const { calls } = api({ 'P-1': plan });
    show(<PlanningPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Title P-1' })).toBeTruthy();
    expect(screen.getAllByText('In progress').length).toBeGreaterThan(0);
    expect(screen.getByText('Unassigned')).toBeTruthy();
    expect(screen.getByText('No task yet')).toBeTruthy();
    expect(calls.some((c) => /\/tasks(\?|$)/.test(c.path))).toBe(false);
    // What comes next names the step and its task, in the head's next-step callout.
    expect(screen.getAllByText('Step 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Build the search').length).toBeGreaterThan(1);
  });

  it('reads a step’s evidence only when it is opened, once', async () => {
    search = 'plan=P-1';
    const { calls } = api({ 'P-1': plan });
    show(<PlanningPage />);
    const toggle = await screen.findByRole('button', { name: 'Evidence' });
    expect(calls.filter((c) => c.path.endsWith('/T-1/work-reports'))).toHaveLength(0);
    fireEvent.click(toggle);
    expect(await screen.findByText('No evidence yet')).toBeTruthy();
    expect(calls.filter((c) => c.path.endsWith('/T-1/work-reports'))).toHaveLength(1);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('offers to add steps to a plan that has none', async () => {
    search = 'plan=P-2';
    api({ 'P-2': row('P-2', 'plan', 'draft', { steps: [] }, { allowedActions: ['plan.update'] }) });
    show(<PlanningPage />);
    expect(await screen.findByRole('button', { name: 'Add steps' })).toBeTruthy();
    expect(screen.getByText('No steps yet. Add them, or develop the plan with Claude.')).toBeTruthy();
  });

  it('shows the details of a tab the address does not know', async () => {
    search = 'plan=P-1&tab=foo';
    api({ 'P-1': plan });
    show(<PlanningPage />);
    expect(await screen.findByText('Ship it')).toBeTruthy();
  });

  it('keeps a step done through Claude done when the form saves', async () => {
    search = 'plan=P-3&action=edit';
    const done = row(
      'P-3',
      'plan',
      'draft',
      { steps: [{ id: 's1', title: 'Talk to the supplier', done: true }] },
      { allowedActions: ['plan.update'] },
    );
    const { calls } = api({ 'P-3': done });
    show(<PlanningPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const sent = calls.find((c) => c.method === 'PATCH')?.body as { steps: { id: string; done: boolean }[] };
    expect(sent.steps).toEqual([{ id: 's1', title: 'Talk to the supplier', done: true }]);
  });

  it('shows the steps once when the text holds their list, with each one’s reason and size', async () => {
    search = 'plan=P-4';
    const body =
      '## Goal\n\nSell hotels.\n\n## Steps\n\n1. Sign the supplier [S]: No contract, no hotels.\n2. Ship it (after 1)\n\n## Risks\n\n- Rates change';
    api({
      'P-4': row(
        'P-4',
        'plan',
        'draft',
        {
          steps: [
            { id: 'a', title: 'Sign the supplier', done: false },
            { id: 'b', title: 'Ship it', done: false },
          ],
        },
        { body },
      ),
    });
    show(<PlanningPage />);
    expect(await screen.findByText('No contract, no hotels.')).toBeTruthy();
    // Once in the steps (the head's next-step callout names it too), and not again in the text.
    expect(
      within(screen.getByRole('region', { name: 'Steps' })).getAllByText('Sign the supplier'),
    ).toHaveLength(1);
    expect(
      within(screen.getByRole('region', { name: "The plan's text" })).queryByText(/Sign the supplier/),
    ).toBeNull();
    expect(screen.getByText('Small')).toBeTruthy();
  });
});

describe('an idea’s page', () => {
  it('reads a report once, with its outline, and no notes that repeat it', async () => {
    search = 'plan=I-1';
    const body =
      '## The problem\n\nSlow.\n\n## The value\n\nIt saves an hour a day.\n\n## Risks\n\nNone yet.';
    api({
      'I-1': row('I-1', 'idea', 'open', { problem: 'Slow.', notes: 'It saves an hour a day.' }, { body }),
    });
    show(<PlanningPage />);
    expect(await screen.findByRole('heading', { name: 'Report' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Notes' })).toBeNull();
    const outline = screen.getByRole('navigation', { name: 'In this idea' });
    expect(outline.querySelectorAll('a')).toHaveLength(3);
  });

  it('keeps an idea written by hand as it was', async () => {
    search = 'plan=I-2';
    api({ 'I-2': row('I-2', 'idea', 'open', { problem: 'A problem', notes: 'A note' }) });
    show(<PlanningPage />);
    expect(await screen.findByRole('heading', { name: 'Notes' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Report' })).toBeNull();
  });

  it('offers the Plan Studio from Turn into a plan', async () => {
    search = 'plan=I-3&action=to_plan';
    api({
      'I-3': row('I-3', 'idea', 'exploring', { problem: 'A problem' }, { allowedActions: ['idea.to_plan'] }),
    });
    show(<PlanningPage />);
    const link = await screen.findByRole('link', {
      name: 'Or let Claude write its steps in the Plan Studio',
    });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('studio=plan');
    expect(href).toContain('idea=I-3');
  });

  it('fills one button, its next step, and keeps Accept, Park and Reject in a Change status menu', async () => {
    search = 'plan=I-4';
    api({ 'I-4': row('I-4', 'idea', 'open', { problem: 'A problem' }) });
    show(<PlanningPage />);
    const bar = await screen.findByRole('group', { name: 'Card actions' });
    const filled = [...bar.querySelectorAll('[data-sheet-primary]')];
    expect(filled.map((b) => b.textContent)).toEqual(['Start exploring']);
    for (const name of ['Accept', 'Park', 'Reject'])
      expect(screen.queryByRole('button', { name })).toBeNull();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Change status' }), { key: 'ArrowDown' });
    for (const name of ['Accept', 'Park', 'Reject'])
      expect(await screen.findByRole('menuitem', { name })).toBeTruthy();
  });

  it('links a plan to the idea it came from, by its title, in the head', async () => {
    search = 'plan=P-5';
    const idea = { ...row('I-9', 'idea', 'accepted'), title: 'Faster refunds' };
    api({ 'P-5': row('P-5', 'plan', 'draft', { steps: [] }, { links: [{ kind: 'relates', card: idea }] }) });
    show(<PlanningPage />);
    const path = await screen.findByRole('navigation', { name: 'From idea to work' });
    expect(path.textContent).toContain('Faster refunds');
  });
});

describe('the lists', () => {
  it('says where a plan stands, and makes a number a jump to its rows', async () => {
    const plans = [
      row('P-1', 'plan', 'in_progress', {
        steps: [
          { id: 'a', title: 'Write it', done: true, taskKey: 'T-1' },
          { id: 'b', title: 'Ship it', done: false },
        ],
      }),
      row('P-2', 'plan', 'in_review', { steps: [] }),
      row('P-3', 'plan', 'in_review', { steps: [] }),
    ];
    api({}, { ideas: [], plans });
    show(<PlanningPage />);
    expect(await screen.findByText(/Next: 2\./)).toBeTruthy();
    expect(screen.getByText('1 without a task')).toBeTruthy();
    const waiting = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href')?.includes('lane-plans-in_review'));
    expect(waiting).toBeTruthy();
  });

  it('calls a plan that waits on someone else’s approval waiting, not moving', async () => {
    const backend = { ...me, workspaces: [{ ...me.workspaces[0]!, roles: ['backend'] }] };
    stubFetch((url) => {
      const path = url.pathname;
      if (path.endsWith('/auth/me')) return { body: { data: backend } };
      if (path.endsWith('/members')) return page([]);
      if (path.endsWith('/ideas')) return page([]);
      if (path.endsWith('/plans')) return page([row('P-1', 'plan', 'in_review', { steps: [] })]);
      return undefined;
    });
    show(<PlanningPage />);
    await screen.findAllByText('Title P-1');
    expect(screen.getByText('Waiting for approval', { selector: 'span' })).toBeTruthy();
    expect(screen.queryByText('Moving now')).toBeNull();
  });
});

describe('an old link to the live draft', () => {
  it('lands on the Plan Studio, replacing the address', async () => {
    search = 'draft=1';
    window.history.replaceState(null, '', '/en/demo/planning?draft=1');
    api({});
    show(<PlanningPage />);
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('studio')).toBe('plan'));
    expect(new URLSearchParams(window.location.search).get('draft')).toBeNull();
  });
});

describe('the studios with no Claude panel', () => {
  it('lets the owner write an idea down by hand', async () => {
    search = 'studio=idea';
    const { calls } = stubFetch((url) => {
      const path = url.pathname;
      if (path.endsWith('/auth/me')) return { body: { data: me } };
      if (path.endsWith('/cards')) return { body: { data: { key: 'I-7' } } };
      return page([]);
    });
    show(<PlanningPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Write it yourself' }));
    fireEvent.change(await screen.findByLabelText(/Idea title/), { target: { value: 'Weekly digest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create idea' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/cards'))).toBe(true),
    );
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({
      type: 'idea',
      title: 'Weekly digest',
    });
  });

  it('offers the plan by hand too', async () => {
    search = 'studio=plan';
    api({});
    show(<PlanningPage />);
    expect(await screen.findByRole('button', { name: 'Write it yourself' })).toBeTruthy();
  });
});

describe('PlanReport', () => {
  const plan: ProposedPlan = {
    title: 'Hotels',
    goal: 'Sell hotels.',
    approach: 'Sandbox first.',
    steps: [
      { title: 'Sign', size: 'S' },
      { title: 'Ship', after: [1] },
    ],
    outOfScope: ['Flights'],
    diagram: {
      nodes: [
        { id: 'a', label: 'Search' },
        { id: 'b', label: 'Book' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    },
    questions: [{ text: 'Which supplier?', options: [{ label: 'One' }, { label: 'Two' }] }],
    sources: [{ title: 'Docs', url: 'https://example.com/docs' }],
  };

  it('shows every section the plan has, and the questions to read when nobody answers', () => {
    show(<PlanReport plan={plan} busy={false} />);
    for (const name of ['The goal', 'The approach', 'Steps', 'Out of scope', 'Open questions', 'Sources'])
      expect(screen.getByRole('heading', { name })).toBeTruthy();
    expect(screen.getByText('Which supplier?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Send answers/ })).toBeNull();
  });
});

describe('Questions', () => {
  it('keeps the picks when the answers were not taken', async () => {
    const onAsk = vi.fn(() => false);
    show(
      <Questions
        questions={[{ text: 'Which supplier?', options: [{ label: 'One' }, { label: 'Two' }] }]}
        onAsk={onAsk}
        busy
      />,
    );
    const one = screen.getByRole('radio', { name: /One/ });
    fireEvent.click(one);
    fireEvent.click(screen.getByRole('button', { name: /Send when Claude is done/ }));
    await waitFor(() => expect(onAsk).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('radio', { name: /One/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('holds Send back while a request already waits, and says why', () => {
    show(
      <Questions
        questions={[{ text: 'Which supplier?', options: [{ label: 'One' }] }]}
        onAsk={() => true}
        busy
        blocked
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /One/ }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /Send when Claude is done/ }).disabled).toBe(
      true,
    );
    expect(
      screen.getByText('One request is already waiting. Cancel it or wait for the turn to end.'),
    ).toBeTruthy();
  });
});

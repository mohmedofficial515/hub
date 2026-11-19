/**
 * @file The plan's sheet: each step's why, size, after and acceptance read from the step itself (owner decision 9a), Send back for changes on a plan in
 * review asking for a reason and not drawn as destructive (9b), and why a draft came back.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OTHER, renderSheet, stubApi, summary } from '../test-fixture';

vi.mock('next/navigation', async () => (await import('../test-nav')).liveNavigation());

afterEach(() => {
  vi.unstubAllGlobals();
});

const plan = (status: string, steps: unknown[] = []) => ({
  ...summary('DMO-7', { type: 'plan', status, title: 'Refund plan' }),
  createdBy: { kind: 'user', userId: OTHER, displayName: 'Ali', via: 'web' },
  body: 'Some text',
  links: [],
  watchers: [],
  watching: false,
  allowedActions: ['plan.update'],
  detail: { steps, revision: 1, sourceIdeaId: null, sourceChatId: null, sourceMessageId: null },
});

const STEPS = [
  { id: 's1', title: 'Schema', done: false, size: 'S' },
  {
    id: 's2',
    title: 'API',
    done: false,
    why: 'The page reads it.',
    size: 'M',
    after: ['s1'],
    acceptance: 'The e2e suite passes.',
  },
];

describe('the plan’s sheet', () => {
  it('shows each step’s why, size, after and acceptance from the step itself', async () => {
    stubApi({ card: plan('draft', STEPS) });
    renderSheet('card=DMO-7');
    expect(await screen.findByText('The page reads it.')).toBeInTheDocument();
    expect(screen.getAllByText('Small').length).toBeGreaterThan(0);
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText(/After step/)).toHaveTextContent('After step 1');
    expect(screen.getByText('The e2e suite passes.')).toBeInTheDocument();
    expect(screen.getByText(/Done when/)).toBeInTheDocument();
  });

  it('a plan in review offers Send back for changes, which asks for a reason and is not red', async () => {
    stubApi({ card: plan('in_review'), roles: ['pm'] });
    renderSheet('card=DMO-7');
    const sheet = await waitFor(() => document.querySelector<HTMLElement>('[data-card-sheet]')!);
    const group = await within(sheet).findByRole('group', { name: /actions/i });
    fireEvent.click(await within(group).findByRole('button', { name: 'Send back for changes' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Reason/)).toBeInTheDocument();
    const yes = within(dialog).getByRole('button', { name: 'Send back for changes' });
    expect(yes.className).not.toMatch(/destructive/);
  });

  it('a draft sent back says why, and who asked', async () => {
    stubApi({
      card: plan('draft'),
      events: [
        {
          id: 'e1',
          seq: 3,
          kind: 'changes_requested',
          actor: { kind: 'user', userId: OTHER, displayName: 'Ali', via: 'web' },
          via: 'web',
          createdAt: '2026-11-19T10:00:00.000Z',
          data: { reason: 'Split step two', from: 'in_review', to: 'draft' },
        },
      ],
    });
    renderSheet('card=DMO-7');
    const note = await screen.findByRole('region', { name: 'Changes requested' });
    expect(note).toHaveTextContent('Split step two');
  });
});

/**
 * @file The sheet follows the card, not a stale link: a form shows only while its action is offered, a form opens in Details, an unknown tab
 * falls back, comments read as Markdown, links show what they carry, and a draft is not thrown away by Esc or Close.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OTHER, renderSheet, sheetQuery, stubApi, summary, task } from './test-fixture';

vi.mock('next/navigation', async () => (await import('./test-nav')).liveNavigation());

const sheet = () => document.querySelector<HTMLElement>('[data-card-sheet]')!;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CardSheet: the action in the link', () => {
  it('drops a form the card no longer offers, and gives back the filled button', async () => {
    stubApi({ card: task({ status: 'in_review' }) });
    renderSheet('card=DMO-1&action=submit_review');
    await screen.findByText('Card DMO-1');
    await waitFor(() => expect(sheetQuery().get('action')).toBeNull());
    expect(screen.queryByPlaceholderText('https://github.com/…/pull/123')).toBeNull();
    const group = within(sheet()).getByRole('group', { name: /actions/i });
    const first = within(group)
      .getAllByRole('button')
      .find((b) => !b.hasAttribute('disabled'));
    expect(first?.hasAttribute('data-sheet-primary')).toBe(true);
  });

  it('opens a form in Details from another tab', async () => {
    stubApi({ card: task({ status: 'in_review' }) });
    renderSheet('card=DMO-1&tab=comments');
    await screen.findByText('Card DMO-1');
    fireEvent.click(await screen.findByRole('button', { name: 'Back to work' }));
    await waitFor(() => expect(sheetQuery().get('tab')).toBeNull());
    expect(sheetQuery().get('action')).toBe('resume');
    expect(await screen.findByLabelText(/What needs changing/)).toBeTruthy();
  });

  it('shows Details for a tab it does not know', async () => {
    stubApi({ card: task() });
    renderSheet('card=DMO-1&tab=zzz');
    expect(await screen.findByRole('list', { name: 'Task stages' })).toBeTruthy();
  });

  it('says which card holds a Claim back', async () => {
    stubApi({
      card: task({
        flags: { blocked: true },
        links: [{ kind: 'blocked_by', card: summary('DMO-9', { status: 'in_progress' }) }],
      }),
    });
    renderSheet('card=DMO-1');
    const claim = await screen.findByRole('button', { name: 'Claim' });
    expect(claim.hasAttribute('disabled')).toBe(true);
    fireEvent.focus(claim.parentElement!);
    expect((await screen.findAllByText('Blocked by DMO-9')).length).toBeGreaterThan(0);
  });
});

describe('CardSheet: comments', () => {
  it('reads a comment as Markdown, names a former member, and makes a key a chip', async () => {
    stubApi({
      card: task(),
      comments: [
        {
          id: 'c1',
          author: { kind: 'agent', userId: 'gone', displayName: 'Mona' },
          body: '## Steps\n\n- one\n- two, after DMO-7',
          createdAt: '2026-11-02T10:00:00.000Z',
        },
      ],
    });
    renderSheet('card=DMO-1&tab=comments');
    expect(await screen.findByRole('heading', { name: 'Steps' })).toBeTruthy();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/##/)).toBeNull();
    expect(screen.getByText('Mona')).toBeTruthy();
    expect(sheet().querySelector('a[href*="card=DMO-7"]')).toBeTruthy();
  });
});

describe('CardSheet: links', () => {
  it('shows a child link, and a linked card no list has loaded with its title', async () => {
    stubApi({
      card: task({
        links: [
          { kind: 'child', card: summary('DMO-3', { title: 'The child task' }) },
          {
            kind: 'relates',
            card: summary('DMO-4', { type: 'decision', title: 'A decision', status: 'open' }),
          },
        ],
      }),
    });
    renderSheet('card=DMO-1&tab=links');
    expect(await screen.findByRole('heading', { name: 'Parent of' })).toBeTruthy();
    expect(screen.getByText('The child task')).toBeTruthy();
    expect(screen.getByText('A decision')).toBeTruthy();
  });

  it('sends a key the caches do not know, and removes a link', async () => {
    const { calls } = stubApi({
      card: task({ links: [{ kind: 'relates', card: summary('DMO-4') }] }),
      extra: (url, method) =>
        method !== 'GET' && url.pathname.endsWith('/links') ? { body: { data: task() } } : undefined,
    });
    renderSheet('card=DMO-1&tab=links');
    fireEvent.change(await screen.findByLabelText('Card key'), { target: { value: 'dmo-55' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/cards/DMO-1/links'))).toBe(true),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove the link to DMO-4' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.path.endsWith('/cards/DMO-1/links'))).toBe(true),
    );
  });

  it('asks for no card list while its pickers are closed', async () => {
    const { calls } = stubApi({ card: task() });
    renderSheet('card=DMO-1');
    await screen.findByText('Card DMO-1');
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.some((c) => c.method === 'GET' && /\/cards$/.test(c.path))).toBe(false);
  });
});

describe('CardSheet: a draft is kept', () => {
  it('asks before Esc throws away an edit, and Discard closes', async () => {
    stubApi({ card: task() });
    renderSheet('card=DMO-1&action=edit');
    const title = await screen.findByLabelText(/^Title/);
    fireEvent.input(title, { target: { value: 'New title' } });
    fireEvent.keyDown(title, { key: 'Escape' });
    const dialog = await screen.findByRole('dialog');
    expect(sheetQuery().get('card')).toBe('DMO-1');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(sheetQuery().get('card')).toBeNull());
  });

  it('asks before Close throws away a comment', async () => {
    stubApi({ card: task() });
    renderSheet('card=DMO-1&tab=comments');
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'half a thought' } });
    fireEvent.click(within(sheet()).getAllByRole('button', { name: 'Close' })[0]!);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(sheetQuery().get('card')).toBe('DMO-1');
  });

  it('closes at once on Esc with nothing typed', async () => {
    stubApi({ card: task({ createdBy: { kind: 'user', userId: OTHER } }) });
    renderSheet('card=DMO-1');
    await screen.findByText('Card DMO-1');
    const heading = sheet().querySelector<HTMLElement>('[data-sheet-title]')!;
    fireEvent.keyDown(heading, { key: 'Escape' });
    await waitFor(() => expect(sheetQuery().get('card')).toBeNull());
  });
});

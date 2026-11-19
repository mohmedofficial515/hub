/**
 * @file The task section as an execution procedure: its stage and next step, the reviewer's note the claimer must read, a PR that is a real
 * link, a branch bound on the endpoint that writes it, and the order the work reads in.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ME, OTHER, renderSheet, stubApi, summary, task } from '../test-fixture';

vi.mock('next/navigation', async () => (await import('../test-nav')).liveNavigation());

const sheet = () => document.querySelector<HTMLElement>('[data-card-sheet]')!;

afterEach(() => vi.unstubAllGlobals());

describe('TaskSection: the next step', () => {
  it('shows the stages with Ready current, and the claim command', async () => {
    stubApi({ card: task() });
    renderSheet('card=DMO-1');
    const stages = await screen.findByRole('list', { name: 'Task stages' });
    expect(within(stages).getByText('Ready').closest('li')?.getAttribute('aria-current')).toBe('step');
    const next = sheet().querySelector('[data-task-next]')!;
    expect(next.textContent).toContain('Next: claim it');
    expect(next.textContent).toContain('/hub:next DMO-1');
  });

  it('tells the claimer a task in review waits for review, and shows no start prompt', async () => {
    stubApi({
      card: task({ status: 'in_review' }, { claimedById: ME, claimedAt: '2026-11-02T10:00:00.000Z' }),
      roles: ['frontend'],
    });
    renderSheet('card=DMO-1');
    await screen.findByRole('list', { name: 'Task stages' });
    expect(sheet().querySelector('[data-task-next]')?.textContent).toBe('Waiting for review.');
    expect(screen.queryByRole('heading', { name: /prompt/i })).toBeNull();
  });

  it('shows the plan a task comes from, with its title', async () => {
    stubApi({
      card: task({
        links: [
          { kind: 'parent', card: summary('DMO-2', { type: 'plan', title: 'The plan', status: 'active' }) },
        ],
      }),
    });
    renderSheet('card=DMO-1');
    const origins = await waitFor(() => {
      const el = sheet().querySelector<HTMLElement>('[data-task-origins]');
      expect(el).toBeTruthy();
      return el!;
    });
    expect(within(origins).getByText('Comes from')).toBeTruthy();
    expect(within(origins).getByText('The plan')).toBeTruthy();
  });

  it('puts the acceptance criteria before the facts', async () => {
    stubApi({ card: task({}, { acceptance: '- [ ] It works' }) });
    renderSheet('card=DMO-1');
    await screen.findByText('It works');
    const acceptance = sheet().querySelector('[data-task-acceptance]')!;
    const facts = sheet().querySelector('dl')!;
    expect(acceptance.compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('invites criteria when there are none', async () => {
    stubApi({ card: task() });
    renderSheet('card=DMO-1');
    expect(await screen.findByRole('button', { name: 'Write the criteria' })).toBeTruthy();
  });
});

describe('TaskSection: sent back and submitted', () => {
  it('sends the reviewer’s note as the reason', async () => {
    const { calls } = stubApi({
      card: task({ status: 'in_review' }),
      extra: (url, method) =>
        method === 'POST' && url.pathname.endsWith('/resume') ? { body: { data: {} } } : undefined,
    });
    renderSheet('card=DMO-1&action=resume');
    fireEvent.change(await screen.findByLabelText(/What needs changing/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send back' }));
    await waitFor(() => {
      const call = calls.find((c) => c.method === 'POST' && c.path.endsWith('/tasks/DMO-1/resume'));
      expect(call?.body).toEqual({ reason: 'x' });
    });
  });

  it('refuses a PR that is not a full link, and sends nothing', async () => {
    const { calls } = stubApi({
      card: task({ status: 'in_progress', assigneeId: ME }, { claimedById: ME }),
      roles: ['frontend'],
    });
    renderSheet('card=DMO-1&action=submit_review');
    const field = await screen.findByPlaceholderText('https://github.com/…/pull/123');
    fireEvent.change(field, { target: { value: 'github.com/x/pull/1' } });
    fireEvent.click(within(sheet()).getAllByRole('button', { name: 'Submit for review' }).at(-1)!);
    expect(await screen.findByText('Write a full link, starting with https://')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/submit-review'))).toBe(false);
  });

  it('shows the reviewer’s note to the claimer of a task sent back', async () => {
    stubApi({
      card: task({ status: 'in_progress' }, { claimedById: ME }),
      events: [
        {
          id: 'e1',
          seq: 1,
          kind: 'status_changed',
          actor: { kind: 'user', userId: OTHER, displayName: 'Ali' },
          data: { from: 'in_review', to: 'in_progress', reason: 'Fix the test' },
          createdAt: '2026-11-03T10:00:00.000Z',
        },
      ],
    });
    renderSheet('card=DMO-1');
    const note = await waitFor(() => {
      const el = sheet().querySelector<HTMLElement>('[data-task-move-note]');
      expect(el).toBeTruthy();
      return el!;
    });
    expect(within(note).getByText("Reviewer's note")).toBeTruthy();
    expect(within(note).getByText('Fix the test')).toBeTruthy();
  });
});

describe('TaskSection: bind a branch', () => {
  it('writes the task’s branch and shows it', async () => {
    const api: Parameters<typeof stubApi>[0] = { card: task() };
    api.extra = (url, method) => {
      if (method === 'PATCH' && url.pathname.endsWith('/tasks/DMO-1')) {
        api.card = task({ branch: 'feat/x' }, { branch: 'feat/x' });
        return { body: { data: {} } };
      }
      return undefined;
    };
    const { calls } = stubApi(api);
    renderSheet('card=DMO-1');
    fireEvent.click(await screen.findByRole('button', { name: 'Bind a branch' }));
    fireEvent.change(screen.getByLabelText(/Branch name/), { target: { value: 'feat/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bind' }));
    await waitFor(() => {
      const call = calls.find((c) => c.method === 'PATCH' && c.path.endsWith('/tasks/DMO-1'));
      expect(call?.body).toEqual({ branch: 'feat/x' });
    });
    expect(await screen.findByText('feat/x')).toBeTruthy();
    await waitFor(() => expect(screen.queryByLabelText(/Branch name/)).toBeNull());
  });

  it('keeps the text and says why when the API refuses', async () => {
    stubApi({
      card: task(),
      extra: (url, method) =>
        method === 'PATCH' && url.pathname.endsWith('/tasks/DMO-1')
          ? { status: 403, body: { error: { code: 'hub.auth.forbidden', message: 'Not yours' } } }
          : undefined,
    });
    renderSheet('card=DMO-1');
    fireEvent.click(await screen.findByRole('button', { name: 'Bind a branch' }));
    fireEvent.change(screen.getByLabelText(/Branch name/), { target: { value: 'feat/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bind' }));
    await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>(/Branch name/).value).toBe('feat/x'));
  });
});

describe('TaskEditForm: fields this member may not change', () => {
  it('disables the description for a member without content rights', async () => {
    stubApi({ card: task({ allowedActions: ['task.edit_detail'] }) });
    renderSheet('card=DMO-1&action=edit');
    expect((await screen.findByRole('textbox', { name: /^Description/ })).hasAttribute('disabled')).toBe(
      true,
    );
  });
});

/**
 * @file New card: a task's specialty is asked, never guessed as "backend" from a role that has none, and Create leaves a way to the card.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { dismissToast, ToastRegion } from '@/components/common/toast';
import { renderWithApp, stubFetch } from '@/test/render';

import { NewCardDialog } from './new-card-dialog';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/goteav/tasks',
}));

const me = (roles: string[]) => ({
  id: 'u1',
  displayName: 'Mohamed',
  avatarColor: 'teal',
  workspaces: [{ slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles }],
});

const api = (roles: string[]) =>
  stubFetch((url, init, request) => {
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me(roles) } };
    if (url.pathname.endsWith('/workspaces/goteav/cards') && (request?.method ?? init?.method) === 'POST') {
      return { status: 201, body: { data: { key: 'GTV-12' } } };
    }
    return undefined;
  });

const mount = () =>
  renderWithApp(
    <div id="hub-root">
      <NewCardDialog open onOpenChange={vi.fn()} initialType="task" />
      <ToastRegion />
    </div>,
  );

describe('NewCardDialog', () => {
  beforeAll(() => (MotionGlobalConfig.skipAnimations = true));
  afterAll(() => (MotionGlobalConfig.skipAnimations = false));
  beforeEach(() => window.history.replaceState(null, '', '/en/goteav/tasks'));
  afterEach(() => {
    act(() => dismissToast());
    vi.unstubAllGlobals();
  });

  it('asks an owner for the specialty and creates nothing without it', async () => {
    const { calls } = api(['owner', 'pm']);
    mount();
    // The session lands first: the dialog starts over when the member's roles arrive.
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/auth/me'))).toBe(true));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByLabelText(/Responsible role/)).toHaveValue('owner');
    expect(screen.getByLabelText(/Specialty/)).toHaveValue('');
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Draw the empty state' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText("Pick the task's specialty.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    fireEvent.change(screen.getByLabelText(/Specialty/), { target: { value: 'design' } });
    await waitFor(() => expect(screen.getByLabelText(/Specialty/)).toHaveValue('design'));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!.body as { detail: { specialty: string } };
    expect(post.detail.specialty).toBe('design');
    // The toast leads to the card it announces.
    expect(await screen.findByRole('button', { name: 'Open it' })).toHaveAttribute('data-toast-action');
  });

  it('starts a frontend member on Frontend', async () => {
    api(['frontend']);
    mount();
    await waitFor(() => expect(screen.getByLabelText(/Specialty/)).toHaveValue('frontend'));
  });
});

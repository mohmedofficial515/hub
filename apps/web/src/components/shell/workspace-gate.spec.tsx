/**
 * @file The gate keeps the shell mounted through a failed reread of `auth/me`, and shows the error only when the first load fails.
 */
import { screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { qk } from '@/features/cards/keys';
import { renderWithApp, stubFetch } from '@/test/render';

import { WorkspaceGate } from './workspace-gate';

vi.mock('./shell', () => ({ Shell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/features/live/live-provider', () => ({
  LiveProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const me = {
  id: 'u1',
  displayName: 'Mohamed',
  avatarColor: 'teal',
  workspaces: [{ slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles: ['owner'] }],
};
const down = { status: 500, body: { error: { code: 'hub.common.unavailable', message: 'down' } } };

describe('WorkspaceGate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps its children when a reread of auth/me fails after a first success', async () => {
    let fail = false;
    stubFetch((url) =>
      url.pathname.endsWith('/auth/me') ? (fail ? down : { body: { data: me } }) : undefined,
    );
    const { queryClient } = renderWithApp(
      <WorkspaceGate ws="goteav">
        <p>the page</p>
      </WorkspaceGate>,
    );
    expect(await screen.findByText('the page')).toBeInTheDocument();
    fail = true;
    await queryClient.refetchQueries({ queryKey: qk.me });
    await waitFor(() => expect(queryClient.getQueryState(qk.me)?.status).toBe('error'));
    expect(screen.getByText('the page')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error with a retry when the first load fails', async () => {
    stubFetch((url) => (url.pathname.endsWith('/auth/me') ? down : undefined));
    renderWithApp(
      <WorkspaceGate ws="goteav">
        <p>the page</p>
      </WorkspaceGate>,
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('the page')).not.toBeInTheDocument();
    expect(screen.getByText('hub.common.unavailable')).toBeInTheDocument();
  });
});

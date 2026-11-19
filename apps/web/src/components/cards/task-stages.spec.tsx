/**
 * @file TaskStages: the stages an agent reports on a task show in its sheet, read from the chat of its running run, and nothing is asked
 * when the task has no run and no report.
 */
import { screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { TaskStages } from './task-stages';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('card=DMO-1'),
  usePathname: () => '/en/demo/tasks',
}));

const AT = '2026-11-06T10:00:00.000Z';
const message = (fields: Record<string, unknown>) => ({
  truncated: false,
  context: null,
  status: null,
  failure: null,
  failureMessage: null,
  model: null,
  claudeVersion: null,
  durationMs: null,
  usage: null,
  limit: null,
  stages: [],
  plan: null,
  structuredPlan: null,
  idea: null,
  suggestions: null,
  changedFiles: [],
  steps: [],
  approvals: [],
  questions: [],
  reports: [],
  docDrafts: [],
  notices: [],
  engineFacts: null,
  createdAt: AT,
  endedAt: null,
  ...fields,
});

const chat = {
  id: 'c1',
  title: 'Work DMO-1',
  messages: [
    message({ id: 'm1', ordinal: 1, role: 'user', content: '/hub:work DMO-1', context: { card: 'DMO-1' } }),
    message({
      id: 'm2',
      ordinal: 2,
      role: 'assistant',
      content: 'Working.',
      status: 'running',
      stages: [
        { protocol: 'work', stage: 'understand', state: 'done' },
        { protocol: 'work', stage: 'plan', state: 'done' },
        { protocol: 'work', stage: 'execute', state: 'started' },
      ],
    }),
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('TaskStages', () => {
  it('shows the work checklist of the task’s running run', async () => {
    stubFetch((url) => {
      if (url.pathname.endsWith('/queue'))
        return { body: { data: { state: {}, runs: [{ id: 'r1', state: 'running', chatId: 'c1' }] } } };
      if (url.pathname.endsWith('/chats/c1')) return { body: { data: chat } };
      if (url.pathname.endsWith('/work-reports')) return { body: { data: [] } };
      return undefined;
    });
    const { container } = renderWithApp(
      <Tooltip.Provider>
        <TaskStages cardKey="DMO-1" />
      </Tooltip.Provider>,
    );
    await waitFor(() => expect(container.querySelector('[data-wb-protocol="work"]')).toBeTruthy());
    expect(container.querySelectorAll('[data-wb-protocol="work"] li').length).toBeGreaterThanOrEqual(3);
  });

  it('asks for no chat when the task has no run and no report', async () => {
    const { calls } = stubFetch((url) => {
      if (url.pathname.endsWith('/queue')) return { body: { data: { state: {}, runs: [] } } };
      if (url.pathname.endsWith('/work-reports')) return { body: { data: [] } };
      return undefined;
    });
    const { container } = renderWithApp(<TaskStages cardKey="DMO-1" />);
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/work-reports'))).toBe(true));
    expect(container.innerHTML).toBe('');
    expect(calls.some((c) => c.path.includes('/chats/'))).toBe(false);
    expect(screen.queryByRole('list')).toBeNull();
  });
});

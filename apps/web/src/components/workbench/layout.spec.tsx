/**
 * @file layout.spec.tsx
 * @description The workbench on stubbed answers from the real shapes: it draws on a page, says when no device or folder exists, shows a chat from its real messages, and the sheet is a plain region.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { opensByDefault, WorkbenchLayout } from './layout';
import { openChat, WorkbenchProvider } from './store';

const search = vi.hoisted(() => ({ value: '' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
  usePathname: () => '/en/demo/today',
}));

const me = {
  id: 'u1',
  displayName: 'Owner',
  avatarColor: 'teal',
  totpEnabled: true,
  workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles: ['owner'] }],
};
const project = {
  id: 'w1',
  slug: 'demo',
  name: 'Demo',
  keyPrefix: 'DMO',
  repoPaths: ['F:/work/app'],
  myRoles: ['owner'],
};
const device = {
  id: 'd1',
  name: 'Main',
  platform: 'win32',
  online: true,
  bridgeVersion: '1',
  claudeVersion: '2.1.318',
  vscodeFound: true,
  lastSeenAt: '2026-11-06T10:00:00.000Z',
  pairedAt: '2026-11-01T10:00:00.000Z',
  health: [],
  healthAt: null,
};
const engine = {
  found: true,
  version: '2.1.318',
  inRange: true,
  testedRange: { min: '2.1.300', max: '2.1.318' },
  message: null,
  canRun: true,
  warning: null,
  checkedAt: '2026-11-06T10:00:00.000Z',
  signedIn: true,
  effortSupported: true,
  modelSupported: true,
  live: 0,
};
const AT = '2026-11-06T10:00:00.000Z';
const chat = {
  id: 'c1',
  deviceId: 'd1',
  deviceName: 'Main',
  deviceOnline: true,
  deviceRevoked: false,
  folder: 'F:/work/app',
  branch: 'main',
  mode: 'execute',
  model: null,
  effort: null,
  sessionId: 's1',
  title: 'A chat',
  pinned: false,
  parentChatId: null,
  parentMessageId: null,
  running: true,
  lastSeq: 3,
  createdAt: AT,
  updatedAt: AT,
  deletedAt: null,
  messages: [
    {
      id: 'm1',
      ordinal: 1,
      role: 'user',
      content: 'push it',
      truncated: false,
      context: { page: 'Today' },
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
    },
    {
      id: 'm2',
      ordinal: 2,
      role: 'assistant',
      content: 'Pushing now.',
      truncated: false,
      context: null,
      status: 'running',
      failure: null,
      failureMessage: null,
      model: 'sonnet',
      claudeVersion: '2.1.318',
      durationMs: null,
      usage: null,
      limit: { status: 'allowed', utilization: 0.4 },
      stages: [],
      plan: null,
      structuredPlan: null,
      suggestions: null,
      changedFiles: [],
      steps: [
        {
          id: 's1',
          toolUseId: 't1',
          parentToolUseId: null,
          name: 'Bash',
          status: 'waiting',
          input: { command: 'git push' },
          command: 'git push',
          output: null,
          decision: null,
          textOffset: 12,
          startedAt: AT,
          endedAt: null,
        },
      ],
      approvals: [
        {
          id: 'a1',
          messageId: 'm2',
          toolUseId: 't1',
          toolName: 'Bash',
          command: 'git push',
          category: 'push',
          input: {},
          effect: 'Pushes to a remote',
          status: 'pending',
          draftId: null,
          expiresAt: AT,
          answeredAt: null,
          createdAt: AT,
        },
      ],
      questions: [],
      reports: [],
      docDrafts: [],
      notices: [],
      engineFacts: { skills: ['code-review'], mcpServers: ['hub'] },
      createdAt: AT,
      endedAt: null,
    },
  ],
};

const controls = { openNav: vi.fn(), openPalette: vi.fn(), openNew: vi.fn(), openHelp: vi.fn() };

/** Do next as the server ranks it (docs/16 §11): a plan's next task, a plan step with no task yet, and a small ready task. */
const NEXT = {
  items: [
    {
      key: 'DMO-3',
      type: 'task',
      title: 'Write the queue',
      reasons: ['plan_next', 'ready'],
      blocks: 0,
      runnable: true,
      score: 15,
      plan: { key: 'DMO-2', title: 'Refunds', index: 0 },
    },
    {
      key: 'DMO-7',
      type: 'plan',
      title: 'Draw the page',
      reasons: ['plan_next'],
      blocks: 0,
      runnable: true,
      score: 15,
      plan: { key: 'DMO-7', title: 'Wallet', index: 2 },
      step: { index: 2 },
    },
    {
      key: 'DMO-9',
      type: 'task',
      title: 'Fix a typo',
      reasons: ['small', 'ready'],
      blocks: 0,
      runnable: true,
      score: 8,
    },
  ],
};

const proposal = (id: string, state: string, body: Record<string, unknown>) => ({
  id,
  state,
  ref: null,
  answeredAt: null,
  proposal: body,
});

const PROPOSED = [
  proposal('s1', 'open', {
    kind: 'task',
    title: 'Write the README',
    why: 'Nobody knows how to start',
    ownerRole: 'backend',
  }),
  proposal('s2', 'open', {
    kind: 'plan',
    title: 'Refunds',
    why: 'The idea was never planned',
    steps: [{ title: 'Queue' }, { title: 'Page' }],
  }),
  proposal('s3', 'open', {
    kind: 'skill',
    name: 'tidy-before-merge',
    description: 'Tidy before a merge',
    why: 'Done by hand three times',
    body: '# Tidy\n\nRun the formatter.',
  }),
];

/** A finished Ask turn that ran /hub:suggest and proposed three things (D66). */
const suggested = {
  ...chat,
  id: 'c2',
  running: false,
  mode: 'ask',
  messages: [
    { ...chat.messages[0], id: 'm3', content: '/hub:suggest' },
    {
      ...chat.messages[1],
      id: 'm4',
      status: 'done',
      content: 'Here are three.',
      steps: [],
      approvals: [],
      suggestions: { summary: 'Two gaps and a chore.', items: PROPOSED },
    },
  ],
};
function answers(over: { devices?: unknown[]; repoPaths?: string[]; chats?: unknown[] } = {}) {
  return stubFetch((url, init, request) => {
    const path = url.pathname;
    const method = request?.method ?? init?.method ?? 'GET';
    if (path.endsWith('/today/next')) return { body: { data: NEXT } };
    if (path.endsWith('/chats/c2')) return { body: { data: suggested } };
    if (method === 'POST' && path.endsWith('/chats/c2/suggestions/s1')) {
      return {
        body: {
          data: { ...PROPOSED[0], state: 'accepted', ref: 'DMO-12', answeredAt: AT },
        },
      };
    }
    if (path.endsWith('/me/devices')) return { body: { data: over.devices ?? [device] } };
    if (path.endsWith('/me')) return { body: { data: me } };
    if (path.endsWith('/chats/engine')) return { body: { data: engine } };
    if (path.endsWith('/chats/c1')) return { body: { data: chat } };
    if (path.endsWith('/chats')) return { body: { data: over.chats ?? [] } };
    if (path.endsWith('/prompt-templates')) return { body: { data: [] } };
    if (path.endsWith('/workspaces/demo')) {
      return { body: { data: { ...project, repoPaths: over.repoPaths ?? project.repoPaths } } };
    }
    if (path.endsWith('/members')) return { body: { data: [] } };
    return undefined;
  });
}

const draw = () =>
  renderWithApp(
    <Tooltip.Provider>
      <div id="hub-root">
        <WorkbenchProvider>
          <WorkbenchLayout controls={controls} ready>
            <p>The page</p>
          </WorkbenchLayout>
        </WorkbenchProvider>
      </div>
    </Tooltip.Provider>,
    { locale: 'en' },
  );

describe('WorkbenchLayout', () => {
  beforeEach(() => {
    search.value = '';
    localStorage.clear();
    openChat(null);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    window.matchMedia = ((query: string) => ({
      matches: /min-width/.test(query),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
  });

  it('draws the page, the panel and the strip', async () => {
    answers();
    draw();
    expect(await screen.findByText('The page')).toBeTruthy();
    await waitFor(() => expect(document.querySelector('[data-wb-panel]')).toBeTruthy());
    expect(document.querySelector('[data-wb-strip]')).toBeTruthy();
    expect(document.querySelector('[data-wb-input]')).toBeTruthy();
  });

  it('says so when no device is connected, and blocks the composer', async () => {
    answers({ devices: [] });
    draw();
    await waitFor(() => expect(document.querySelector('[data-wb-engine="no_device"]')).toBeTruthy());
    expect((document.querySelector('[data-wb-input]') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('says so when no folder is linked', async () => {
    answers({ repoPaths: [] });
    draw();
    await waitFor(() => expect(document.querySelector('[data-wb-engine="no_folder"]')).toBeTruthy());
  });

  it('shows a chat from its real messages, with its pause and the pending count', async () => {
    answers({ chats: [chat] });
    draw();
    openChat('c1');
    await waitFor(() => expect(document.querySelector('[data-wb-approval="pending"]')).toBeTruthy());
    expect(screen.getByText('Pushing now.')).toBeTruthy();
    expect(screen.getByText('push it')).toBeTruthy();
    await waitFor(() => expect(document.querySelector('[data-wb-pending]')).toBeTruthy());
  });

  it('a first visit opens the panel only where the page keeps D54’s 400 px beside it', () => {
    expect([390, 768, 820].map(opensByDefault)).toEqual([false, false, false]);
    expect([1024, 1280, 1366, 1440].map(opensByDefault)).toEqual([true, true, true, true]);
  });

  it('an empty History says no chat exists yet, and only a search says none matches', async () => {
    answers();
    draw();
    await waitFor(() => expect(document.querySelector('[data-wb-view="history"]')).toBeTruthy());
    (document.querySelector('[data-wb-view="history"]') as HTMLButtonElement).click();
    await waitFor(() => expect(document.querySelector('[data-wb-history-empty]')).toBeTruthy());
    expect(document.querySelector('[data-wb-history-empty]')?.textContent).toContain(
      'No chats in this project yet',
    );
  });

  it('the bridge tip gives the last-seen time as Last seen, never as Connected since', async () => {
    answers({ devices: [{ ...device, online: false }] });
    draw();
    await waitFor(() => expect(document.querySelector('[data-wb-status="bridge"]')).toBeTruthy());
    const status = document.querySelector<HTMLElement>('[data-wb-status="bridge"]');
    fireEvent.keyDown(window, { key: 'Tab' });
    status?.focus();
    await waitFor(() => expect(document.querySelector('[data-wb-tipbox]')).toBeTruthy());
    const tip = document.querySelector('[data-wb-tipbox]')?.textContent ?? '';
    expect(tip).toContain('Last seen');
    expect(tip).toContain('Offline');
    expect(tip).not.toContain('Connected since');
  });

  it('has no dialog for the sheet', async () => {
    search.value = 'card=DMO-1';
    answers();
    draw();
    await waitFor(() => expect(document.querySelector('[data-card-sheet]')).toBeTruthy());
    expect(document.querySelector('[data-card-sheet]')?.tagName).toBe('SECTION');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("Runs shows Do next from the server: a plan's next task, a plan step with Run now, and a small task, each with why", async () => {
    answers();
    draw();
    await waitFor(() => expect(document.querySelector('[data-wb-view="runs"]')).toBeTruthy());
    (document.querySelector('[data-wb-view="runs"]') as HTMLButtonElement).click();
    await waitFor(() => expect(document.querySelector('[data-wb-next-item="DMO-7#2"]')).toBeTruthy());
    const why = (id: string) =>
      document.querySelector(`[data-wb-next-item="${id}"] [data-wb-next-why]`)?.textContent ?? '';
    expect(why('DMO-3')).toContain('Next step of DMO-2');
    expect(why('DMO-9')).toContain('Small');
    const step = document.querySelector('[data-wb-next-item="DMO-7#2"]');
    expect(step?.querySelector('[data-wb-next-step]')?.textContent).toContain('Step 3 of DMO-7');
    expect(step?.querySelector('[data-queue-run-now]')).toBeTruthy();
    expect(step?.querySelector('[data-queue-schedule]')).toBeTruthy();
    expect(document.querySelector('[data-wb-next-suggest]')?.textContent).toContain('Ask Claude for more');
  });

  it('a /hub:suggest turn shows each proposal with Accept and Dismiss, and Accept answers what it made', async () => {
    const { calls } = answers({ chats: [suggested] });
    draw();
    openChat('c2');
    await waitFor(() => expect(document.querySelector('[data-wb-proposals]')).toBeTruthy());
    const cards = document.querySelectorAll('[data-wb-proposal]');
    expect([...cards].map((card) => card.getAttribute('data-wb-proposal'))).toEqual([
      'task',
      'plan',
      'skill',
    ]);
    expect(screen.getByText('Two gaps and a chore.')).toBeTruthy();
    expect(screen.getByText('0 of 3 answered')).toBeTruthy();
    const accept = cards[0]!.querySelector<HTMLButtonElement>('[data-wb-proposal-accept]');
    accept?.click();
    await waitFor(() =>
      expect(
        calls.find((call) => call.method === 'POST' && call.path.endsWith('/chats/c2/suggestions/s1'))?.body,
      ).toEqual({
        decision: 'accept',
      }),
    );
    // A skill is the owner's to accept, and its text can be read in full first.
    expect(cards[2]!.querySelector('[data-wb-proposal-accept]')?.hasAttribute('disabled')).toBe(false);
    (cards[2]!.querySelector('[data-wb-proposal-text]') as HTMLButtonElement).click();
    await waitFor(() => expect(screen.getByText('Run the formatter.')).toBeTruthy());
  });

  it('the chat menu offers New project, which opens the wizard with the folder step', async () => {
    answers();
    draw();
    await waitFor(() => expect(document.querySelector('[data-wb-chat-menu]')).toBeTruthy());
    const trigger = document.querySelector<HTMLButtonElement>('[data-wb-chat-menu]')!;
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    await waitFor(() => expect(document.querySelector('[data-wb-menu-item="new-project"]')).toBeTruthy());
    fireEvent.click(document.querySelector('[data-wb-menu-item="new-project"]')!);
    await waitFor(() => expect(screen.getByText(/Step 1 of 3/)).toBeTruthy());
  });
});

/**
 * @file layout.spec.tsx
 * @description The workbench on stubbed answers from the real shapes: it draws on a page, says when no device or folder exists, shows a chat from its real messages, and the sheet is a plain region.
 */
import { screen, waitFor } from '@testing-library/react';
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

function answers(over: { devices?: unknown[]; repoPaths?: string[]; chats?: unknown[] } = {}) {
  stubFetch((url) => {
    const path = url.pathname;
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

  it('has no dialog for the sheet', async () => {
    search.value = 'card=DMO-1';
    answers();
    draw();
    await waitFor(() => expect(document.querySelector('[data-card-sheet]')).toBeTruthy());
    expect(document.querySelector('[data-card-sheet]')?.tagName).toBe('SECTION');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

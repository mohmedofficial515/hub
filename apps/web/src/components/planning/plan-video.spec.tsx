/**
 * @file The plan on video (v5-live-plan, batch 4): the film with its chapters lighting phases, captions and poster from the card's attachments,
 * "Open in Hams" only with a Hams project, outdated after a new revision; the request with what leaves the machine said first, then the request
 * and the queue run it adds; the making stages from the run's film reports. No real Gemini request is ever made.
 */
import type { PlanExplainer } from '@hub/contracts';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Store from '@/components/workbench/store';
import type { PlanCard } from '@/features/cards/types';
import { renderWithApp } from '@/test/render';

import { chapterAt, explainerView, filmProgress, hamsFolderOf } from '../../features/planning/explainer';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('plan=P-1'),
  usePathname: () => '/en/demo/planning',
}));

vi.mock('@/components/workbench/store', async (original) => {
  const wb = {
    deviceName: 'Main PC',
    engine: 'ok',
    place: { device: { id: 'd1', name: 'Main PC', online: true }, folder: 'F:/web' },
    folders: ['F:/web', 'F:/tools/hams'],
  };
  return { ...(await original<typeof Store>()), useMaybeWb: () => wb, useWb: () => wb };
});

const { PlanVideo } = await import('./plan-video');

const request = {
  style: 'whiteboard',
  voice: 'google',
  googleVoice: 'Charon',
  dialect: 'egyptian',
  aspect: 'landscape',
  length: 'chapters',
  captions: true,
} as const;

const ready: PlanExplainer = {
  status: 'ready',
  request,
  revision: 2,
  requestedAt: '2026-11-20T10:00:00.000Z',
  attachmentId: 'vid',
  posterId: 'pos',
  captionsId: 'cap',
  chapters: [
    { phaseId: null, start: 0 },
    { phaseId: 'p0', start: 14.6 },
    { phaseId: 'p1', start: 32 },
  ],
  hamsProject: { id: 'plan-p1-20261120', url: 'http://127.0.0.1:4700/projects/plan-p1-20261120' },
  madeAt: '2026-11-20T10:30:00.000Z',
};

const card = (explainer: PlanExplainer | null, revision = 2, actions = ['plan.request_explainer']) =>
  ({
    key: 'P-1',
    type: 'plan',
    title: 'Video plan',
    allowedActions: actions,
    plan: {
      body: '',
      steps: [],
      phases: [
        { id: 'p0', title: 'Setup' },
        { id: 'p1', title: 'Build' },
      ],
      explainer,
      revision,
    },
  }) as unknown as PlanCard;

type Reply = (path: string, method: string, body: unknown) => unknown;
const calls: { method: string; path: string; body: unknown }[] = [];
function stub(reply: Reply) {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request =
        input instanceof Request ? input : new Request(new URL(String(input), 'http://hub.local'), init);
      const path = new URL(request.url).pathname;
      const text = request.method === 'GET' ? '' : await request.clone().text();
      const body = text ? (JSON.parse(text) as unknown) : undefined;
      calls.push({ method: request.method, path, body });
      const data = reply(path, request.method, body) ?? { data: [] };
      return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    }),
  );
}

const show = (plan: PlanCard, onSpot = vi.fn()) =>
  renderWithApp(
    <Tooltip.Provider>
      <PlanVideo card={plan} onSpot={onSpot} />
    </Tooltip.Provider>,
  );

beforeEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/en/demo/planning?plan=P-1');
});

describe('what the page shows', () => {
  it('reads the state from the plan and the queue', () => {
    const asked: PlanExplainer = {
      status: 'requested',
      request,
      revision: 2,
      requestedAt: '2026-11-20T10:00:00.000Z',
    };
    const run = (state: string, createdAt = '2026-11-20T10:00:05.000Z') =>
      ({ id: 'r', state, createdAt, chatId: 'c', source: 'explainer', cardKey: 'P-1' }) as never;
    expect(explainerView({ explainer: null, planRevision: 1, runs: [] }).state).toBe('none');
    expect(explainerView({ explainer: asked, planRevision: 2, runs: [] }).state).toBe('queued');
    expect(explainerView({ explainer: asked, planRevision: 2, runs: [run('running')] }).state).toBe('making');
    expect(explainerView({ explainer: asked, planRevision: 2, runs: [run('failed')] }).state).toBe('failed');
    // A run from before this request is not this request's.
    expect(
      explainerView({ explainer: asked, planRevision: 2, runs: [run('failed', '2026-11-19T10:00:00.000Z')] })
        .state,
    ).toBe('queued');
    expect(explainerView({ explainer: ready, planRevision: 3, runs: [] })).toMatchObject({
      state: 'ready',
      outdated: true,
    });
    expect(
      filmProgress([
        { protocol: 'film', stage: 'script', state: 'done', at: '1' },
        { protocol: 'film', stage: 'voice', state: 'started', at: '2' },
        { protocol: 'work', stage: 'plan', state: 'done', at: '3' },
      ]),
    ).toEqual({ done: 1, current: 'voice' });
    expect(chapterAt([{ start: 0 }, { start: 10 }, { start: 20 }], 15)).toBe(1);
    expect(hamsFolderOf(['F:/web', 'F:\\tools\\hams'])).toBe('F:\\tools\\hams');
    expect(hamsFolderOf(['F:/web'])).toBeNull();
  });
});

describe('the plan on video', () => {
  it('plays the film from the card’s attachments, with captions, chapters by phase and Open in Hams', async () => {
    stub(() => ({ data: { state: {}, runs: [] } }));
    const onSpot = vi.fn();
    show(card(ready), onSpot);
    const video = document.querySelector<HTMLVideoElement>('[data-pj-explainer-video]')!;
    expect(video.getAttribute('src')).toBe('/api/v1/workspaces/demo/cards/P-1/attachments/vid/file');
    expect(video.getAttribute('poster')).toBe('/api/v1/workspaces/demo/cards/P-1/attachments/pos/file');
    expect(video.querySelector('track')?.getAttribute('src')).toBe(
      '/api/v1/workspaces/demo/cards/P-1/attachments/cap/file',
    );
    const nav = screen.getByRole('navigation', { name: 'Chapters' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Introduction0:00', '0Setup0:14', '1Build0:32']);
    // A chapter playing lights its phase.
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    video.currentTime = 20;
    fireEvent.timeUpdate(video);
    expect(onSpot).toHaveBeenLastCalledWith(0);
    expect(screen.getByRole('link', { name: 'Open in Hams' }).getAttribute('href')).toBe(
      'http://127.0.0.1:4700/projects/plan-p1-20261120',
    );
    expect(document.querySelector('[data-pj-explainer-outdated]')).toBeNull();
  });

  it('says a film made for an older revision is outdated, and has no Hams link without a Hams project', () => {
    stub(() => ({ data: { state: {}, runs: [] } }));
    const { hamsProject: _hams, ...noHams } = ready;
    show(card(noHams, 3));
    expect(document.querySelector('[data-pj-explainer-outdated]')?.textContent).toContain('revision 2');
    expect(screen.queryByRole('link', { name: 'Open in Hams' })).toBeNull();
  });

  it('says what leaves the machine before it starts, then asks for the film and adds the run in Hams’ folder', async () => {
    stub((path, method) => {
      if (path.endsWith('/queue') && method === 'GET') return { data: { state: {}, runs: [] } };
      if (path.endsWith('/queue/runs'))
        return { data: { id: 'r1', state: 'running', folder: 'F:/tools/hams' } };
      return { data: {} };
    });
    show(card(null));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Hams for a video' }));
    const notice = await waitFor(() => {
      const el = document.querySelector('[data-pj-explainer-notice]');
      expect(el).toBeTruthy();
      return el!;
    });
    expect(notice.textContent).toMatch(/script.s text is sent to Google/);
    expect(notice.getAttribute('data-pj-explainer-notice')).toBe('google');
    fireEvent.click(screen.getByRole('radio', { name: /Hams local voice/ }));
    expect(document.querySelector('[data-pj-explainer-notice]')?.textContent).toContain(
      'nothing leaves your machine',
    );
    fireEvent.click(screen.getByRole('radio', { name: /Google voice/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Google voice' }), { target: { value: 'Kore' } });
    expect(
      screen.getByRole<HTMLSelectElement>('combobox', {
        name: /Hams’ folder on Main PC|Hams' folder on Main PC/,
      }).value,
    ).toBe('F:/tools/hams');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make the video' }));
    });
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/queue/runs'))).toBe(true));
    const asked = calls.find((c) => c.path.endsWith('/plans/P-1/explainer'))!;
    expect(asked.body).toMatchObject({ voice: 'google', googleVoice: 'Kore', dialect: 'egyptian' });
    const run = calls.find((c) => c.path.endsWith('/queue/runs'))!;
    expect(run.body).toMatchObject({
      source: 'explainer',
      cardKey: 'P-1',
      device: 'd1',
      folder: 'F:/tools/hams',
    });
  });

  it('shows the making stages from the run’s film reports', async () => {
    const asked: PlanExplainer = {
      status: 'requested',
      request,
      revision: 2,
      requestedAt: '2026-11-20T10:00:00.000Z',
    };
    stub((path) => {
      if (path.endsWith('/queue'))
        return {
          data: {
            state: {},
            runs: [
              {
                id: 'r1',
                source: 'explainer',
                cardKey: 'P-1',
                state: 'running',
                chatId: 'c1',
                messageId: 'm1',
                createdAt: '2026-11-20T10:00:05.000Z',
              },
            ],
          },
        };
      if (path.endsWith('/chats/c1'))
        return {
          data: {
            id: 'c1',
            messages: [
              {
                id: 'm1',
                role: 'assistant',
                stages: [
                  { protocol: 'film', stage: 'script', state: 'done', at: '1' },
                  { protocol: 'film', stage: 'voice', state: 'started', at: '2' },
                ],
              },
            ],
          },
        };
      return undefined;
    });
    show(card(asked));
    const stages = await screen.findByRole('list', { name: 'Making the video' });
    await waitFor(() =>
      expect([...stages.querySelectorAll('li')].map((li) => li.getAttribute('data-state'))).toEqual([
        'done',
        'started',
        'todo',
        'todo',
        'todo',
      ]),
    );
    expect(stages.textContent).toContain('Making the voice with Google: Charon');
  });
});

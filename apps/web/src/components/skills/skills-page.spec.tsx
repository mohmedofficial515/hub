/**
 * @file The Skills page (docs/16 §11, D64 to D66) in its states, on the API's real shapes: Hub's skills with their reach and Hub's protocols read only, the owner's personal ones
 * with Move to Hub (asked first, and renamed when Hub has the name), a pm who sees no personal skill and no write, the editor, and the two catalogs key for key.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'radix-ui';
import { describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import arSkills from '../../../messages/ar/skills.json';
import enSkills from '../../../messages/en/skills.json';
import { hubNameFor } from './move-dialog';
import { SkillsPage } from './skills-page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/demo/skills',
}));

const meAs = (roles: string[]) => ({
  id: 'u1',
  displayName: 'Owner',
  avatarColor: 'teal',
  totpEnabled: true,
  workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles }],
});

const device = (id: string, name: string, synced: boolean) => ({ id, name, online: true, synced });
const hubSkill = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  declaredName: null,
  description: `When to use ${name}`,
  source: 'hub',
  core: false,
  userInvocable: true,
  files: 1,
  hash: `hash-${name}`,
  updatedAt: '2026-11-08T10:00:00.000Z',
  devices: [device('d1', 'Main PC', true), device('d2', 'Laptop', false)],
  nameInHub: false,
  ...extra,
});
const personalSkill = (name: string, extra: Record<string, unknown> = {}) => ({
  ...hubSkill(name),
  source: 'personal',
  devices: [],
  ...extra,
});

const SKILLS = {
  hub: [hubSkill('work', { core: true }), hubSkill('tidy-repo')],
  personal: [personalSkill('daily-notes', { files: 3 }), personalSkill('suggest', { nameInHub: true })],
  personalFolder: 'C:/Users/me/.claude/skills',
  sync: {
    version: '0.1.0-sync.0123456789ab',
    mode: 'auto',
    devices: [
      {
        id: 'd1',
        name: 'Main PC',
        online: true,
        version: '0.1.0-sync.0123456789ab',
        syncedAt: '2026-11-08T10:00:00.000Z',
        error: null,
        current: true,
      },
      {
        id: 'd2',
        name: 'Laptop',
        online: false,
        version: null,
        syncedAt: null,
        error: 'Claude Code could not update the plugin',
        current: false,
      },
    ],
  },
};

function mount(roles: string[], skills: unknown = SKILLS, detail?: { status?: number; body?: unknown }) {
  const fetched = stubFetch((url, init, request) => {
    const path = url.pathname;
    const method = request?.method ?? init?.method ?? 'GET';
    if (detail && path.includes('/skills/hub/')) return detail;
    if (path.endsWith('/me')) return { body: { data: meAs(roles) } };
    if (path.endsWith('/workspaces/demo'))
      return { body: { data: { slug: 'demo', name: 'Demo', myRoles: roles } } };
    if (method === 'POST' && path.endsWith('/skills/move')) {
      return {
        status: 201,
        body: {
          data: {
            skill: { ...hubSkill('my-suggest'), body: '', otherFiles: [] },
            revisionId: null,
            syncing: 1,
          },
        },
      };
    }
    if (method === 'POST' && path.endsWith('/skills')) {
      return {
        status: 201,
        body: {
          data: { skill: { ...hubSkill('fresh'), body: 'x', otherFiles: [] }, revisionId: null, syncing: 1 },
        },
      };
    }
    if (path.endsWith('/skills')) return { body: { data: skills } };
    return undefined;
  });
  renderWithApp(
    <Tooltip.Provider>
      <div id="hub-root">
        <SkillsPage />
      </div>
    </Tooltip.Provider>,
  );
  return fetched;
}

describe('SkillsPage', () => {
  it("lists Hub's skills with their reach, marks Hub's protocols read only, and shows each device's plugin", async () => {
    mount(['owner']);
    await waitFor(() => expect(document.querySelector('[data-skill="tidy-repo"]')).toBeTruthy());
    const own = document.querySelector<HTMLElement>('[data-skill="tidy-repo"]')!;
    expect(within(own).getByText('On 1 of 2 devices')).toBeTruthy();
    expect(within(own).getByRole('button', { name: /Edit/ })).toBeTruthy();
    const core = document.querySelector<HTMLElement>('[data-skill="work"]')!;
    expect(within(core).getByText('Part of Hub')).toBeTruthy();
    expect(within(core).queryByRole('button', { name: /Edit/ })).toBeNull();
    // Owner-made skills come before Hub's protocols.
    const order = [...document.querySelectorAll('[data-skill]')].map((row) => row.getAttribute('data-skill'));
    expect(order).toEqual(['tidy-repo', 'work']);
    expect(
      document.querySelector('[data-skills-device="d1"]')?.getAttribute('data-skills-device-state'),
    ).toBe('current');
    expect(document.querySelector('[data-skills-device="d2"]')?.textContent).toContain(
      'The last sync failed',
    );
  });

  it('shows personal skills read only, with Move to Hub that asks first and offers another name on a clash', async () => {
    const user = userEvent.setup();
    const { calls } = mount(['owner']);
    await waitFor(() => expect(document.querySelector('[data-personal-skill="suggest"]')).toBeTruthy());
    expect(screen.getByText('C:/Users/me/.claude/skills')).toBeTruthy();
    const clash = document.querySelector<HTMLElement>('[data-personal-skill="suggest"]')!;
    expect(within(clash).getByText('Hub has this name')).toBeTruthy();
    await user.click(within(clash).getByRole('button', { name: /Move to Hub/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Your personal folder stays exactly as it is/)).toBeTruthy();
    expect(within(dialog).getByText(/both copies load/)).toBeTruthy();
    const name = within(dialog).getByLabelText(/Name in Hub/);
    expect(name).toHaveValue('suggest-2');
    await user.clear(name);
    await user.type(name, 'my-suggest');
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Copy into Hub' }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')).toMatchObject({
        path: '/api/v1/workspaces/demo/skills/move',
        body: { name: 'suggest', as: 'my-suggest' },
      }),
    );
  });

  it('a name that fits moves as it is, with no name field', async () => {
    const user = userEvent.setup();
    const { calls } = mount(['owner']);
    await waitFor(() => expect(document.querySelector('[data-personal-skill="daily-notes"]')).toBeTruthy());
    const row = document.querySelector<HTMLElement>('[data-personal-skill="daily-notes"]')!;
    expect(within(row).getByText('3 files')).toBeTruthy();
    await user.click(within(row).getByRole('button', { name: /Move to Hub/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText(/Name in Hub/)).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Copy into Hub' }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ name: 'daily-notes' }),
    );
  });

  it('a pm reads Hub’s skills, and sees no personal skill and no write', async () => {
    mount(['pm'], { ...SKILLS, personal: [], personalFolder: null });
    await waitFor(() => expect(document.querySelector('[data-skill="tidy-repo"]')).toBeTruthy());
    expect(document.querySelector('[data-skills-section="personal"]')).toBeNull();
    expect(document.querySelector('[data-skills-new]')).toBeNull();
    expect(document.querySelector('[data-skill-edit]')).toBeNull();
  });

  it('the editor checks the name and refuses a secret before sending, then creates', async () => {
    const user = userEvent.setup();
    const { calls } = mount(['owner']);
    await waitFor(() => expect(document.querySelector('[data-skills-new]')).toBeTruthy());
    await user.click(document.querySelector<HTMLButtonElement>('[data-skills-new]')!);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Name/), 'Bad name');
    await user.type(within(dialog).getByLabelText(/When Claude should use it/), 'Before a merge');
    await user.click(within(dialog).getByRole('button', { name: 'Create skill' }));
    expect(await within(dialog).findByText(/Use lowercase letters/)).toBeTruthy();
    const name = within(dialog).getByLabelText(/^Name/);
    await user.clear(name);
    await user.type(name, 'fresh');
    await user.type(within(dialog).getByLabelText(/Instructions/), `Use ghp_${'k'.repeat(40)}`);
    await user.click(within(dialog).getByRole('button', { name: 'Create skill' }));
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
    await user.clear(within(dialog).getByLabelText(/Instructions/));
    await user.type(within(dialog).getByLabelText(/Instructions/), 'Run the formatter.');
    await user.click(within(dialog).getByRole('button', { name: 'Create skill' }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')).toMatchObject({
        path: '/api/v1/workspaces/demo/skills',
        body: {
          name: 'fresh',
          description: 'Before a merge',
          body: 'Run the formatter.',
          userInvocable: true,
        },
      }),
    );
  });
});

describe('SkillsPage, editing (knowledge-13)', () => {
  it('previews the instructions as the skill’s page shows them', async () => {
    const user = userEvent.setup();
    mount(['owner']);
    await waitFor(() => expect(document.querySelector('[data-skills-new]')).toBeTruthy());
    await user.click(document.querySelector<HTMLButtonElement>('[data-skills-new]')!);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Preview' }));
    expect(within(dialog).getByText(/Nothing to preview yet/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Write' }));
    await user.type(within(dialog).getByLabelText(/Instructions/), '## Steps{enter}{enter}- one');
    await user.click(within(dialog).getByRole('button', { name: 'Preview' }));
    const preview = dialog.querySelector('[data-skill-preview]')!;
    expect(preview.querySelector('h5')?.textContent).toBe('Steps');
    expect(preview.querySelectorAll('li')).toHaveLength(1);
  });

  it('lets go of Edit when the text cannot be read, so it never looks stuck', async () => {
    const user = userEvent.setup();
    const { calls } = mount(['owner'], SKILLS, {
      status: 500,
      body: { error: { code: 'hub.common.internal', message: 'Boom' } },
    });
    await waitFor(() => expect(document.querySelector('[data-skill="tidy-repo"]')).toBeTruthy());
    const edit = document.querySelector<HTMLButtonElement>('[data-skill="tidy-repo"] [data-skill-edit]')!;
    await user.click(edit);
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/skills/hub/tidy-repo'))).toBe(true));
    await waitFor(() => expect(edit).not.toBeDisabled());
    expect(edit.querySelector('.animate-spin, [class*="animate-spin"]')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('hubNameFor', () => {
  it('keeps a name that fits, cleans one that does not, and finds a free one', () => {
    expect(hubNameFor('daily-notes', [])).toBe('daily-notes');
    expect(hubNameFor('Odd_Name', [])).toBe('odd-name');
    expect(hubNameFor('suggest', ['suggest', 'suggest-2'])).toBe('suggest-3');
  });
});

describe('skills.json', () => {
  const keys = (value: unknown, path = ''): string[] =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, inner]) => keys(inner, path ? `${path}.${key}` : key))
      : [path];
  const plural = /\.(zero|one|two|few|many|other)$/;

  it('holds the same keys in ar and en, and the same holes', () => {
    expect(keys(arSkills).sort()).toEqual(keys(enSkills).sort());
    const leaf = (tree: unknown, path: string) =>
      path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], tree) as string;
    const holes = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)]
        .map((m) => m[1])
        .sort()
        .join();
    const wrong = keys(enSkills).filter(
      (path) => !plural.test(path) && holes(leaf(enSkills, path)) !== holes(leaf(arSkills, path)),
    );
    expect(wrong).toEqual([]);
  });
});

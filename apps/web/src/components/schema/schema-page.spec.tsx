/**
 * @file The Database page (docs/17) against the Slice 6 review: the setup form on a direct load (B1), the page's own `/` (M9), the bars' button names (M10),
 * the dictionary's count and Show more (M11), a refused save that keeps the text and a secret that is never sent (M12), plural counts (M13) and isolated Latin
 * tokens (M14). The diagram's keyboard path needs real layout, so it is a browser spec (`e2e/specs/schema-keyboard.spec.ts`).
 */
import type { SchemaDoc, SchemaField, SchemaModel, SchemaStudioDto } from '@hub/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { SchemaPage } from './schema-page';

// The dictionary's paging with a few rows: the same rule as 600 at a time, without rendering hundreds of rows in jsdom.
vi.mock('./paging', () => ({ PAGE_ROWS: 20 }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/en/demo/schema',
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
  timezone: 'Europe/Istanbul',
  defaultLocale: 'ar',
  description: null,
  goals: null,
  links: [],
  repoPaths: ['F:/Goteav/web', 'F:/Goteav/backend'],
  status: 'active',
  closedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

const field = (name: string, over: Partial<SchemaField> = {}): SchemaField => ({
  name,
  type: 'String',
  kind: 'scalar',
  list: false,
  optional: false,
  dbName: null,
  isId: name === 'id',
  isUnique: false,
  isUpdatedAt: false,
  default: null,
  nativeType: null,
  relation: null,
  isForeignKey: false,
  attributes: [],
  doc: null,
  comment: null,
  line: 1,
  ...over,
});
const model = (name: string, fields: SchemaField[]): SchemaModel => ({
  name,
  dbName: null,
  domain: 'bookings',
  block: 'model',
  doc: null,
  comment: null,
  fields,
  indexes: [],
  attributes: [],
  line: 1,
});

function doc(columns = 2): SchemaDoc {
  const many = Array.from({ length: columns }, (_, index) => field(index === 0 ? 'id' : `c${index}`));
  return {
    provider: 'postgresql',
    domains: [
      {
        name: 'bookings',
        file: 'prisma/schema/bookings.prisma',
        header: null,
        models: ['Booking', 'Note'],
        enums: [],
      },
    ],
    models: [model('Booking', many), model('Note', [field('id'), field('text')])],
    enums: [],
    relations: [
      {
        id: 'Note.booking',
        from: 'Note',
        fromField: 'bookingId',
        to: 'Booking',
        toField: null,
        fields: ['bookingId'],
        references: ['id'],
        cardinality: 'many_to_one',
        optional: false,
        onDelete: null,
        name: null,
        implied: false,
      },
    ],
    stats: {
      domains: 1,
      models: 2,
      enums: 0,
      fields: columns + 2,
      relations: 1,
      impliedRelations: 0,
      documentedInFiles: 0,
    },
    warnings: [],
  };
}

const studio = (over: Partial<SchemaStudioDto> = {}, columns = 2): SchemaStudioDto => ({
  source: {
    id: 's1',
    name: 'backend',
    path: 'F:/Goteav/backend',
    schemaDir: 'prisma/schema',
    deviceId: null,
  },
  snapshot: {
    id: 'snap1',
    hash: 'e8e02b4d1234',
    createdAt: new Date().toISOString(),
    trigger: 'manual',
    schema: doc(columns),
    changes: null,
  },
  annotations: [],
  drafts: [],
  ...over,
});

type Extra = (path: string, method: string, body: unknown) => { status?: number; body?: unknown } | undefined;

function api(data: SchemaStudioDto, extra: Extra = () => undefined) {
  return stubFetch((url, init, request) => {
    const method = request?.method ?? init?.method ?? 'GET';
    const special = extra(url.pathname, method, init?.body);
    if (special) return special;
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me } };
    if (url.pathname.endsWith('/workspaces/demo')) return { body: { data: project } };
    if (url.pathname.endsWith('/workspaces/demo/schema') && method === 'GET') return { body: { data } };
    if (url.pathname.endsWith('/me/devices')) return { body: { data: [] } };
    return undefined;
  });
}

const show = (locale: 'en' | 'ar' = 'en') =>
  renderWithApp(
    <Tooltip.Provider>
      <SchemaPage />
    </Tooltip.Provider>,
    { locale },
  );

describe('SchemaPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    try {
      window.localStorage.clear();
    } catch {
      /* none */
    }
  });

  it('lands on a folder even when the project answers after the form (review B1)', async () => {
    const { fake } = api(studio({ source: null, snapshot: null }));
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = input instanceof Request ? input.url : String(input);
      if (/\/workspaces\/demo(\?|$)/.test(new URL(raw, 'http://hub.local').pathname + '?')) await gate;
      return fake(input, init);
    });
    show();
    const button = await screen.findByRole<HTMLButtonElement>('button', { name: 'Read the design' });
    // Before the project answers there is no folder, and the page says why the button waits.
    expect(button.disabled).toBe(true);
    expect(screen.getByText('Choose the repository folder first.')).toBeTruthy();
    release();
    await waitFor(() => expect(button.disabled).toBe(false));
    expect(screen.getByLabelText<HTMLSelectElement>('Repository folder').value).toBe('F:/Goteav/backend');
    expect(screen.queryByText('Choose the repository folder first.')).toBeNull();
  });

  it('names the bar buttons, and isolates the version in the overview (review M10, M14)', async () => {
    api(studio());
    show();
    await screen.findByRole('button', { name: /Search tables and columns/ });
    const bars = document.querySelectorAll<HTMLElement>('.schema-topbar');
    const end = within(bars[1]!);
    expect(end.getByRole('button', { name: /Search tables and columns/ })).toBeTruthy();
    expect(end.getByRole('button', { name: /Suggest Arabic names/ })).toBeTruthy();
    expect(end.getByRole('button', { name: /Refresh design/ })).toBeTruthy();
    // The panel is closed until asked for; its button opens it on the overview.
    expect(screen.queryByRole('complementary')).toBeNull();
    await userEvent.click(end.getByRole('button', { name: 'Details and overview' }));
    await screen.findByRole('complementary', { name: 'Overview' });
    const version = screen.getByText('e8e02b4d');
    expect(version.closest('bdi')?.getAttribute('dir')).toBe('ltr');
    expect(version.closest('bdi')?.textContent).toBe('e8e02b4d');
    // Its label sits outside the isolate, so it lands on the right side in Arabic.
    expect(version.closest('bdi')?.parentElement?.textContent).toBe('Version e8e02b4d');
  });

  it('says counts with their plural forms, in English and Arabic (review M13)', async () => {
    api(studio());
    const { unmount } = show();
    await userEvent.click(await screen.findByRole('button', { name: 'Details and overview' }));
    let panel = within(await screen.findByRole('complementary', { name: 'Overview' }));
    let stats = within(document.querySelector<HTMLElement>('.schema-stats')!);
    expect(stats.getByText('tables')).toBeTruthy();
    expect(stats.getByText('Relations: 1 declared · 0 implied')).toBeTruthy();
    expect(stats.getByText('no enums')).toBeTruthy();
    expect(panel.getAllByText('0%').length).toBeGreaterThan(0);
    unmount();
    api(studio());
    show('ar');
    // Arabic's dual takes no numeral.
    await userEvent.click(await screen.findByRole('button', { name: 'التفاصيل والنظرة العامة' }));
    panel = within(await screen.findByRole('complementary', { name: 'نظرة عامة' }));
    stats = within(document.querySelector<HTMLElement>('.schema-stats')!);
    expect(stats.getByText('جدولان')).toBeTruthy();
    expect(stats.getByText('العلاقات: 1 مُعلنة · 0 ضمنية')).toBeTruthy();
    expect(panel.getAllByText('0٪').length).toBeGreaterThan(0);
  });

  it('opens the page search with / on an Arabic layout, before the shell can take it (review M9)', async () => {
    api(studio());
    show();
    await screen.findByRole('button', { name: /Search tables and columns/ });
    const later = vi.fn();
    window.addEventListener('keydown', later);
    fireEvent.keyDown(document.body, { key: 'ظ', code: 'Slash' });
    expect(await screen.findByRole('dialog', { name: 'Search the design' })).toBeTruthy();
    // The shell's own listener never hears it, so the palette does not open too.
    expect(later).not.toHaveBeenCalled();
    window.removeEventListener('keydown', later);
  });

  it('shows the dictionary a page at a time, saying how many of how many (review M11)', async () => {
    api(studio({}, 30));
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Dictionary' }));
    const count = await screen.findByText('Showing 20 of 32');
    expect(count).toBeTruthy();
    expect(document.querySelectorAll('.schema-table tbody tr')).toHaveLength(20);
    await userEvent.click(screen.getByRole('button', { name: 'Show 12 more' }));
    expect(await screen.findByText('32 columns')).toBeTruthy();
    expect(document.querySelectorAll('.schema-table tbody tr')).toHaveLength(32);
  });

  it('keeps a refused Arabic name in the field and says why, and never sends a secret (review M12)', async () => {
    const { calls } = api(studio(), (path, method) =>
      path.endsWith('/schema/annotations') && method === 'PUT'
        ? {
            status: 403,
            body: { error: { code: 'hub.common.forbidden', message: 'Your roles cannot do this.' } },
          }
        : undefined,
    );
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Dictionary' }));
    const table = await screen.findByRole('table');
    await userEvent.click(within(table).getAllByRole('button', { name: /Booking/ })[1]!);
    const inspector = await screen.findByRole('complementary', { name: 'Details' });
    // Opened from the dictionary, the inspector takes focus on its heading (review B2).
    await waitFor(() => expect(document.activeElement?.hasAttribute('data-inspector-heading')).toBe(true));
    const name = within(inspector).getByLabelText('Arabic name');
    await userEvent.type(name, 'عمود أول');
    await userEvent.tab();
    expect(await within(inspector).findByText(/Not saved: Your roles cannot do this\./)).toBeTruthy();
    expect((name as HTMLInputElement).value).toBe('عمود أول');
    expect(within(inspector).getByRole('button', { name: 'Retry' })).toBeTruthy();

    const before = calls.filter((call) => call.method === 'PUT').length;
    const notes = within(inspector).getByLabelText('Team notes');
    await userEvent.type(notes, 'token ghp_abcdefghijklmnopqrstuvwxyz0123456789');
    await userEvent.tab();
    expect(await within(inspector).findByRole('alert')).toBeTruthy();
    expect(calls.filter((call) => call.method === 'PUT').length).toBe(before);
  });
});

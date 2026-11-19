/**
 * @file The doc bar on a doc's page (docs/16 §7.1): "Document this task" shows only while the open card is a task, and is left out otherwise rather than shown disabled
 * (knowledge-04). Improve and Find gaps stay either way.
 */
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Store from '@/components/workbench/store';
import { renderWithApp, stubFetch } from '@/test/render';

let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/en/demo/docs',
}));

let openCard: { key: string; type: string } | undefined;
vi.mock('@/features/cards/store', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useCard: () => openCard,
}));

const startSkill = vi.fn<(text: string, context: unknown) => void>();
vi.mock('@/components/workbench/store', async (original) => {
  const wb = { deviceName: 'Main PC', engine: 'ok' };
  return {
    ...(await original<typeof Store>()),
    useMaybeWb: () => wb,
    useWb: () => wb,
    startSkill: (text: string, context: unknown) => startSkill(text, context),
  };
});

const { DocBar } = await import('@/components/workbench/doc-bar');

function mount() {
  renderWithApp(
    <Tooltip.Provider>
      <DocBar />
    </Tooltip.Provider>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  stubFetch(() => undefined);
  startSkill.mockClear();
});

describe('DocBar, Document this task', () => {
  it('is left out when the open card is not a task', () => {
    search = 'card=DMO-7';
    openCard = { key: 'DMO-7', type: 'decision' };
    mount();
    expect(document.querySelector('[data-wb-docbar]')).toBeTruthy();
    expect(document.querySelector('[data-wb-doc-document]')).toBeNull();
    expect(document.querySelector('[data-wb-doc-gaps]')).toBeTruthy();
  });

  it('is left out when no card is open', () => {
    search = '';
    openCard = undefined;
    mount();
    expect(document.querySelector('[data-wb-doc-document]')).toBeNull();
  });

  it('shows beside an open task, enabled, and starts the protocol on it', () => {
    search = 'card=DMO-3';
    openCard = { key: 'DMO-3', type: 'task' };
    mount();
    const button = document.querySelector<HTMLButtonElement>('[data-wb-doc-document]');
    expect(button).toBeTruthy();
    expect(button).not.toBeDisabled();
    button!.click();
    expect(startSkill).toHaveBeenCalledWith('/hub:doc document DMO-3', { card: 'DMO-3' });
  });
});

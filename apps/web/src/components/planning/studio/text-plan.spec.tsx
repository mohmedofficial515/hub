/**
 * @file A plan a Plan-mode chat proposed as words only, in the Plan Studio: titled by its first line, shown as written, with Save as the one filled button.
 */
import { screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { describe, expect, it, vi } from 'vitest';

import type { Wb } from '@/components/workbench/store';
import { renderWithApp, stubFetch } from '@/test/render';

import { TextPlan } from './text-plan';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('studio=plan&chat=c1'),
  usePathname: () => '/en/demo/planning',
}));

describe('TextPlan', () => {
  it('reads the plan as written, under its first line, with Save filled', async () => {
    stubFetch(() => undefined);
    renderWithApp(
      <Tooltip.Provider>
        <TextPlan
          wb={{ engine: 'ok', deviceName: 'Desk' } as unknown as Wb}
          proposal={{ id: 'm1:plan', text: '# Hotel search\n\nFirst the supplier.', structured: null }}
          asked="Plan hotel search"
          busy={false}
          onDevelop={() => undefined}
        />
      </Tooltip.Provider>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Hotel search' })).toBeTruthy();
    expect(screen.getByText('First the supplier.')).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Save to Planning' });
    expect(save.classList.contains('btn-sheen')).toBe(true);
    expect(screen.getByRole('button', { name: 'Run this plan' })).toBeTruthy();
  });
});

/**
 * @file Decide on a decision with no options: the API cannot take it, so the sheet says why and leads to the edit form, or to who may add them.
 */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DecisionSection } from '@/components/cards/sheet-sections/decision';
import type { DecisionCard } from '@/features/cards/types';
import { renderWithApp, stubFetch } from '@/test/render';

import kit from '../../../messages/en/kit.json';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/goteav/decisions',
}));

afterEach(() => vi.unstubAllGlobals());

const option = (id: string) => ({ id, title: `Option ${id}`, pros: [], cons: [], recommended: false });

function decision(options: ReturnType<typeof option>[], allowedActions: string[]) {
  return {
    key: 'GTV-7',
    type: 'decision',
    title: 'Pick a payment provider',
    status: 'open',
    priority: 'P1',
    allowedActions,
    links: [],
    events: [],
    decision: {
      kind: 'product',
      question: 'Which provider?',
      options,
      deciderRole: 'owner',
      remindersSent: [],
      adrStatus: 'none',
    },
  } as unknown as DecisionCard;
}

const mount = (card: DecisionCard) => {
  stubFetch(() => undefined);
  renderWithApp(<DecisionSection card={card} action="decide" cancelAction={vi.fn()} perform={vi.fn()} />);
};

describe('Decide with no options', () => {
  it('says why, and leads to the edit form for whoever may add options', () => {
    mount(decision([], ['decide', 'decision.edit_options']));
    expect(screen.getByText(kit.sections.decision.noOptions).closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: kit.sections.decision.addOptions })).toBeInTheDocument();
    expect(screen.queryByText(kit.sections.decision.noOptionsAsk)).toBeNull();
  });

  it('names who may add them for everyone else', () => {
    mount(decision([], ['decide']));
    expect(screen.getByText(kit.sections.decision.noOptionsAsk)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: kit.sections.decision.addOptions })).toBeNull();
    expect(screen.getByRole('button', { name: kit.cancel })).toBeInTheDocument();
  });

  it('still opens the decide form when there are options', () => {
    mount(decision([option('a'), option('b')], ['decide']));
    expect(screen.queryByText(kit.sections.decision.noOptions)).toBeNull();
    expect(screen.getAllByRole('radio').length).toBe(2);
  });
});

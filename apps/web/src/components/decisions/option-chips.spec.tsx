/**
 * @file Every open question shows its options as compact chips, the recommended ones first and marked (owner decision 7).
 */
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DecisionCard } from '@/features/cards/types';
import { renderWithApp, stubFetch } from '@/test/render';

import decisions from '../../../messages/en/decisions.json';
import kit from '../../../messages/en/kit.json';
import { OptionChips } from './docket';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/goteav/decisions',
}));

afterEach(() => vi.unstubAllGlobals());

const option = (id: string, recommended = false) => ({
  id,
  title: `Option ${id}`,
  pros: [],
  cons: [],
  recommended,
});

const decision = (options: ReturnType<typeof option>[]) =>
  ({
    key: 'GTV-7',
    type: 'decision',
    title: 'Pick a payment provider',
    status: 'open',
    links: [],
    decision: { kind: 'product', options, deciderRole: 'owner', adrStatus: 'none' },
  }) as unknown as DecisionCard;

const mount = (card: DecisionCard) => {
  stubFetch(() => undefined);
  renderWithApp(<OptionChips card={card} />);
};

describe('OptionChips', () => {
  it('puts the recommended option first, with its mark, and counts what does not fit', () => {
    mount(decision([option('a'), option('b'), option('c', true), option('d'), option('e')]));
    const list = screen.getByRole('list', { name: '5 options' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent(`${kit.sheet.decision.recommended}: Option c`);
    expect(items[0]).toHaveAttribute('data-recommended');
    expect(items[1]).not.toHaveAttribute('data-recommended');
    expect(items).toHaveLength(4);
    expect(items[3]).toHaveTextContent('and 2 more options');
  });

  it('says so when the question has no options yet', () => {
    mount(decision([]));
    expect(screen.getByText(decisions.row.noOptions)).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

/**
 * @file Acceptance criteria never lose a line: a checklist shows its progress, and any other text reads as Markdown.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithApp } from '@/test/render';

import { Checklist, parseChecklist } from './shared';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/ar/demo/tasks',
}));

describe('parseChecklist', () => {
  it('reads every list marker and an upper-case X', () => {
    expect(parseChecklist('* [ ] a\n+ [X] b\n1. [x] c').items).toEqual([
      { done: false, text: 'a' },
      { done: true, text: 'b' },
      { done: true, text: 'c' },
    ]);
  });
});

describe('Checklist', () => {
  it('shows plain bullets, as an import writes them', () => {
    renderWithApp(<Checklist markdown={'- أ\n- ب'} />, { locale: 'ar' });
    expect(screen.getByText('أ')).toBeTruthy();
    expect(screen.getByText('ب')).toBeTruthy();
  });

  it('counts what is done', () => {
    renderWithApp(<Checklist markdown={'- [x] أ\n- [ ] ب'} />, { locale: 'ar' });
    expect(screen.getByText('1 من 2')).toBeTruthy();
    expect(screen.getByText(/لم يتم بعد/)).toBeTruthy();
  });

  it('keeps a free paragraph beside a checklist line', () => {
    renderWithApp(<Checklist markdown={'- [ ] أ\n\nفقرة حرة'} />, { locale: 'ar' });
    expect(screen.getByText('أ')).toBeTruthy();
    expect(screen.getByText('فقرة حرة')).toBeTruthy();
    expect(screen.getByText('0 من 1')).toBeTruthy();
  });

  it('draws no checkbox a screen reader would offer to toggle', () => {
    const { container } = renderWithApp(<Checklist markdown={'- [x] أ\n- [ ] ب'} />, { locale: 'ar' });
    expect(container.querySelector('input')).toBeNull();
  });
});

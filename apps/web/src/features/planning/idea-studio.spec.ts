/**
 * @file Accept from the Idea Studio: the way back from an idea to its session, and an idea deleted since that is accepted anew rather than failing.
 */
import type { ProposedIdea } from '@hub/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HubError } from '@/lib/api/errors';

const createCard = vi.fn<(...args: unknown[]) => unknown>();
const saveIdea = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../cards/store', () => ({ createCard: (...args: unknown[]) => createCard(...args) }));
vi.mock('./queries', () => ({ saveIdea: (...args: unknown[]) => saveIdea(...args) }));
vi.mock('@/lib/api/client', () => ({ get: async () => [], patch: async () => undefined }));
vi.mock('@/components/shell/router', () => ({
  currentRoute: () => ({ ws: 'demo' }),
  useRoute: () => ({ ws: 'demo' }),
}));

const { acceptIdea, studioChatOfIdea } = await import('./idea-studio');

const idea = {
  title: 'Weekly digest',
  summary: 'What moved.',
  verdict: 'new',
  overlap: 0,
  matches: [],
  findings: [],
  suggestions: [],
  steps: [],
  risks: [],
  questions: [],
  sources: [],
} as unknown as ProposedIdea;

beforeEach(() => {
  createCard.mockReset();
  saveIdea.mockReset();
  window.localStorage.clear();
});

describe('acceptIdea', () => {
  it('remembers which session an idea came from', async () => {
    createCard.mockResolvedValueOnce({ key: 'I-1' });
    await acceptIdea(idea, 'm1', 'c1');
    expect(studioChatOfIdea('I-1')).toBe('c1');
    expect(studioChatOfIdea('I-404')).toBeNull();
  });

  it('accepts a refined report as a new idea when the first was deleted', async () => {
    createCard.mockResolvedValueOnce({ key: 'I-2' });
    await acceptIdea(idea, 'm2', 'c2');
    saveIdea.mockRejectedValueOnce(new HubError({ code: 'hub.cards.not_found', status: 404 }));
    createCard.mockResolvedValueOnce({ key: 'I-3' });
    expect(await acceptIdea(idea, 'm3', 'c2')).toEqual({ key: 'I-3', updated: false });
    expect(studioChatOfIdea('I-2')).toBeNull();
    expect(studioChatOfIdea('I-3')).toBe('c2');
  });

  it('names its chat and report on the card, and writes nothing to localStorage (owner decision 9c)', async () => {
    const chat = '019a6b52-6d1e-7c3a-9d1f-3a2b4c5d6e7f';
    const report = '019a6b52-7000-7c3a-9d1f-3a2b4c5d6e7f';
    createCard.mockResolvedValueOnce({ key: 'I-4' });
    await acceptIdea(idea, report, chat);
    expect(createCard.mock.calls[0]?.[0]).toMatchObject({
      detail: { sourceChatId: chat, sourceMessageId: report },
    });
    expect(window.localStorage.getItem('hub:idea-studio:accepted')).toBeNull();
    expect(studioChatOfIdea('I-4')).toBe(chat);
  });
});

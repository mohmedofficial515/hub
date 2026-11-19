/**
 * @file Save from the Plan Studio: one plan per session whatever fails on the way, steps that keep their tasks when the plan is brought up to date, and a
 * plan deleted since that is saved anew rather than failing for ever. Also the words a session starts with.
 */
import type { ProposedPlan } from '@hub/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HubError } from '@/lib/api/errors';

const savePlan = vi.fn<(...args: unknown[]) => unknown>();
const turnIntoPlan = vi.fn<(...args: unknown[]) => unknown>();
const createCard = vi.fn<(...args: unknown[]) => unknown>();
const getCard = vi.fn<(...args: unknown[]) => unknown>();
const get = vi.fn<(...args: unknown[]) => unknown>();

vi.mock('./queries', () => ({
  savePlan: (...args: unknown[]) => savePlan(...args),
  turnIntoPlan: (...args: unknown[]) => turnIntoPlan(...args),
}));
vi.mock('../cards/store', () => ({
  createCard: (...args: unknown[]) => createCard(...args),
  getCard: (...args: unknown[]) => getCard(...args),
}));
vi.mock('@/lib/api/client', () => ({ get: (...args: unknown[]) => get(...args) }));
vi.mock('@/components/shell/router', () => ({ currentRoute: () => ({ ws: 'demo' }) }));

const { carrySteps, fitStepTitle, planIdeaKey, planWords, savePlanFromStudio, studioChatOfPlan } =
  await import('./plan-studio');

const plan: ProposedPlan = {
  title: 'Hotels',
  steps: [{ title: 'Sign the supplier', role: 'pm' }, { title: 'Ship it' }],
};

let n = 0;
const ids = () => {
  n += 1;
  return { message: `m${n}`, chat: `c${n}` };
};

const gone = () => new HubError({ code: 'hub.cards.not_found', status: 404, message: 'Not found' });

beforeEach(() => {
  for (const fn of [savePlan, turnIntoPlan, createCard, getCard, get]) fn.mockReset();
  window.localStorage.clear();
});

describe('savePlanFromStudio', () => {
  it('saves the steps of a plan made from an idea again, never a second plan, when they failed the first time', async () => {
    const { message, chat } = ids();
    turnIntoPlan.mockResolvedValueOnce('P-1');
    savePlan.mockRejectedValueOnce(new Error('network'));
    await expect(savePlanFromStudio(plan, message, chat, 'I-1')).rejects.toThrow('network');

    getCard.mockReturnValue({ type: 'plan', plan: { steps: [] } });
    savePlan.mockResolvedValueOnce(undefined);
    const again = await savePlanFromStudio(plan, message, chat, 'I-1');
    expect(again.key).toBe('P-1');
    expect(turnIntoPlan).toHaveBeenCalledTimes(1);
    expect(createCard).not.toHaveBeenCalled();
    expect(studioChatOfPlan('P-1')).toBe(chat);
  });

  it('brings a saved plan up to date with each unchanged step keeping its id and its task', async () => {
    const first = ids();
    createCard.mockResolvedValueOnce({ key: 'P-2' });
    await savePlanFromStudio(plan, first.message, first.chat, null);

    getCard.mockReturnValue({
      type: 'plan',
      plan: {
        steps: [
          { id: 's1', title: 'Sign the supplier', taskKey: 'T-1', done: true },
          { id: 's2', title: 'Ship it', done: false },
        ],
      },
    });
    savePlan.mockResolvedValueOnce(undefined);
    const refined: ProposedPlan = { ...plan, steps: [...plan.steps, { title: 'Tell the team' }] };
    const result = await savePlanFromStudio(refined, 'm-refined', first.chat, null);
    expect(result).toEqual({ key: 'P-2', updated: true });
    const steps = (savePlan.mock.calls[0]?.[1] as { steps: { id?: string; taskKey?: string }[] }).steps;
    expect(steps[0]).toMatchObject({ id: 's1', taskKey: 'T-1', done: true });
    expect(steps[1]).toMatchObject({ id: 's2' });
    expect(steps[2]?.id).toBeUndefined();
  });

  it('saves a new plan when the one this session saved was deleted', async () => {
    const first = ids();
    createCard.mockResolvedValueOnce({ key: 'P-3' });
    await savePlanFromStudio(plan, first.message, first.chat, null);

    getCard.mockReturnValue(undefined);
    get.mockRejectedValueOnce(gone());
    createCard.mockResolvedValueOnce({ key: 'P-4' });
    const result = await savePlanFromStudio(plan, 'm-after', first.chat, null);
    expect(result).toEqual({ key: 'P-4', updated: false });
    expect(studioChatOfPlan('P-3')).toBeNull();
    expect(studioChatOfPlan('P-4')).toBe(first.chat);
  });
});

describe('carrySteps', () => {
  it('uses each saved step once, by its title as a card holds it', () => {
    const out = carrySteps(
      [
        { id: 'a', title: 'Same', done: false },
        { id: 'b', title: 'Same', done: true, taskKey: 'T-2' },
      ],
      [
        { title: 'Same', done: false },
        { title: 'Same', done: false },
        { title: 'Same', done: false },
      ],
    );
    expect(out.map((s) => s.id)).toEqual(['a', 'b', undefined]);
    expect(out[1]).toMatchObject({ taskKey: 'T-2', done: true });
  });
});

describe('the words a session starts with', () => {
  it('reads the idea’s key apart from the owner’s words, and an idea alone leaves no words', () => {
    expect(planWords('/hub:plan GTV-12 make it fast')).toBe('make it fast');
    expect(planWords('/hub:plan GTV-12')).toBe('');
    expect(planWords('/hub:plan a topic')).toBe('a topic');
    expect(planIdeaKey('/hub:plan GTV-12')).toBe('GTV-12');
    expect(planIdeaKey('/hub:plan a topic')).toBeNull();
  });

  it('cuts a long step title at a clause, with an ellipsis, and leaves a short one alone', () => {
    expect(fitStepTitle('  Short   one ')).toBe('Short one');
    const long = `${'word '.repeat(30)}, and then more words that go on`;
    const cut = fitStepTitle(long, 60);
    expect(cut.length).toBeLessThanOrEqual(60);
    expect(cut.endsWith('…')).toBe(true);
  });
});

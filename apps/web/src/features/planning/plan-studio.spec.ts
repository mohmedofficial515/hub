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

const { carrySteps, fitStepTitle, planIdeaKey, planSteps, planWords, savePlanFromStudio, studioChatOfPlan } =
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
    // A new step gets an id the plan has never used, so `after` can name it.
    expect(steps[2]?.id).toBe('s3');
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

describe('the studio chat on the card (owner decision 9c)', () => {
  const CHAT = '019a6b52-6d1e-7c3a-9d1f-3a2b4c5d6e7f';
  const REPLY = '019a6b52-7000-7c3a-9d1f-3a2b4c5d6e7f';

  it('a save names its chat and reply on the card, and writes nothing to localStorage', async () => {
    get.mockResolvedValueOnce([]);
    createCard.mockResolvedValueOnce({ key: 'P-10' });
    await savePlanFromStudio(plan, REPLY, CHAT, null);
    expect(get).toHaveBeenCalledWith('workspaces/demo/plans', { sourceChat: CHAT, limit: 1 });
    expect(createCard.mock.calls[0]?.[0]).toMatchObject({
      detail: { sourceChatId: CHAT, sourceMessageId: REPLY },
    });
    expect(window.localStorage.getItem('hub:plan-studio:saved')).toBeNull();
    expect(studioChatOfPlan('P-10')).toBe(CHAT);
  });

  it('a plan another browser saved from this chat is brought up to date, never made twice', async () => {
    const chat = '019a6b52-6d1e-7c3a-9d1f-3a2b4c5d6e81';
    get.mockResolvedValueOnce([{ key: 'P-11', detail: { sourceChatId: chat, sourceMessageId: null } }]);
    getCard.mockReturnValue({ type: 'plan', plan: { steps: [] } });
    savePlan.mockResolvedValueOnce(undefined);
    const reply = '019a6b52-7000-7c3a-9d1f-3a2b4c5d6e81';
    expect(await savePlanFromStudio(plan, reply, chat, null)).toEqual({ key: 'P-11', updated: true });
    expect(createCard).not.toHaveBeenCalled();
    expect(savePlan.mock.calls[0]?.[1]).toMatchObject({ sourceMessageId: reply });
  });

  it('reads an older version’s localStorage record, without writing it', async () => {
    window.localStorage.setItem(
      'hub:plan-studio:saved',
      JSON.stringify({ 'chat:c-old': 'P-12', 'm-old': 'P-12' }),
    );
    expect(studioChatOfPlan('P-12')).toBe('c-old');
    expect(await savePlanFromStudio(plan, 'm-old', 'c-old', null)).toEqual({ key: 'P-12', updated: false });
    expect(window.localStorage.getItem('hub:plan-studio:saved')).toBe(
      JSON.stringify({ 'chat:c-old': 'P-12', 'm-old': 'P-12' }),
    );
    // The card's own field wins over any record.
    expect(studioChatOfPlan('P-12', CHAT)).toBe(CHAT);
  });
});

describe('planSteps (owner decision 9a)', () => {
  it('keeps each step’s reason, size and acceptance, and turns after from step numbers into ids', () => {
    const steps = planSteps({
      title: 'Hotels',
      steps: [
        { title: 'Sign', size: 'S', why: ' The contract first. ' },
        {
          title: 'Build',
          role: 'backend',
          size: 'L',
          after: [1, 1, 3],
          acceptance: ' The e2e suite passes. ',
        },
      ],
    });
    expect(steps).toEqual([
      { id: 's1', title: 'Sign', done: false, size: 'S', why: 'The contract first.' },
      {
        id: 's2',
        title: 'Build',
        done: false,
        role: 'backend',
        size: 'L',
        after: ['s1'],
        acceptance: 'The e2e suite passes.',
      },
    ]);
  });

  it('a refined plan keeps the saved ids, and its new steps take unused ones', () => {
    const steps = planSteps(
      { title: 'Hotels', steps: [{ title: 'New first' }, { title: 'Sign', after: [1] }] },
      [{ id: 's1', title: 'Sign', taskKey: 'T-1', done: true }],
    );
    expect(steps.map((s) => [s.id, s.after ?? null])).toEqual([
      ['s2', null],
      ['s1', ['s2']],
    ]);
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

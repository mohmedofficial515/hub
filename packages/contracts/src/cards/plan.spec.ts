/**
 * @file The plan and idea schemas: a step's details (why, size, after, acceptance) and the studio chat a card came from.
 * @description Owner decision 9a and 9c (2026-11-19): the studio saves these as data, so no page parses them out of the plan's text.
 */
import { describe, expect, it } from 'vitest';

import { createIdeaSchema, ideaToPlanSchema, updateIdeaSchema } from './idea';
import { createPlanSchema, planStepInputSchema, planStepSchema, updatePlanSchema } from './plan';

const CHAT = '019a6b52-6d1e-7c3a-9d1f-3a2b4c5d6e7f';

describe('planStepSchema', () => {
  it('keeps why, size, after and acceptance', () => {
    const step = planStepSchema.parse({
      id: 's2',
      title: 'Write the migration',
      why: 'The column must exist before the API writes it.',
      size: 'M',
      after: ['s1'],
      acceptance: 'The e2e suite runs the migration on a fresh database.',
    });
    expect(step).toMatchObject({ size: 'M', after: ['s1'], done: false });
  });

  it('a step with none of them is still a step', () => {
    expect(planStepSchema.parse({ id: 's1', title: 'Plan' })).toEqual({
      id: 's1',
      title: 'Plan',
      done: false,
    });
  });

  it('refuses a size that is not S, M or L', () => {
    expect(planStepSchema.safeParse({ id: 's1', title: 'Plan', size: 'XL' }).success).toBe(false);
  });

  it('refuses an empty id in after, and too many of them', () => {
    expect(planStepInputSchema.safeParse({ title: 'Plan', after: [''] }).success).toBe(false);
    const many = Array.from({ length: 51 }, (_, i) => `s${i}`);
    expect(planStepInputSchema.safeParse({ title: 'Plan', after: many }).success).toBe(false);
  });
});

describe('the studio chat a card came from', () => {
  it('a plan and an idea take sourceChatId and sourceMessageId when created', () => {
    const plan = createPlanSchema.parse({
      title: 'Plan',
      detail: { steps: [], sourceChatId: CHAT, sourceMessageId: CHAT },
    });
    expect(plan.detail).toMatchObject({ sourceChatId: CHAT, sourceMessageId: CHAT });
    const idea = createIdeaSchema.parse({ title: 'Idea', detail: { sourceChatId: CHAT } });
    expect(idea.detail.sourceChatId).toBe(CHAT);
  });

  it('an update and Turn into a plan carry them too', () => {
    expect(updatePlanSchema.parse({ sourceMessageId: CHAT }).sourceMessageId).toBe(CHAT);
    expect(updateIdeaSchema.parse({ sourceChatId: CHAT, sourceMessageId: CHAT }).sourceChatId).toBe(CHAT);
    expect(ideaToPlanSchema.parse({ sourceChatId: CHAT }).sourceChatId).toBe(CHAT);
  });

  it('refuses an id that is not a chat id', () => {
    expect(createIdeaSchema.safeParse({ title: 'Idea', detail: { sourceChatId: 'c1' } }).success).toBe(false);
  });
});

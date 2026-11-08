/**
 * @file Suggestions with AI (docs/16 §11, D66): `/hub:suggest` reads the project through Hub's read tools and proposes tasks, plans or skills with `propose_suggestions`.
 * @description A proposal is stored on the turn and creates nothing. The owner accepts or dismisses each one in the panel, and Accept goes through the normal create path in the web session:
 * a task or plan through `CardService.apply`, a skill through the Skills page's own create. A model can propose; only the owner's press makes anything.
 */
import { z } from 'zod';

import { cardKeySchema, effortSchema, prioritySchema, titleSchema } from './cards/card';
import { roleSchema, specialtySchema } from './roles';
import { SKILL_LIMITS, skillNameSchema } from './skills';

export const SUGGESTION_KINDS = ['task', 'plan', 'skill'] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

const why = z.string().trim().min(1).max(1_000);
const body = z.string().max(20_000);

export const proposedSuggestionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('task'),
    title: titleSchema,
    /** Why this, why now: the project facts it rests on, with card keys. */
    why,
    body: body.optional(),
    priority: prioritySchema.optional(),
    ownerRole: roleSchema.optional(),
    specialty: specialtySchema.optional(),
    effort: effortSchema.optional(),
    /** Cards it relates to, for the owner to check. They are named, never linked by themselves. */
    related: z.array(cardKeySchema).max(10).optional(),
  }),
  z.object({
    kind: z.literal('plan'),
    title: titleSchema,
    why,
    body: body.optional(),
    steps: z
      .array(z.object({ title: titleSchema, role: roleSchema.optional() }))
      .min(1)
      .max(30),
    related: z.array(cardKeySchema).max(10).optional(),
  }),
  z.object({
    kind: z.literal('skill'),
    /** A Hub skill's folder, as `/hub:<name>`. */
    name: skillNameSchema,
    description: z.string().trim().min(1).max(SKILL_LIMITS.description),
    why,
    /** The skill's Markdown, shown in full before the owner accepts. */
    body: z.string().min(1).max(SKILL_LIMITS.body),
  }),
]);
export type ProposedSuggestion = z.infer<typeof proposedSuggestionSchema>;

export const proposeSuggestionsSchema = z.object({
  /** One or two sentences on what was read and what stands out. */
  summary: z.string().trim().max(2_000).optional(),
  items: z.array(proposedSuggestionSchema).min(1).max(10),
});
export type ProposeSuggestionsInput = z.infer<typeof proposeSuggestionsSchema>;

export const SUGGESTION_STATES = ['open', 'accepted', 'dismissed'] as const;
export type SuggestionState = (typeof SUGGESTION_STATES)[number];

export const chatSuggestionSchema = z.object({
  id: z.string(),
  state: z.enum(SUGGESTION_STATES),
  /** What Accept made: a card key, or a skill's name. */
  ref: z.string().nullable(),
  answeredAt: z.string().nullable(),
  proposal: proposedSuggestionSchema,
});
export type ChatSuggestionDto = z.infer<typeof chatSuggestionSchema>;

export const chatSuggestionsSchema = z.object({
  summary: z.string().nullable(),
  items: z.array(chatSuggestionSchema),
});
export type ChatSuggestionsDto = z.infer<typeof chatSuggestionsSchema>;

/** At most this many on one turn: a second call adds to the first. */
export const SUGGESTIONS_PER_TURN = 20;

export const answerSuggestionSchema = z.object({ decision: z.enum(['accept', 'dismiss']) });
export type AnswerSuggestionInput = z.infer<typeof answerSuggestionSchema>;

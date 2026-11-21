/**
 * @file Task: status machine and create payload.
 * @description Machine from docs/01 §4.1 with the moves docs/04 §3.8 and §3.10 add
 * (backlog and ready both ways, in_review back to in_progress, claim from backlog, complete from claimed).
 */
import { z } from 'zod';

import { roleSchema, specialtySchema } from '../roles';
import { bodySchema, createLinksSchema, effortSchema, prioritySchema, tagsSchema, titleSchema } from './card';
import { defineMachine } from './machine';

export const TASK_STATUSES = [
  'backlog',
  'ready',
  'claimed',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_MACHINE = defineMachine<TaskStatus>({
  statuses: TASK_STATUSES,
  initial: 'backlog',
  terminal: ['done', 'cancelled'],
  transitions: {
    mark_ready: { from: ['backlog'], to: 'ready' },
    mark_backlog: { from: ['ready'], to: 'backlog' },
    claim: { from: ['backlog', 'ready'], to: 'claimed' },
    unclaim: { from: ['claimed', 'in_progress'], to: 'ready' },
    start: { from: ['claimed'], to: 'in_progress' },
    submit_review: { from: ['in_progress'], to: 'in_review' },
    resume: { from: ['in_review'], to: 'in_progress' },
    complete: { from: ['claimed', 'in_progress', 'in_review'], to: 'done' },
    cancel: { from: ['backlog', 'ready', 'claimed', 'in_progress', 'in_review'], to: 'cancelled' },
    reopen: { from: ['done', 'cancelled'], to: 'ready' },
    // A port task follows its redesign: marking the redesign ported closes the task from wherever it is.
    close_as_ported: { from: ['backlog', 'ready', 'claimed', 'in_progress', 'in_review'], to: 'done' },
  },
});

export const TASK_ORIGINS = [
  'manual',
  'import_suggestion',
  'session_followup',
  'redesign_port',
  'decision',
  'handoff',
  'plan',
] as const;

export const createTaskSchema = z.object({
  title: titleSchema,
  body: bodySchema.optional(),
  priority: prioritySchema.optional(),
  ownerRole: roleSchema.optional(),
  dueAt: z.iso.datetime().optional(),
  tags: tagsSchema.optional(),
  module: z.string().max(40).optional(),
  repo: z.string().max(80).optional(),
  links: createLinksSchema.optional(),
  detail: z.object({
    specialty: specialtySchema,
    effort: effortSchema.optional(),
    acceptance: bodySchema.optional(),
    prompt: bodySchema.optional(),
    origin: z.enum(TASK_ORIGINS).optional(),
  }),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const claimTaskSchema = z.object({ branch: z.string().max(200).optional() });
export type ClaimTaskInput = z.infer<typeof claimTaskSchema>;

export const submitTaskSchema = z.object({
  prUrl: z.url().max(500).optional(),
  note: z.string().max(2000).optional(),
});
export type SubmitTaskInput = z.infer<typeof submitTaskSchema>;

export const completeTaskSchema = z.object({ note: z.string().max(2000).optional() });
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;

export const editTaskDetailSchema = z.object({
  specialty: specialtySchema.optional(),
  effort: effortSchema.nullable().optional(),
  acceptance: bodySchema.nullable().optional(),
  prompt: bodySchema.nullable().optional(),
  branch: z.string().max(200).nullable().optional(),
  prUrl: z.url().max(500).nullable().optional(),
});
export type EditTaskDetailInput = z.infer<typeof editTaskDetailSchema>;

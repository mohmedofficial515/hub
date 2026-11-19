'use client';

/**
 * @file plan-studio.ts
 * @description The Plan Studio's logic, apart from its page: which chat is a plan studio chat, the plan its latest reply proposed, and Save, which makes the
 * plan a card (or turns the idea it started from into one) and, after a refinement, brings the same plan up to date rather than making a second.
 */
import {
  CARD_LIMITS,
  type ChatFullDto,
  type PlanStepInput,
  planToMarkdown,
  type PlanWords,
  type ProposedPlan,
} from '@hub/contracts';
import { useMemo, useSyncExternalStore } from 'react';

import type { PlanningMessages } from '@/components/planning/messages';
import { currentRoute } from '@/components/shell/router';
import { get } from '@/lib/api/client';
import { isHubError } from '@/lib/api/errors';
import { kitMessages, useT } from '@/lib/i18n';

import { type CardFullDto, toHubCard } from '../cards/map';
import { createCard, getCard } from '../cards/store';
import type { PlanStep, Role } from '../cards/types';
import { savePlan, turnIntoPlan } from './queries';

/** The studio sends Hub's own planning skill, so the same plan comes from the page, the panel or a terminal. */
export const PLAN_COMMAND = '/hub:plan';

/** The prompt: the topic, and the idea it starts from when there is one, named by its key so the skill reads it first. */
export function planPrompt(text: string, ideaKey?: string | null) {
  const words = text.trim();
  return `${PLAN_COMMAND} ${ideaKey ? `${ideaKey} ` : ''}${words}`.trim();
}

/** The owner's words, without the command (and without the idea's key, which the page shows as a chip). An idea named alone leaves no words. */
export const planWords = (content: string) => {
  const rest = content.startsWith(PLAN_COMMAND) ? content.slice(PLAN_COMMAND.length).trim() : content.trim();
  return rest.replace(/^[A-Z]{2,6}-\d{1,7}(\s+|$)/, '');
};

/** The idea key the session started from, if its first words name one. */
export const planIdeaKey = (content: string) => {
  const rest = content.startsWith(PLAN_COMMAND) ? content.slice(PLAN_COMMAND.length).trim() : '';
  return /^([A-Z]{2,6}-\d{1,7})\b/.exec(rest)?.[1] ?? null;
};

/** A chat the Plan Studio shows: its first message is the planning command. */
export function isPlanStudioChat(chat: Pick<ChatFullDto, 'messages'> | null | undefined): boolean {
  const first = chat?.messages.find((m) => m.role === 'user');
  return !!first && first.content.trimStart().startsWith(PLAN_COMMAND);
}

export interface FoundPlan {
  plan: ProposedPlan;
  messageId: string;
}

/** The latest structured plan in the chat, and the message that holds it. */
export function latestPlan(chat: ChatFullDto | null | undefined): FoundPlan | null {
  if (!chat) return null;
  for (let i = chat.messages.length - 1; i >= 0; i -= 1) {
    const m = chat.messages[i];
    if (m?.structuredPlan) return { plan: m.structuredPlan, messageId: m.id };
  }
  return null;
}

/** Who does how much: the plan's steps counted by role, the busiest first. Steps with no role are counted apart. */
export function rolesOf(plan: ProposedPlan): { role: string | null; steps: number }[] {
  const counts = new Map<string | null, number>();
  for (const s of plan.steps) {
    const role = s.role && ROLES.has(s.role) ? s.role : null;
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([role, steps]) => ({ role, steps }))
    .sort((a, b) => b.steps - a.steps || (a.role === null ? 1 : b.role === null ? -1 : 0));
}

/** The plan's weight in points: S is 1, M is 3, L is 8. A step with no size is left out, and the page says how many have one. */
export function effortOf(plan: ProposedPlan): { points: number; sized: number } {
  const weight = { S: 1, M: 3, L: 8 } as const;
  let points = 0;
  let sized = 0;
  for (const s of plan.steps) {
    if (!s.size) continue;
    points += weight[s.size];
    sized += 1;
  }
  return { points, sized };
}

// ── Saved plans: which studio chat became which plan, kept across reloads in this browser ────────────

const STORE_KEY = 'hub:plan-studio:saved';
const listeners = new Set<() => void>();
let version = 0;
const memory = new Map<string, string>();

function readAll(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

const recall = (id: string) => memory.get(id) ?? (typeof window === 'undefined' ? undefined : readAll()[id]);

function remember(entries: Record<string, string>) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify({ ...readAll(), ...entries }));
  } catch {
    // Blocked storage: the page still works, it only forgets after a reload.
  }
  for (const [id, key] of Object.entries(entries)) memory.set(id, key);
  version += 1;
  for (const fn of listeners) fn();
}

/** Forgets a plan that is gone (deleted since it was saved): every record that points at it, so the next Save makes a new one. */
function forget(key: string) {
  const all = readAll();
  for (const [id, value] of Object.entries(all)) if (value === key) delete all[id];
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    // Blocked storage: memory is what the page reads anyway.
  }
  for (const [id, value] of [...memory]) if (value === key) memory.delete(id);
  version += 1;
  for (const fn of listeners) fn();
}

/** The studio chat a plan was saved from, if this browser saved it: the way back to its full report. */
export function studioChatOfPlan(key: string): string | null {
  for (const [id, value] of memory) if (value === key && id.startsWith('chat:')) return id.slice(5);
  for (const [id, value] of Object.entries(readAll()))
    if (value === key && id.startsWith('chat:')) return id.slice(5);
  return null;
}

/** A card the API no longer has: deleted, or never in this project. */
export const isGone = (error: unknown) =>
  isHubError(error) && (error.status === 404 || error.code.endsWith('not_found'));

/** The plan a studio chat became, and whether it holds the plan on the page. */
export function useSavedPlan(
  chatId: string,
  messageId: string | null | undefined,
): { key: string | null; current: boolean } {
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
    () => 0,
  );
  const byMessage = messageId ? recall(messageId) : undefined;
  return { key: recall(`chat:${chatId}`) ?? byMessage ?? null, current: !!byMessage };
}

/**
 * The plan a proposed plan became, by the message that proposed it, saved here or from Claude's panel: one record for both, so the same plan is never saved
 * twice from two places.
 */
export function useSavedMessagePlan(messageId: string | null | undefined): string | null {
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
    () => 0,
  );
  return messageId ? (recall(messageId) ?? null) : null;
}
export const savedMessagePlan = (messageId: string) => recall(messageId) ?? null;
export const markMessagePlan = (messageId: string, key: string) => remember({ [messageId]: key });

/** A saved plan's text: the plan in the reader's words, without its title, which is the card's own. */
export const planBody = (plan: ProposedPlan, words?: PlanWords) =>
  planToMarkdown(plan, words)
    .replace(/^# .*\n+/, '')
    .slice(0, CARD_LIMITS.planBody);

const ROLES = new Set<string>(['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa']);
const cap = (text: string) => text.trim().slice(0, CARD_LIMITS.title);

/**
 * A step's title as a plan card holds it (200 characters). A longer one ends at its last clause that fits, with an ellipsis, never inside a word: the
 * whole step is still in the plan's text.
 */
export function fitStepTitle(text: string, max: number = CARD_LIMITS.title): string {
  const whole = text.trim().replace(/\s+/g, ' ');
  if (whole.length <= max) return whole;
  const room = whole.slice(0, max - 1);
  const clause = Math.max(
    ...['،', ',', '؛', ';', '. ', ':', ' —', ' (', '('].map((m) => room.lastIndexOf(m)),
  );
  const space = room.lastIndexOf(' ');
  const end = clause >= max / 2 ? clause : space >= max / 2 ? space : room.length;
  return `${room
    .slice(0, end)
    .trim()
    .replace(/[\s،,؛;:—(-]+$/, '')}…`;
}

/** The words a saved plan's text is written in: the page's language, with Hub's role names. */
export function usePlanWords(): PlanWords {
  const words = useT<PlanningMessages>('planning').planText;
  const roles = useT(kitMessages).roles;
  return useMemo(() => ({ ...words, roles }), [words, roles]);
}

const stepsOf = (plan: ProposedPlan): PlanStepInput[] =>
  plan.steps.map((s) => ({
    title: fitStepTitle(s.title),
    done: false,
    ...(s.role && ROLES.has(s.role) ? { role: s.role as Role } : {}),
  }));

/**
 * The refined plan's steps, keeping what the saved plan's steps already are: a step with the same title as one already saved is that step, with its id
 * and its task, so updating a plan never cuts a step off its task or makes Create tasks make it twice. Each saved step is used once, first come first.
 */
export function carrySteps(existing: readonly PlanStep[], next: readonly PlanStepInput[]): PlanStepInput[] {
  const used = new Set<string>();
  return next.map((step) => {
    const title = fitStepTitle(step.title);
    const same = existing.find((s) => !used.has(s.id) && fitStepTitle(s.title) === title);
    if (!same) return step;
    used.add(same.id);
    return { ...step, id: same.id, ...(same.taskKey ? { taskKey: same.taskKey } : {}), done: same.done };
  });
}

/** A saved plan's steps as the API has them now. */
async function savedSteps(key: string): Promise<PlanStep[]> {
  const known = getCard(key);
  if (known && 'plan' in known && known.type === 'plan') return known.plan.steps;
  const { ws } = currentRoute();
  const card = toHubCard(await get<CardFullDto>(`workspaces/${ws}/cards/${key}`));
  return card.type === 'plan' ? card.plan.steps : [];
}

/**
 * Save: the plan becomes a draft plan card with its steps, and its whole text (goal, approach, steps with their reasons, checks, risks, sources) as the body.
 * A session that started from an idea turns that idea into this plan, so the two stay linked. A session saved before and refined since rewrites the same
 * plan's text and steps.
 */
export async function savePlanFromStudio(
  plan: ProposedPlan,
  messageId: string,
  chatId: string,
  ideaKey: string | null,
  words?: PlanWords,
): Promise<{ key: string; updated: boolean }> {
  const known = recall(messageId);
  if (known) return { key: known, updated: false };
  // The plan's own name: a card key at its start is the idea it came from, which the link already says.
  const title = cap(plan.title.replace(/^[A-Z]{2,6}-\d{1,7}\s*[:—–-]?\s*/, '') || plan.title);
  const body = planBody(plan, words);
  const existing = recall(`chat:${chatId}`);
  if (existing) {
    try {
      const steps = carrySteps(await savedSteps(existing), stepsOf(plan));
      await savePlan(existing, { title, body, steps });
      remember({ [messageId]: existing });
      return { key: existing, updated: true };
    } catch (error) {
      // The saved plan was deleted since: this session saves a new one instead of failing every time.
      if (!isGone(error)) throw error;
      forget(existing);
    }
  }
  let key: string | undefined;
  if (ideaKey) {
    // An idea that cannot become a plan any more (it already did, or it was closed) still gets its link: the plan is made apart and relates to it.
    key = await turnIntoPlan(ideaKey, { title, body }).catch(() => undefined);
    if (key) {
      // Recorded before its steps are written: if that fails, Save again updates this plan rather than making a second one.
      remember({ [`chat:${chatId}`]: key });
      await savePlan(key, { steps: stepsOf(plan) });
    }
  }
  if (!key) {
    const base = { type: 'plan' as const, title, body, detail: { steps: stepsOf(plan) } };
    const card = ideaKey
      ? await createCard({ ...base, links: [{ kind: 'relates', key: ideaKey }] }).catch(() =>
          createCard(base),
        )
      : await createCard(base);
    key = card.key;
  }
  remember({ [messageId]: key, [`chat:${chatId}`]: key });
  return { key, updated: false };
}

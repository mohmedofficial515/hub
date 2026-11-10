'use client';

/**
 * @file plan-studio.ts
 * @description The Plan Studio's logic, apart from its page: which chat is a plan studio chat, the plan its latest reply proposed, and Save, which makes the
 * plan a card (or turns the idea it started from into one) and, after a refinement, brings the same plan up to date rather than making a second.
 */
import { CARD_LIMITS, type ChatFullDto, planToMarkdown, type ProposedPlan } from '@hub/contracts';
import { useSyncExternalStore } from 'react';

import { createCard } from '../cards/store';
import type { Role } from '../cards/types';
import { savePlan, turnIntoPlan } from './queries';

/** The studio sends Hub's own planning skill, so the same plan comes from the page, the panel or a terminal. */
export const PLAN_COMMAND = '/hub:plan';

/** The prompt: the topic, and the idea it starts from when there is one, named by its key so the skill reads it first. */
export function planPrompt(text: string, ideaKey?: string | null) {
  const words = text.trim();
  return `${PLAN_COMMAND} ${ideaKey ? `${ideaKey} ` : ''}${words}`.trim();
}

/** The owner's words, without the command (and without the idea's key, which the page shows as a chip). */
export const planWords = (content: string) => {
  const rest = content.startsWith(PLAN_COMMAND) ? content.slice(PLAN_COMMAND.length).trim() : content.trim();
  return rest.replace(/^[A-Z]{2,6}-\d{1,7}\s+/, '');
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

const ROLES = new Set<string>(['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa']);
const cap = (text: string) => text.trim().slice(0, CARD_LIMITS.title);

const stepsOf = (plan: ProposedPlan) =>
  plan.steps.map((s) => ({
    title: cap(s.title),
    done: false,
    ...(s.role && ROLES.has(s.role) ? { role: s.role as Role } : {}),
  }));

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
): Promise<{ key: string; updated: boolean }> {
  const known = recall(messageId);
  if (known) return { key: known, updated: false };
  const title = cap(plan.title);
  const body = planToMarkdown(plan).slice(0, CARD_LIMITS.planBody);
  const existing = recall(`chat:${chatId}`);
  if (existing) {
    await savePlan(existing, { title, body, steps: stepsOf(plan) });
    remember({ [messageId]: existing });
    return { key: existing, updated: true };
  }
  let key: string | undefined;
  if (ideaKey) {
    // An idea that cannot become a plan any more (it already did, or it was closed) still gets its link: the plan is made apart and relates to it.
    key = await turnIntoPlan(ideaKey, { title, body }).catch(() => undefined);
    if (key) await savePlan(key, { steps: stepsOf(plan) });
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

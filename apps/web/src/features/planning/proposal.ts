'use client';

/**
 * @file proposal.ts
 * @description A plan Claude proposed in a chat, before it is a card: saving it to Planning, and which proposals are saved already. The chat's plan card and
 * Planning's live draft page both save through here, so a proposal saved in one shows as saved in the other.
 */
import { CARD_LIMITS, planToMarkdown, type ProposedPlan } from '@hub/contracts';
import { useSyncExternalStore } from 'react';

import { createCard } from '../cards/store';
import type { Role } from '../cards/types';

export interface PlanProposal {
  /** The thread item's id: `<messageId>:plan`. */
  id: string;
  text: string;
  structured: ProposedPlan | null;
}

const ROLES = new Set<string>(['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa']);
const cap = (text: string) => text.trim().slice(0, CARD_LIMITS.title);

/** The title a proposal gets: its own, or the first line of its text. */
export function proposalTitle(proposal: PlanProposal, fallback: string) {
  if (proposal.structured) return cap(proposal.structured.title);
  const first =
    proposal.text
      .split('\n')
      .find((line) => line.trim())
      ?.replace(/^#+\s*/, '') ?? '';
  return cap(first) || fallback;
}

// ── Saved proposals: one answer for every place that shows the same proposal ──────────────────────

const saved = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function markSaved(id: string, key: string) {
  saved.set(id, key);
  version += 1;
  for (const fn of listeners) fn();
}

/** The plan card a proposal became, once saved in this tab. */
export function useSavedProposal(id: string | null | undefined): string | null {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  return id ? (saved.get(id) ?? null) : null;
}

/**
 * Save to Planning: a draft plan card through the same create path as New plan. The steps keep their titles and a role Hub knows; the whole proposal, with each
 * step's reason, the checks and the risks, is the plan's text. A plan that came only as words is saved as its text, titled by its first line.
 */
export async function saveProposal(proposal: PlanProposal, fallbackTitle: string): Promise<string> {
  const known = saved.get(proposal.id);
  if (known) return known;
  const { structured } = proposal;
  const card = await createCard(
    structured
      ? {
          type: 'plan',
          title: proposalTitle(proposal, fallbackTitle),
          body: planToMarkdown(structured),
          detail: {
            steps: structured.steps.map((s) => ({
              title: cap(s.title),
              ...(s.role && ROLES.has(s.role) ? { role: s.role as Role } : {}),
            })),
          },
        }
      : {
          type: 'plan',
          title: proposalTitle(proposal, fallbackTitle),
          body: proposal.text,
          detail: { steps: [] },
        },
  );
  markSaved(proposal.id, card.key);
  return card.key;
}

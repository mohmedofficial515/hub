'use client';

/**
 * @file proposal.ts
 * @description A plan Claude proposed in a chat, before it is a card: saving it to Planning, and which proposals are saved already. The chat's plan card and
 * Planning's live draft page both save through here, so a proposal saved in one shows as saved in the other.
 */
import { CARD_LIMITS, type PlanWords, type ProposedPlan } from '@hub/contracts';

import { createCard } from '../cards/store';
import type { Role } from '../cards/types';
import {
  fitStepTitle,
  markMessagePlan,
  planBody,
  savedMessagePlan,
  useSavedMessagePlan,
} from './plan-studio';

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

// ── Saved proposals: one answer for every place that shows the same proposal, the Plan Studio included ─────

const messageOf = (id: string) => id.replace(/:plan$/, '');

/** The plan card a proposal became, once saved here, on Planning's live draft page or in the Plan Studio. */
export function useSavedProposal(id: string | null | undefined): string | null {
  return useSavedMessagePlan(id ? messageOf(id) : null);
}

/**
 * Save to Planning: a draft plan card through the same create path as New plan. The steps keep their titles and a role Hub knows; the whole proposal, with each
 * step's reason, the checks and the risks, is the plan's text. A plan that came only as words is saved as its text, titled by its first line.
 */
export async function saveProposal(
  proposal: PlanProposal,
  fallbackTitle: string,
  words?: PlanWords,
): Promise<string> {
  const known = savedMessagePlan(messageOf(proposal.id));
  if (known) return known;
  const { structured } = proposal;
  const card = await createCard(
    structured
      ? {
          type: 'plan',
          title: proposalTitle(proposal, fallbackTitle),
          body: planBody(structured, words),
          detail: {
            steps: structured.steps.map((s) => ({
              title: fitStepTitle(s.title),
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
  markMessagePlan(messageOf(proposal.id), card.key);
  return card.key;
}

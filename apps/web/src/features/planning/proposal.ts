'use client';

/**
 * @file proposal.ts
 * @description A plan Claude proposed in a chat, before it is a card: saving it to Planning, and which proposals are saved already. The chat's plan card and
 * Planning's live draft page both save through here, so a proposal saved in one shows as saved in the other.
 */
import { CARD_LIMITS, type PlanWords, type ProposedPlan } from '@hub/contracts';

import { createCard } from '../cards/store';
import { markMessagePlan, planBody, planSteps, savedMessagePlan, useSavedMessagePlan } from './plan-studio';
import { sourceFields } from './studio-source';

export interface PlanProposal {
  /** The thread item's id: `<messageId>:plan`. */
  id: string;
  text: string;
  structured: ProposedPlan | null;
}

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
 * Save to Planning: a draft plan card through the same create path as New plan. The steps keep their titles, a role Hub knows, their reason, size and the
 * steps before them (owner decision 9a); the whole proposal, with the checks and the risks, is the plan's text. The card names the reply it came from, and
 * its chat when the caller knows it, so every browser shows the proposal as saved (owner decision 9c). A plan that came only as words is saved as its text,
 * titled by its first line.
 */
export async function saveProposal(
  proposal: PlanProposal,
  fallbackTitle: string,
  words?: PlanWords,
  chatId: string | null = null,
): Promise<string> {
  const messageId = messageOf(proposal.id);
  const known = await savedMessagePlan(messageId);
  if (known) return known;
  const { structured } = proposal;
  const source = sourceFields(chatId, messageId);
  const card = await createCard(
    structured
      ? {
          type: 'plan',
          title: proposalTitle(proposal, fallbackTitle),
          body: planBody(structured, words),
          detail: { steps: planSteps(structured), ...source },
        }
      : {
          type: 'plan',
          title: proposalTitle(proposal, fallbackTitle),
          body: proposal.text,
          detail: { steps: [], ...source },
        },
  );
  markMessagePlan(messageId, card.key, chatId);
  return card.key;
}

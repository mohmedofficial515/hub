/**
 * @file Suggested prompts (docs/16 §7.1): a pure function of the page and the open card. No model call and no invented data.
 * @description The card's real next steps come from `actionsFor`, the one rule for what a card offers. Words are the web's, by `id`, in `apps/web/messages/{ar,en}/chat.json`; a web test holds the two together.
 */
import { type ActionableCard, actionsFor } from './cards/actions';
import type { ChatMode } from './chat';
import type { Role } from './roles';

/** One per entry under `suggestions` in the web's `chat.json`. `key` fills `{key}`. */
export const CHAT_SUGGESTION_IDS = [
  'explain_card',
  'plan_card',
  'work_card',
  'decide_card',
  'deliver_card',
  'review_card',
  'apply_card',
  'redesign_card',
  'improve_doc',
  'document_card',
  'find_doc_gaps',
  'whats_next',
  'summarize_today',
  'plan_topic',
  'find_docs',
] as const;
export type ChatSuggestionId = (typeof CHAT_SUGGESTION_IDS)[number];

export interface ChatSuggestion {
  readonly id: ChatSuggestionId;
  readonly key?: string;
  /** The Hub skill it starts, for the panel's tooltip. */
  readonly skill?: 'hub:work' | 'hub:doc';
  /** The mode this prompt needs. Ask cannot run a command, so a prompt that does has `execute`. */
  readonly mode: ChatMode;
  /**
   * What pressing it does (D51). `fill` puts the words in the composer and sends nothing. `run` sends them. A `run` in `execute` must say so before it happens: its words are `suggestions.<id>.runs`.
   */
  readonly onPress: 'fill' | 'run';
}

export interface SuggestionInput {
  readonly page: string | null;
  readonly card: (ActionableCard & { readonly key: string }) | null;
  readonly roles: readonly Role[];
  readonly memberId: string | null;
}

const MAX = 4;
const START_VERBS = ['claim', 'start', 'resume'];
const REVIEW_VERBS = ['approve', 'request_changes', 'verify'];

function forCard(card: NonNullable<SuggestionInput['card']>, input: SuggestionInput): ChatSuggestion[] {
  const { key } = card;
  const verbs = new Set(
    actionsFor(card, input.roles, input.memberId)
      .filter((action) => action.enabled)
      .map((action) => action.action),
  );
  const list: ChatSuggestion[] = [];
  if (card.type === 'decision' && verbs.has('decide')) {
    list.push({ id: 'decide_card', key, mode: 'ask', onPress: 'run' });
  }
  if (card.type === 'need' && verbs.has('deliver')) {
    list.push({ id: 'deliver_card', key, mode: 'ask', onPress: 'run' });
  }
  if (card.type === 'handoff' && verbs.has('apply')) {
    list.push({ id: 'apply_card', key, mode: 'execute', onPress: 'fill' });
  }
  if (card.type === 'redesign') list.push({ id: 'redesign_card', key, mode: 'ask', onPress: 'run' });
  if (card.type === 'task' && START_VERBS.some((verb) => verbs.has(verb))) {
    list.push({ id: 'work_card', key, skill: 'hub:work', mode: 'execute', onPress: 'run' });
  }
  // Ask has no terminal, so a review that runs the checks needs Execute, and it waits for the owner to send it (review M10).
  if (card.type === 'task' && REVIEW_VERBS.some((verb) => verbs.has(verb))) {
    list.push({ id: 'review_card', key, mode: 'execute', onPress: 'fill' });
  }
  if (card.type === 'doc') {
    list.push(
      { id: 'improve_doc', key, skill: 'hub:doc', mode: 'execute', onPress: 'run' },
      { id: 'find_doc_gaps', key, skill: 'hub:doc', mode: 'ask', onPress: 'run' },
    );
  } else {
    if (card.type === 'task' || card.type === 'plan') {
      list.push({ id: 'document_card', key, skill: 'hub:doc', mode: 'execute', onPress: 'run' });
    }
    if (card.type === 'task' || card.type === 'idea' || card.type === 'need') {
      list.push({ id: 'plan_card', key, mode: 'plan', onPress: 'run' });
    }
  }
  list.push({ id: 'explain_card', key, mode: 'ask', onPress: 'run' });
  return list;
}

const WHATS_NEXT: ChatSuggestion = { id: 'whats_next', mode: 'ask', onPress: 'run' };
/** Unfinished words: both wait for the owner to finish them. */
const PLAN_TOPIC: ChatSuggestion = { id: 'plan_topic', mode: 'plan', onPress: 'fill' };
const FIND_DOCS: ChatSuggestion = { id: 'find_docs', mode: 'ask', onPress: 'fill' };
const FIND_GAPS: ChatSuggestion = { id: 'find_doc_gaps', skill: 'hub:doc', mode: 'ask', onPress: 'run' };
const SUM_UP: ChatSuggestion = { id: 'summarize_today', mode: 'ask', onPress: 'run' };

function forPage(page: string | null): ChatSuggestion[] {
  if (page === 'docs') return [FIND_DOCS, FIND_GAPS, WHATS_NEXT];
  if (page === 'planning' || page === 'plans' || page === 'ideas') return [PLAN_TOPIC, WHATS_NEXT];
  if (page === 'today') return [SUM_UP, WHATS_NEXT];
  return [WHATS_NEXT, PLAN_TOPIC];
}

/** The open card first, since that is what the owner is looking at. A deleted card offers only the page's. */
export function suggestedPrompts(input: SuggestionInput): ChatSuggestion[] {
  const card = input.card && !input.card.archivedAt ? forCard(input.card, input) : [];
  const page = forPage(input.page).filter((item) => !card.some((other) => other.id === item.id));
  return [...card, ...page].slice(0, MAX);
}

'use client';

/**
 * @file live.ts
 * @description What Planning reads from the chat beside it: whether Claude is working on a card right now, and the plan a chat in Plan mode is writing.
 * Nothing here polls: the chat's own live stream already rereads it, and a card Claude saves rereads through the cards' stream.
 */
import type { ChatContext } from '@hub/contracts';

import {
  activeChatId,
  chatIsBusy,
  revealChat,
  send,
  startSkill,
  useMaybeWb,
} from '@/components/workbench/store';
import { runningMessage } from '@/features/chat/live';
import { followTargetOf } from '@/features/chat/thread-items';
import { isStudioChat } from '@/features/planning/idea-studio';
import type { PlanProposal } from '@/features/planning/proposal';

/** True while the open chat's running turn is on this card: it named it in a Hub step, made it, or was asked about it. */
export function useClaudeOn(key: string | null | undefined): boolean {
  const chat = useMaybeWb()?.chat;
  if (!key || !chat || !chatIsBusy(chat.status)) return false;
  if (followTargetOf(runningMessage(chat.raw)) === key) return true;
  const asked = [...chat.raw.messages].reverse().find((m) => m.role === 'user');
  return asked?.context?.card === key;
}

export interface LiveDraft {
  chatId: string;
  /** A turn in Plan mode is running now. */
  writing: boolean;
  /** What the running turn has written so far. */
  text: string;
  /** The plan the last reply proposed, once it has. */
  proposal: PlanProposal | null;
  /** The running or last reply, to tell one draft from the next. */
  messageId: string | null;
}

/**
 * The plan the open chat is writing in Plan mode, or the one its last reply proposed. Null when there is neither. Its page is the Plan Studio on that
 * chat, which `isPlanStudioChat` (widened 2026-11-19) recognises from the proposal.
 */
export function useLiveDraft(): LiveDraft | null {
  const chat = useMaybeWb()?.chat;
  // The Idea Studio's chat runs in Plan too, and its page is the studio, not the plan draft.
  if (!chat || isStudioChat(chat.raw)) return null;
  const busy = chatIsBusy(chat.status);
  const running = busy ? runningMessage(chat.raw) : null;
  const last = [...chat.raw.messages].reverse().find((m) => m.role === 'assistant') ?? null;
  const proposal: PlanProposal | null = last?.plan
    ? { id: `${last.id}:plan`, text: last.plan, structured: last.structuredPlan ?? null }
    : null;
  const writing = busy && chat.mode === 'plan';
  if (!writing && !proposal) return null;
  return {
    chatId: chat.id,
    writing,
    text: running?.content ?? '',
    proposal,
    messageId: running?.id ?? last?.id ?? null,
  };
}

/** Sends at once, in a new chat, and brings the panel forward to show it, as Suggest does. */
export async function sendAndShow(text: string, mode: 'ask' | 'plan' | 'execute', context: ChatContext) {
  const sent = await send({ text, mode, fresh: true, context });
  const id = activeChatId();
  if (sent && id) revealChat(id);
  return sent;
}

/** `/hub:work` on a task, in Execute, shown in the panel. */
export async function workOn(taskKey: string) {
  const sent = await startSkill(`/hub:work ${taskKey}`, { card: taskKey });
  const id = activeChatId();
  if (sent && id) revealChat(id);
  return sent;
}

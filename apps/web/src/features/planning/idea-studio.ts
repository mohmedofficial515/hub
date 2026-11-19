'use client';

/**
 * @file idea-studio.ts
 * @description The Idea Studio's logic, apart from its page: which chat is a studio chat, what the running research has done so far (read from the chat's
 * own steps, never guessed), and Accept, which saves the report as an idea card through the same create path as everywhere else.
 */
import {
  CARD_KEY_PATTERN,
  type ChatFullDto,
  type ChatMessageDto,
  type ChatStepDto,
  ideaCardKeys,
  ideaToMarkdown,
  type IdeaWords,
  type ProposedIdea,
} from '@hub/contracts';
import { useMemo } from 'react';

import type { PlanningMessages } from '@/components/planning/messages';
import { kitMessages, useT } from '@/lib/i18n';

import { createCard } from '../cards/store';
import { isGone } from './plan-studio';
import { saveIdea } from './queries';
import { projectPath } from './studio-acts';
import {
  findSaved,
  forgetKey,
  knownChatOf,
  knownMessage,
  rememberSave,
  sourceFields,
  useStudioSource,
} from './studio-source';

/** What the studio sends: Hub's own skill, so the same research runs from the page, the panel or a terminal. */
export const IDEA_COMMAND = '/hub:idea';

export const ideaPrompt = (text: string) => `${IDEA_COMMAND} ${text.trim()}`;

/** The words the owner wrote, without the command. */
export const ideaWords = (content: string) =>
  content.startsWith(IDEA_COMMAND) ? content.slice(IDEA_COMMAND.length).trim() : content.trim();

/** A chat the studio started: its first message is the idea command. */
export function isStudioChat(chat: Pick<ChatFullDto, 'messages'> | null | undefined): boolean {
  const first = chat?.messages.find((m) => m.role === 'user');
  return !!first && first.content.trimStart().startsWith(IDEA_COMMAND);
}

/** The latest report in the chat, and the message that holds it. */
export function latestIdea(
  chat: ChatFullDto | null | undefined,
): { idea: ProposedIdea; messageId: string } | null {
  if (!chat) return null;
  for (let i = chat.messages.length - 1; i >= 0; i -= 1) {
    const m = chat.messages[i];
    if (m?.idea) return { idea: m.idea, messageId: m.id };
  }
  return null;
}

// ── Research: what the running turn has done, from its steps ─────────────────────────────────────

export const RESEARCH_STAGES = ['understand', 'hub', 'code', 'web', 'report'] as const;
export type ResearchStage = (typeof RESEARCH_STAGES)[number];

export interface ResearchAct {
  id: string;
  stage: Exclude<ResearchStage, 'understand'>;
  /** What it looked at: a search, a path, a URL or a Hub tool's subject. */
  subject: string;
  tool: string;
  running: boolean;
  failed: boolean;
}

const str = (value: unknown) => (typeof value === 'string' ? value : '');

function stageOf(name: string): ResearchAct['stage'] | null {
  if (name === 'mcp__hub__propose_idea' || name === 'mcp__hub__propose_plan') return 'report';
  if (name.startsWith('mcp__hub__')) return 'hub';
  if (name === 'WebSearch' || name === 'WebFetch') return 'web';
  if (name === 'Grep' || name === 'Glob' || name === 'Read' || name === 'LS') return 'code';
  return null;
}

function subjectOf(step: ChatStepDto): string {
  const input = (step.input ?? {}) as Record<string, unknown>;
  switch (step.name) {
    case 'WebSearch':
      return str(input.query);
    case 'WebFetch':
      return str(input.url);
    case 'Grep':
      return str(input.pattern);
    case 'Glob':
      return str(input.pattern);
    case 'Read':
      return str(input.file_path).replace(/\\/g, '/').split('/').slice(-3).join('/');
    default: {
      const tool = step.name.replace(/^mcp__hub__/, '');
      const about = str(input.query) || str(input.key) || str(input.q) || str(input.path) || str(input.title);
      return about ? `${tool} · ${about}` : tool;
    }
  }
}

/** Each research step of a message, in order, with what it looked at. Steps that are not research (a question, a stage report) are left out. */
export function researchActs(message: ChatMessageDto | null | undefined): ResearchAct[] {
  if (!message) return [];
  return message.steps.flatMap((step) => {
    const stage = stageOf(step.name);
    if (!stage || step.name === 'mcp__hub__report_stage') return [];
    return [
      {
        id: step.id,
        stage,
        subject: subjectOf(step).slice(0, 160),
        tool: step.name.replace(/^mcp__hub__/, ''),
        running: step.status === 'running' || step.status === 'waiting',
        failed: step.status === 'error',
      },
    ];
  });
}

export type StageState = 'waiting' | 'active' | 'done' | 'skipped';

/**
 * Where the research stands, stage by stage. While it runs, the stage of the latest step is active, a stage it has stepped in is done, and one it has not
 * reached yet waits. Once it ends, a stage it never stepped in is skipped: the page says so rather than showing it as done.
 */
export function researchProgress(
  acts: readonly ResearchAct[],
  { running, reported }: { running: boolean; reported: boolean },
): Record<ResearchStage, StageState> {
  const seen = new Set<ResearchStage>(acts.map((a) => a.stage));
  if (reported) seen.add('report');
  const current: ResearchStage | null = running && !reported ? (acts.at(-1)?.stage ?? 'understand') : null;
  const out = {} as Record<ResearchStage, StageState>;
  for (const stage of RESEARCH_STAGES) {
    if (stage === current) out[stage] = 'active';
    else if (stage === 'understand') out[stage] = 'done';
    else if (seen.has(stage)) out[stage] = 'done';
    else out[stage] = running && !reported ? 'waiting' : 'skipped';
  }
  return out;
}

// ── Accepted reports: which chat became which idea. The idea card says so itself (studio-source.ts) ───────────

/** The studio chat an idea came from: the card's own field first, then what this tab or an older version of this browser knew. */
export function studioChatOfIdea(key: string, sourceChatId?: string | null): string | null {
  return sourceChatId ?? knownChatOf('idea', key);
}

export interface AcceptedIdea {
  /** The idea card this studio chat became, if it was accepted. */
  key: string | null;
  /** The card holds this very report. False when the report was refined after Accept, so the card can be brought up to date. */
  current: boolean;
}

/** The idea a studio chat became, and whether it holds the report on the page. Any browser sees it, because the idea names its chat. */
export function useAcceptedIdea(chatId: string, messageId: string | null | undefined): AcceptedIdea {
  const source = useStudioSource('idea', chatId);
  const byMessage = messageId ? knownMessage('idea', messageId) : null;
  const key = source?.key ?? byMessage ?? null;
  const current = !!messageId && key !== null && (byMessage === key || source?.messageId === messageId);
  return { key, current };
}

const ROLES = new Set(['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa']);

/** The words an accepted idea's text is written in: the page's language, from the studio's own labels. */
export function useIdeaWords(): IdeaWords {
  const w = useT<PlanningMessages>('planning').studio;
  const roles = useT(kitMessages).roles;
  return useMemo(
    () => ({
      verdict: w.verdict,
      overlap: w.overlapLine,
      value: w.sections.value,
      exists: w.sections.matches,
      research: w.sections.findings,
      suggestions: w.sections.suggestions,
      flow: w.sections.diagram,
      draftPlan: w.sections.steps,
      risks: w.sections.risks,
      questions: w.sections.questions,
      sources: w.sections.sources,
      recommended: w.deck.recommended,
      kinds: w.suggestionKinds,
      roles,
    }),
    [w, roles],
  );
}

function cardFields(idea: ProposedIdea, words?: IdeaWords) {
  const role = idea.steps.find((s) => s.role && ROLES.has(s.role))?.role;
  return {
    title: idea.title.slice(0, 200),
    // A file is named inside its project, as the page shows it, never by this machine's drive.
    body: ideaToMarkdown(
      {
        ...idea,
        matches: idea.matches.map((m) => (m.kind === 'code' ? { ...m, ref: projectPath(m.ref) } : m)),
      },
      words,
    ),
    detail: {
      ...(idea.problem ? { problem: idea.problem } : {}),
      ...(idea.value ? { notes: idea.value } : {}),
      ...(role ? { role } : {}),
    },
  };
}

/**
 * Accept: the report becomes an idea card. Its text is the whole report, the problem is the idea's problem, and each Hub card it matched is linked as
 * `relates`. A link the API refuses (a card since deleted) does not lose the idea: it is saved again without links. A chat that was accepted before and
 * refined since updates the same card, so one studio session is one idea, never two.
 */
export async function acceptIdea(
  idea: ProposedIdea,
  messageId: string,
  chatId: string,
  words?: IdeaWords,
): Promise<{ key: string; updated: boolean }> {
  const known = knownMessage('idea', messageId);
  if (known) return { key: known, updated: false };
  const { title, body, detail } = cardFields(idea, words);
  // The card names the chat and the report it holds, so every browser sees this session as accepted (owner decision 9c).
  const source = sourceFields(chatId, messageId);
  const existing = await findSaved('idea', chatId);
  if (existing?.messageId === messageId) {
    rememberSave('idea', existing.key, chatId, messageId);
    return { key: existing.key, updated: false };
  }
  if (existing) {
    try {
      await saveIdea(existing.key, {
        title,
        body,
        ...(detail.problem ? { problem: detail.problem } : {}),
        ...(detail.notes ? { notes: detail.notes } : {}),
        ...source,
      });
      rememberSave('idea', existing.key, chatId, messageId);
      return { key: existing.key, updated: true };
    } catch (error) {
      // The accepted idea was deleted since: this report becomes a new idea rather than failing every time.
      if (!isGone(error)) throw error;
      forgetKey('idea', existing.key);
    }
  }
  const base = { type: 'idea' as const, title, body, detail: { ...detail, ...source } };
  const links = ideaCardKeys(idea, CARD_KEY_PATTERN).map((key) => ({ kind: 'relates' as const, key }));
  let card: { key: string };
  try {
    card = await createCard(links.length ? { ...base, links } : base);
  } catch (error) {
    if (!links.length) throw error;
    card = await createCard(base);
  }
  rememberSave('idea', card.key, chatId, messageId);
  return { key: card.key, updated: false };
}

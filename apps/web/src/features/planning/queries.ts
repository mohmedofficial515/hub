'use client';

/**
 * @file queries.ts
 * @description The Planning page's data and writes, on the Idea and Plan routes (docs/15 §4). Rows sit under `qk.cardList` and revisions under
 * `qk.card`, so the live stream refreshes both.
 */
import type { PlanRevision, UpdateIdeaInput, UpdatePlanInput } from '@hub/contracts';
import { useQuery } from '@tanstack/react-query';

import { currentRoute, useRoute } from '@/components/shell/router';
import { get, patch, post } from '@/lib/api/client';

import { qk } from '../cards/keys';
import { type CardFullDto, toHubCard } from '../cards/map';
import { fetchDetailRows } from '../cards/rows';
import { writeCard } from '../cards/store';
import type { HubCard, IdeaCard, PlanCard } from '../cards/types';
import { mergeSteps } from './model';

export function useIdeasQuery() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.cardList(ws, { view: 'ideas' }),
    enabled: !!ws,
    queryFn: () => fetchDetailRows<CardFullDto, IdeaCard>(`workspaces/${ws}/ideas`, {}),
  });
}

export function usePlansQuery() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.cardList(ws, { view: 'plans' }),
    enabled: !!ws,
    queryFn: () => fetchDetailRows<CardFullDto, PlanCard>(`workspaces/${ws}/plans`, {}),
  });
}

export function usePlanRevisions(key: string, enabled: boolean) {
  const { ws } = useRoute();
  return useQuery({
    queryKey: [...qk.card(ws, key), 'revisions'] as const,
    enabled: enabled && !!ws,
    queryFn: () => get<PlanRevision[]>(`workspaces/${ws}/plans/${key}/revisions`),
  });
}

export function saveIdea(key: string, input: UpdateIdeaInput) {
  const { ws } = currentRoute();
  const { title, body, priority, tags, problem, notes, role, sourceChatId, sourceMessageId } = input;
  return writeCard(
    {
      key,
      fields: {
        ...(title ? { title } : {}),
        ...(body !== undefined ? { body: body ?? undefined } : {}),
        ...(priority ? { priority } : {}),
        ...(tags ? { tags } : {}),
        ...(role !== undefined ? { ownerRole: role } : {}),
      },
      card: (card) =>
        card.type === 'idea'
          ? {
              ...card,
              idea: {
                ...card.idea,
                ...(problem !== undefined ? { problem: problem ?? undefined } : {}),
                ...(notes !== undefined ? { notes: notes ?? undefined } : {}),
                ...(role !== undefined ? { role: role ?? undefined } : {}),
                ...(sourceChatId ? { sourceChatId } : {}),
                ...(sourceMessageId ? { sourceMessageId } : {}),
              },
            }
          : card,
    },
    () => patch(`workspaces/${ws}/ideas/${key}`, input),
    ws,
  );
}

export function savePlan(key: string, input: UpdatePlanInput) {
  const { ws } = currentRoute();
  const { title, body, priority, tags, steps, sourceChatId, sourceMessageId } = input;
  return writeCard(
    {
      key,
      fields: {
        ...(title ? { title } : {}),
        ...(body !== undefined ? { body } : {}),
        ...(priority ? { priority } : {}),
        ...(tags ? { tags } : {}),
      },
      card: (card) =>
        card.type === 'plan'
          ? {
              ...card,
              plan: {
                ...card.plan,
                ...(steps ? { steps: mergeSteps(card.plan.steps, steps) } : {}),
                ...(sourceChatId ? { sourceChatId } : {}),
                ...(sourceMessageId ? { sourceMessageId } : {}),
              },
            }
          : card,
    },
    () => patch(`workspaces/${ws}/plans/${key}`, input),
    ws,
  );
}

export function restoreRevision(key: string, revision: number) {
  const { ws } = currentRoute();
  return writeCard({ key }, () => post(`workspaces/${ws}/plans/${key}/restore`, { revision }), ws);
}

/** "Turn into a plan": moves the idea to accepted and answers with the new plan's key, read from the link the API made. */
export async function turnIntoPlan(
  key: string,
  input: { title?: string; body?: string; sourceChatId?: string; sourceMessageId?: string },
) {
  const { ws } = currentRoute();
  const written = await writeCard({ key, fields: { status: 'accepted' } }, () =>
    post<CardFullDto>(`workspaces/${ws}/ideas/${key}/to-plan`, input),
  );
  return toHubCard(written).links.find((l) => l.card?.type === 'plan')?.key;
}

/** The plan an idea became, or the idea a plan came from. */
export const linkedOfType = (card: HubCard, type: 'idea' | 'plan') =>
  card.links.find((l) => l.card?.type === type);

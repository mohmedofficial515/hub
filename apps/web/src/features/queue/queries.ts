'use client';

/**
 * @file queries.ts
 * @description The agent queue's hooks (docs/16 §9). `LiveProvider` rereads `qk.queue` on `queue.changed` and on `chat.changed`, so every view of the queue is live with no code of its own.
 * A refused write throws `HubError`: `hub.queue.wrong_state`, `hub.queue.card_not_runnable`, `hub.chats.folder_not_allowed`, `hub.devices.not_found`.
 */
import type {
  AgentRunDto,
  ChatTurnStarted,
  CreateRunInput,
  QueueDto,
  QueueSettingsInput,
  QueueStateDto,
  RunMode,
  RunWhen,
} from '@hub/contracts';
import { localDateOf, localInstant } from '@hub/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { get, patch, post } from '@/lib/api/client';

function useQueueBase() {
  const { ws } = useRoute();
  const client = useQueryClient();
  const base = `workspaces/${ws}/queue`;
  const reread = () => void client.invalidateQueries({ queryKey: qk.queue(ws) });
  return { ws, base, reread, client };
}

/** This project's runs and the member's limits. `card` narrows it to one card's runs. `enabled: false` reads nothing (a page with no device to run on). */
export function useQueue(options: { card?: string | undefined; enabled?: boolean | undefined } = {}) {
  const { ws, base } = useQueueBase();
  return useQuery({
    queryKey: qk.queue(ws, options.card),
    enabled: options.enabled ?? true,
    queryFn: () => get<QueueDto>(base, options.card ? { card: options.card } : undefined),
  });
}

export function useAddRun() {
  const { base, reread } = useQueueBase();
  return useMutation({
    mutationFn: (input: CreateRunInput) => post<AgentRunDto>(`${base}/runs`, input),
    onSettled: reread,
  });
}

/** `allow-dirty` and `worktree/remove` are docs/16 §9.2: start in a folder with changes not committed, and remove an ended run's own copy. */
export type RunAction = 'pause' | 'resume' | 'cancel' | 'allow-dirty' | 'worktree/remove';

export function useRunAction() {
  const { base, reread } = useQueueBase();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: RunAction }) =>
      post<AgentRunDto>(`${base}/runs/${id}/${action}`),
    onSettled: reread,
  });
}

/** With my approval or Automatic, for a run that has not started (docs/16 D58). */
export function useSetRunMode() {
  const { base, reread } = useQueueBase();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: RunMode }) =>
      post<AgentRunDto>(`${base}/runs/${id}/mode`, { mode }),
    onSettled: reread,
  });
}

/** Run it later: a pending item of an automatic run opens a chat on its folder, where D41 still asks (D58). */
export function useRunPending() {
  const { base, reread } = useQueueBase();
  return useMutation({
    mutationFn: ({ id, decisionId }: { id: string; decisionId: string }) =>
      post<ChatTurnStarted>(`${base}/runs/${id}/pending/${decisionId}/run`),
    onSettled: reread,
  });
}

/** The new order of the runs that have not started. The page shows it at once, and the answer replaces it. */
export function useReorderRuns() {
  const { ws, base, reread, client } = useQueueBase();
  return useMutation({
    mutationFn: (ids: string[]) => post<QueueDto>(`${base}/order`, { ids }),
    onMutate: (ids) => {
      const key = qk.queue(ws);
      const before = client.getQueryData<QueueDto>(key);
      if (before) {
        const rank = new Map(ids.map((id, index) => [id, index]));
        const runs = [...before.runs].sort(
          (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
        );
        client.setQueryData<QueueDto>(key, { ...before, runs });
      }
      return { before };
    },
    onError: (_error, _ids, context) => {
      if (context?.before) client.setQueryData(qk.queue(ws), context.before);
    },
    onSettled: reread,
  });
}

export function usePauseQueue() {
  const { base, reread } = useQueueBase();
  return useMutation({
    mutationFn: (paused: boolean) => post<QueueStateDto>(`${base}/pause`, { paused }),
    onSettled: reread,
  });
}

export function useQueueSettings() {
  const { base, reread } = useQueueBase();
  return useMutation({
    mutationFn: (input: QueueSettingsInput) => patch<QueueStateDto>(`${base}/settings`, input),
    onSettled: reread,
  });
}

/** The schedule dialog's quick choices, in the queue's timezone: tonight, tomorrow morning, and every Monday. */
export const QUICK_WHEN = ['tonight', 'morning', 'weekly'] as const;
export type QuickWhen = (typeof QUICK_WHEN)[number];

const nextDay = (date: string): string => {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + 1);
  return at.toISOString().slice(0, 10);
};

export function quickWhen(choice: QuickWhen, timezone: string, now = new Date()): RunWhen {
  const today = localDateOf(now, timezone);
  // A passed 22:00 rolls to tomorrow, so the quick choice never runs at once by surprise (review M1).
  if (choice === 'tonight') {
    const passed = localInstant(today, '22:00', timezone).getTime() <= now.getTime();
    return { kind: 'once', date: passed ? nextDay(today) : today, time: '22:00' };
  }
  if (choice === 'morning') return { kind: 'once', date: nextDay(today), time: '08:00' };
  return { kind: 'weekly', day: 'MON', time: '08:00' };
}

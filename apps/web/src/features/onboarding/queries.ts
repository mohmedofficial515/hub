'use client';

/**
 * @file queries.ts
 * @description The member's path (docs/04 §3.23) and a manager's preview of another role's path, which reads the setting and saves nothing. The path sits
 * under the cards prefix, so a first claim or session that finishes a step shows up on the open page.
 */
import { useQuery } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import type { Role } from '@/features/cards/types';
import { del, get, post } from '@/lib/api/client';
import { getQueryClient } from '@/lib/query-client';

import { mergeGroups, type OnboardingGroupDto, type OnboardingItemDto } from './steps';

const pathKey = (ws: string) => qk.cardList(ws, { view: 'onboarding' });

export function useOnboarding() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: pathKey(ws),
    enabled: !!ws,
    queryFn: async () => ({
      steps: mergeGroups(await get<OnboardingGroupDto[]>(`workspaces/${ws}/onboarding`)),
    }),
  });
}

/** A role's path as a new member would get it: nothing ticked. */
export function useRolePath(role: Role | null) {
  const { ws } = useRoute();
  return useQuery({
    queryKey: ['onboarding-preview', ws, role] as const,
    enabled: !!role && !!ws,
    queryFn: async () => {
      const rows = await get<{ key: string; value: unknown }[]>(`workspaces/${ws}/settings`);
      const paths = (rows.find((r) => r.key === 'onboarding.paths')?.value ?? {}) as Partial<
        Record<Role, OnboardingItemDto[]>
      >;
      return { steps: mergeGroups([{ role: role as Role, items: paths[role as Role] ?? [] }]) };
    },
  });
}

/** Ticks or unticks a step, predicted at once and put back if the API refuses. */
export async function setStepDone(ws: string, id: string, done: boolean) {
  const client = getQueryClient();
  const key = pathKey(ws);
  const previous = client.getQueryData(key);
  client.setQueryData<{ steps: { id: string; done: boolean }[] }>(key, (data) =>
    data ? { steps: data.steps.map((s) => (s.id === id ? { ...s, done } : s)) } : data,
  );
  const path = `workspaces/${ws}/onboarding/${encodeURIComponent(id)}/done`;
  try {
    await (done ? post<void>(path) : del<void>(path));
  } catch (error) {
    client.setQueryData(key, previous);
    throw error;
  } finally {
    void client.invalidateQueries({ queryKey: key });
    void client.invalidateQueries({ queryKey: qk.counters(ws) });
  }
}

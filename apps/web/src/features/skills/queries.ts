'use client';

/**
 * @file queries.ts
 * @description The Skills page's hooks (docs/16 §11, D64 to D66). Writes are the owner's alone and session only. A write answers how many devices it asked to sync; the list is read
 * again a few seconds later as well, since a device's sync ends with no stream event. A refused write throws `HubError`: `hub.skills.name_taken`, `hub.skills.stale_base`,
 * `hub.skills.core_read_only`, `hub.skills.not_text`, `hub.skills.too_large`, `hub.security.secret_detected`.
 */
import type {
  CreateSkillInput,
  MoveSkillInput,
  PluginDevice,
  SkillDetail,
  SkillRevision,
  SkillRevisionDetail,
  Skills,
  SkillSource,
  SkillWritten,
  UpdateSkillInput,
} from '@hub/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { get, post, put } from '@/lib/api/client';

export const skillsKey = (ws: string) => ['skills', ws] as const;

function useSkillsBase() {
  const { ws } = useRoute();
  const client = useQueryClient();
  const base = `workspaces/${ws}/skills`;
  const reread = () => void client.invalidateQueries({ queryKey: skillsKey(ws) });
  /** Again once the devices had time to take the plugin. */
  const rereadSoon = () => {
    reread();
    window.setTimeout(reread, 4_000);
    window.setTimeout(reread, 15_000);
  };
  return { ws, base, reread, rereadSoon };
}

export function useSkills() {
  const { ws, base } = useSkillsBase();
  return useQuery({ queryKey: skillsKey(ws), queryFn: () => get<Skills>(base), enabled: !!ws });
}

export function useSkill(source: SkillSource, name: string | null) {
  const { ws, base } = useSkillsBase();
  return useQuery({
    queryKey: [...skillsKey(ws), source, name],
    queryFn: () => get<SkillDetail>(`${base}/${source}/${encodeURIComponent(name ?? '')}`),
    enabled: !!ws && !!name,
  });
}

export function useCreateSkill() {
  const { base, rereadSoon } = useSkillsBase();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => post<SkillWritten>(base, input),
    onSettled: rereadSoon,
  });
}

export function useUpdateSkill(name: string) {
  const { base, rereadSoon } = useSkillsBase();
  return useMutation({
    mutationFn: (input: UpdateSkillInput) =>
      put<SkillWritten>(`${base}/hub/${encodeURIComponent(name)}`, input),
    onSettled: rereadSoon,
  });
}

export function useMoveSkill() {
  const { base, rereadSoon } = useSkillsBase();
  return useMutation({
    mutationFn: (input: MoveSkillInput) => post<SkillWritten>(`${base}/move`, input),
    onSettled: rereadSoon,
  });
}

export function useSkillRevisions(name: string | null) {
  const { ws, base } = useSkillsBase();
  return useQuery({
    queryKey: [...skillsKey(ws), 'revisions', name],
    queryFn: () => get<SkillRevision[]>(`${base}/hub/${encodeURIComponent(name ?? '')}/revisions`),
    enabled: !!ws && !!name,
  });
}

export function useSkillRevision(name: string, id: string | null) {
  const { ws, base } = useSkillsBase();
  return useQuery({
    queryKey: [...skillsKey(ws), 'revision', name, id],
    queryFn: () => get<SkillRevisionDetail>(`${base}/hub/${encodeURIComponent(name)}/revisions/${id ?? ''}`),
    enabled: !!ws && !!id,
  });
}

export function useRestoreSkill(name: string) {
  const { base, rereadSoon } = useSkillsBase();
  return useMutation({
    mutationFn: ({ id, baseHash }: { id: string; baseHash: string }) =>
      post<SkillWritten>(`${base}/hub/${encodeURIComponent(name)}/revisions/${id}/restore`, { baseHash }),
    onSettled: rereadSoon,
  });
}

export function useSyncSkills() {
  const { base, reread } = useSkillsBase();
  return useMutation({
    mutationFn: () => post<{ devices: PluginDevice[] }>(`${base}/sync`),
    onSettled: reread,
  });
}

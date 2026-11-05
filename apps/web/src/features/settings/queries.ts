'use client';

/**
 * @file queries.ts
 * @description Project settings and details, sources, personal tokens and the audit log. Everything but tokens sits under `qk.admin`
 * or `qk.workspace`, which `project.updated` on the stream rereads, so a change from MCP or another tab appears without a reload.
 */
import type { Project, SourceDto, SourceKind, SystemData } from '@hub/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { API_PREFIX, del, get, getPage, patch, post, put, toSearchParams } from '@/lib/api/client';
import { isHubError } from '@/lib/api/errors';

interface SettingRowDto {
  key: string;
  value: unknown;
  default: unknown;
  isDefault: boolean;
}

export type SettingsMap = Record<string, unknown>;

/** Values by key. `defaults` holds what the catalogue would answer, for the "by default" hints. */
export function useSettingRows() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.admin(ws, 'settings'),
    enabled: !!ws,
    staleTime: 60_000,
    queryFn: () => get<SettingRowDto[]>(`workspaces/${ws}/settings`),
  });
}

export function useSettings() {
  const query = useSettingRows();
  const data = useMemo(
    () => (query.data ? Object.fromEntries(query.data.map((row) => [row.key, row.value])) : undefined),
    [query.data],
  );
  return { ...query, data };
}

export function useSettingDefaults(): SettingsMap {
  const { data } = useSettingRows();
  return useMemo(() => (data ? Object.fromEntries(data.map((row) => [row.key, row.default])) : {}), [data]);
}

export function useSaveSettings() {
  const { ws } = useRoute();
  const client = useQueryClient();
  return useMutation({
    /** One PUT per key: the API validates each against its schema, and a refusal names its key. */
    mutationFn: async (values: SettingsMap) => {
      for (const [key, value] of Object.entries(values)) {
        await put(`workspaces/${ws}/settings/${key}`, { value });
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: qk.admin(ws, 'settings') }),
  });
}

// ── The project (docs/15 §5) ────────────────────────────────────────────────────────────────────

export type ProjectChanges = Partial<
  Pick<Project, 'name' | 'timezone' | 'links' | 'repoPaths'> & {
    defaultLocale: 'ar' | 'en';
    description: string | null;
    goals: string | null;
    status: 'active' | 'paused';
  }
>;

export function useProject() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.workspace(ws),
    enabled: !!ws,
    queryFn: () => get<Project>(`workspaces/${ws}`),
  });
}

function useAfterProject() {
  const { ws } = useRoute();
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.workspace(ws) });
    void client.invalidateQueries({ queryKey: qk.workspaces });
    void client.invalidateQueries({ queryKey: qk.me });
  };
}

export function useUpdateProject() {
  const { ws } = useRoute();
  const onSettled = useAfterProject();
  return useMutation({
    mutationFn: (changes: ProjectChanges) => patch<Project>(`workspaces/${ws}`, changes),
    onSettled,
  });
}

export function useSetProjectClosed() {
  const { ws } = useRoute();
  const onSettled = useAfterProject();
  return useMutation({
    mutationFn: (closed: boolean) => post<Project>(`workspaces/${ws}/${closed ? 'close' : 'reopen'}`),
    onSettled,
  });
}

// ── Sources (docs/04 §3.7) ──────────────────────────────────────────────────────────────────────

export type Source = Omit<SourceDto, 'kind'> & { kind: SourceKind };

export interface SourceInput {
  name?: string;
  config?: Record<string, unknown>;
  secret?: string | null;
  enabled?: boolean;
}

export function useSources() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.admin(ws, 'sources'),
    enabled: !!ws,
    queryFn: () => get<Source[]>(`workspaces/${ws}/sources`),
  });
}

function useInvalidateSources() {
  const { ws } = useRoute();
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: qk.admin(ws, 'sources') });
}

export function useCreateSource() {
  const { ws } = useRoute();
  const onSettled = useInvalidateSources();
  return useMutation({
    mutationFn: (input: {
      kind: SourceKind;
      name: string;
      config: Record<string, unknown>;
      secret?: string;
    }) => post<Source>(`workspaces/${ws}/sources`, input),
    onSettled,
  });
}

export function useUpdateSource() {
  const { ws } = useRoute();
  const onSettled = useInvalidateSources();
  return useMutation({
    mutationFn: ({ id, ...input }: SourceInput & { id: string }) =>
      patch<Source>(`workspaces/${ws}/sources/${id}`, input),
    onSettled,
  });
}

export function useTestSource() {
  const { ws } = useRoute();
  return useMutation({
    mutationFn: (id: string) =>
      post<{ ok: boolean; details: { filesFound?: number } }>(`workspaces/${ws}/sources/${id}/test`),
  });
}

export interface CaptureRun {
  id: string;
  kind: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  created: number;
  updated: number;
  error: string | null;
}

/** A source's last runs, newest first (`GET …/capture/runs`). `source.run` on the stream rereads them. */
export function useSourceRuns(id: string | null | undefined) {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.admin(ws, 'sources', id, 'runs'),
    enabled: !!ws && !!id,
    queryFn: () => get<CaptureRun[]>(`workspaces/${ws}/capture/runs`, { source: id, limit: 50 }),
  });
}

export function useRunSource() {
  const { ws } = useRoute();
  const onSettled = useInvalidateSources();
  return useMutation({
    mutationFn: (id: string) => post(`workspaces/${ws}/sources/${id}/run`),
    onSettled,
  });
}

// ── Personal API tokens (docs/04 §3.3) ──────────────────────────────────────────────────────────

export interface TokenRow {
  id: string;
  name: string;
  kind: 'mcp' | 'hook';
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

const TOKENS_KEY = ['my-tokens'] as const;

export function useTokens() {
  return useQuery({ queryKey: TOKENS_KEY, queryFn: () => get<TokenRow[]>('me/tokens') });
}

export function useCreateToken() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; kind: 'mcp' | 'hook' }) =>
      post<{ id: string; token: string; prefix: string }>('me/tokens', input),
    onSettled: () => client.invalidateQueries({ queryKey: TOKENS_KEY }),
  });
}

export function useRevokeToken() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`me/tokens/${id}`),
    onSettled: () => client.invalidateQueries({ queryKey: TOKENS_KEY }),
  });
}

// ── Audit (docs/04 §3.21) ───────────────────────────────────────────────────────────────────────

export interface AuditRow {
  id: string;
  actor: {
    kind: 'user' | 'agent' | 'system';
    userId: string | null;
    displayName: string | null;
    via: string;
  };
  via: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditFilters {
  actor?: string | undefined;
  action?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export function useAudit(filters: AuditFilters) {
  const { ws } = useRoute();
  return useInfiniteQuery({
    queryKey: qk.admin(ws, 'audit', filters),
    enabled: !!ws,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      getPage<AuditRow>(`workspaces/${ws}/audit`, { ...filters, limit: 50, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** The API's CSV for the same filters (docs/04 §3.21). The session cookie carries the request, so a plain link does. */
export const auditExportHref = (ws: string, filters: AuditFilters) =>
  `${API_PREFIX}/workspaces/${ws}/audit/export.csv?${toSearchParams({ ...filters }).toString()}`;

// ── System (docs/09 §18.6) ──────────────────────────────────────────────────────────────────────

export function useSystem() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.admin(ws, 'system'),
    enabled: !!ws,
    refetchInterval: 30_000,
    queryFn: () => get<SystemData>(`workspaces/${ws}/system`),
  });
}

export interface HealthReady {
  status: 'ok';
  checks: Record<string, 'ok' | 'failed' | 'skipped'>;
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    retry: false,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [ready, live] = await Promise.allSettled([
        get<HealthReady>('health/ready'),
        get<{ uptimeSec: number }>('health/live'),
      ]);
      const failed = ready.status === 'rejected' && isHubError(ready.reason) ? ready.reason : null;
      const checks =
        ready.status === 'fulfilled'
          ? ready.value.checks
          : ((failed?.details['checks'] as HealthReady['checks'] | undefined) ?? null);
      return { checks, uptimeSec: live.status === 'fulfilled' ? live.value.uptimeSec : null };
    },
  });
}

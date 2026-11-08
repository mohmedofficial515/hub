'use client';

/**
 * @file queries.ts
 * @description Settings › Backups (docs/16 D61 to D63) and the publishing facts of Settings › Devices. Backups belong to the machine, not to a project, but
 * their routes sit under the project in the URL like every Settings route. The history reads itself every few seconds while a backup runs, since its end
 * comes with no event on the stream, and once a minute otherwise, for the free space.
 */
import type {
  BackupDto,
  BackupsDto,
  BackupSettingsDto,
  BackupSettingsInput,
  PublishingDto,
} from '@hub/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { del, get, patch, post } from '@/lib/api/client';

const RUNNING_REFRESH_MS = 2_000;
const IDLE_REFRESH_MS = 60_000;

const backupsKey = (ws: string | null | undefined) => ['backups', ws ?? ''] as const;

/** `enabled` is false for anyone but the owner, whose tab alone it is, so no request is made only to be refused. */
export function useBackups(enabled = true) {
  const { ws } = useRoute();
  return useQuery({
    queryKey: backupsKey(ws),
    enabled: !!ws && enabled,
    refetchInterval: (query) => (query.state.data?.running ? RUNNING_REFRESH_MS : IDLE_REFRESH_MS),
    queryFn: () => get<BackupsDto>(`workspaces/${ws}/backups`),
  });
}

function useRefresh() {
  const { ws } = useRoute();
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: backupsKey(ws) });
}

export function useBackUpNow() {
  const { ws } = useRoute();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: () => post<BackupDto>(`workspaces/${ws}/backups`),
    onSettled: refresh,
  });
}

export function usePinBackup() {
  const { ws } = useRoute();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      post<BackupDto>(`workspaces/${ws}/backups/${id}/pin`, { pinned }),
    onSettled: refresh,
  });
}

export function useDeleteBackup() {
  const { ws } = useRoute();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => del<BackupDto>(`workspaces/${ws}/backups/${id}`),
    onSettled: refresh,
  });
}

export function useSaveBackupSettings() {
  const { ws } = useRoute();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: BackupSettingsInput) =>
      patch<BackupSettingsDto>(`workspaces/${ws}/backups/settings`, input),
    onSettled: refresh,
  });
}

/** What Tailscale and the config say about reaching Hub from other devices. The API keeps it for 30 s. */
export function usePublishing() {
  return useQuery({
    queryKey: ['publishing'],
    staleTime: 30_000,
    queryFn: () => get<PublishingDto>('me/devices/publishing'),
  });
}

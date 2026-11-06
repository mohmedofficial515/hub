'use client';

/**
 * @file queries.ts
 * @description Settings › Devices and the approval page. A device belongs to the member, not to a project, so these keys carry no project. Online state changes with no event on the stream, so the
 * list reads itself every few seconds while the tab is open. The credentials pairing makes never reach this file: the API hands them to the device.
 */
import type { DeviceDto, HealthFix, LinkResult, PairingStatus } from '@hub/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { del, get, post } from '@/lib/api/client';

const DEVICES_KEY = ['my-devices'] as const;
const LIST_REFRESH_MS = 5_000;

export interface PairingView {
  userCode: string;
  name: string;
  platform: string;
  status: PairingStatus;
  expiresAt: string;
}

/** The panel is on every page, so it asks less often than Settings, where someone is watching this list. */
export function useDevices(refreshMs: number = LIST_REFRESH_MS) {
  return useQuery({
    queryKey: DEVICES_KEY,
    refetchInterval: refreshMs,
    queryFn: () => get<DeviceDto[]>('me/devices'),
  });
}

export function useConnectCommand() {
  return useQuery({
    queryKey: ['connect-command'],
    staleTime: 300_000,
    queryFn: () => get<{ apiUrl: string; connect: string; uninstall: string }>('me/devices/connect-command'),
  });
}

function useDeviceAnswer() {
  const client = useQueryClient();
  return (device: DeviceDto) =>
    client.setQueryData<DeviceDto[]>(DEVICES_KEY, (rows) =>
      rows?.map((row) => (row.id === device.id ? device : row)),
    );
}

export function useCheckDevice() {
  const store = useDeviceAnswer();
  return useMutation({
    mutationFn: (id: string) => get<DeviceDto>(`me/devices/${id}/health`),
    onSuccess: store,
  });
}

export function useFixDevice() {
  const store = useDeviceAnswer();
  return useMutation({
    mutationFn: ({ id, fix }: { id: string; fix: HealthFix }) =>
      post<DeviceDto>(`me/devices/${id}/fix`, { fix }),
    onSuccess: store,
  });
}

export function useRevokeDevice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`me/devices/${id}`),
    onSettled: () => client.invalidateQueries({ queryKey: DEVICES_KEY }),
  });
}

/** The Link button. It also registers the folder on the project, so the project is read again. */
export function useLinkFolder() {
  const { ws } = useRoute();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, folder }: { deviceId: string; folder: string }) =>
      post<LinkResult>(`workspaces/${ws}/devices/${deviceId}/link`, { folder }),
    onSettled: () => client.invalidateQueries({ queryKey: qk.workspace(ws) }),
  });
}

export function usePairing(code: string | null) {
  return useQuery({
    queryKey: ['pairing', code],
    enabled: !!code,
    retry: false,
    queryFn: () => get<PairingView>(`pairing/${encodeURIComponent(code ?? '')}`),
  });
}

export function useAnswerPairing(code: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (answer: 'approve' | 'deny') =>
      post<void>(`pairing/${encodeURIComponent(code ?? '')}/${answer}`),
    onSettled: () => client.invalidateQueries({ queryKey: ['pairing', code] }),
  });
}

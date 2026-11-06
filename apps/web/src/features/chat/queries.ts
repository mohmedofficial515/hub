'use client';

/**
 * @file queries.ts
 * @description The hooks the panel is built on (docs/16 §7, §7.1), so the port is only UI. Streaming needs nothing here: `LiveProvider` routes `chat.event` and `chat.changed` into these caches (`live.ts`), so `useChat` is live, and a reconnect rereads it, which is the catch-up.
 * The route is read for the project. A refused write throws `HubError`, whose `code` and localised `message` the panel shows: `hub.chats.turn_running`, `hub.chats.approval_answered`, `hub.devices.offline`.
 */
import type {
  ApprovalDecision,
  ChatDiff,
  ChatDto,
  ChatFullDto,
  ChatSuggestion,
  ChatTurnStarted,
  CreateChatInput,
  EngineStatus,
  PromptTemplateDto,
  PromptTemplateInput,
  SendChatMessageInput,
  SuggestionInput,
  UpdateChatInput,
} from '@hub/contracts';
import { suggestedPrompts } from '@hub/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { del, get, patch, post, put } from '@/lib/api/client';

import { chatKeys } from './live';

const ENGINE_STALE_MS = 60_000;
const DELETED_OPTION = { deleted: 'true' } as const;

function useChatBase() {
  const { ws } = useRoute();
  const client = useQueryClient();
  const base = `workspaces/${ws}/chats`;
  const reread = (id?: string) => {
    void client.invalidateQueries({ queryKey: chatKeys.list(ws) });
    void client.invalidateQueries({ queryKey: chatKeys.list(ws, true) });
    if (id) void client.invalidateQueries({ queryKey: chatKeys.one(ws, id) });
  };
  return { ws, base, reread };
}

/** Chats on this project, pinned first. History by project (§7). */
export function useChats(options: { deleted?: boolean } = {}) {
  const { ws, base } = useChatBase();
  return useQuery({
    queryKey: chatKeys.list(ws, options.deleted === true),
    queryFn: () => get<ChatDto[]>(base, options.deleted ? DELETED_OPTION : undefined),
  });
}

/** One chat: messages, steps, approvals. Live. */
export function useChat(id: string | null) {
  const { ws, base } = useChatBase();
  return useQuery({
    queryKey: chatKeys.one(ws, id ?? 'none'),
    enabled: id !== null,
    queryFn: () => get<ChatFullDto>(`${base}/${id ?? ''}`),
  });
}

/** Claude Code on a device: found, version and range, sign-in, and which selectors it supports. */
export function useEngine(device: string | null) {
  const { ws, base } = useChatBase();
  return useQuery({
    queryKey: chatKeys.engine(ws, device ?? 'none'),
    enabled: device !== null,
    staleTime: ENGINE_STALE_MS,
    queryFn: () => get<EngineStatus>(`${base}/engine`, { device: device ?? '' }),
  });
}

export function useCreateChat() {
  const { base, reread } = useChatBase();
  return useMutation({
    mutationFn: (input: CreateChatInput) => post<ChatDto>(base, input),
    onSuccess: () => reread(),
  });
}

/** Send a message. The reply arrives through `useChat`. */
export function useSendMessage(id: string) {
  const { base, reread } = useChatBase();
  return useMutation({
    mutationFn: (input: SendChatMessageInput) => post<ChatTurnStarted>(`${base}/${id}/messages`, input),
    onSuccess: () => reread(id),
  });
}

export function useStopTurn(id: string) {
  const { base } = useChatBase();
  return useMutation({ mutationFn: () => post<void>(`${base}/${id}/stop`) });
}

export function useRetryTurn(id: string) {
  const { base, reread } = useChatBase();
  return useMutation({
    mutationFn: (input: Pick<SendChatMessageInput, 'mode' | 'model' | 'effort'> = {}) =>
      post<ChatTurnStarted>(`${base}/${id}/retry`, input),
    onSuccess: () => reread(id),
  });
}

/** Allow once or Deny. The first answer wins across devices; a late one gets `hub.chats.approval_answered`, and the chat is reread either way. */
export function useAnswerApproval(id: string) {
  const { base, reread } = useChatBase();
  return useMutation({
    mutationFn: ({ approval, decision }: { approval: string; decision: ApprovalDecision }) =>
      post<void>(`${base}/${id}/approvals/${approval}`, { decision }),
    onSettled: () => reread(id),
  });
}

export function useBranchChat(id: string) {
  const { base, reread } = useChatBase();
  return useMutation({
    mutationFn: (input: { message: string; title?: string }) => post<ChatDto>(`${base}/${id}/branch`, input),
    onSuccess: () => reread(),
  });
}

/** Rename, pin, or set the mode, model and effort of the next turn. */
export function useUpdateChat(id: string) {
  const { base, reread } = useChatBase();
  return useMutation({
    mutationFn: (input: UpdateChatInput) => patch<ChatDto>(`${base}/${id}`, input),
    onSuccess: () => reread(id),
  });
}

export function useDeleteChat(id: string) {
  const { base, reread } = useChatBase();
  return useMutation({ mutationFn: () => del<void>(`${base}/${id}`), onSuccess: () => reread(id) });
}

export function useRestoreChat(id: string) {
  const { base, reread } = useChatBase();
  return useMutation({
    mutationFn: () => post<ChatDto>(`${base}/${id}/restore`),
    onSuccess: () => reread(id),
  });
}

export function useExportChat(id: string) {
  const { base } = useChatBase();
  return useMutation({
    mutationFn: () => get<{ fileName: string; markdown: string }>(`${base}/${id}/export`),
  });
}

/** One file's diff against HEAD as it is now on the device. */
export function useChatDiff(id: string, path: string | null) {
  const { ws, base } = useChatBase();
  return useQuery({
    queryKey: chatKeys.diff(ws, id, path ?? 'none'),
    enabled: path !== null,
    queryFn: () => get<ChatDiff>(`${base}/${id}/diff`, { path: path ?? '' }),
  });
}

export function usePromptTemplates() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: chatKeys.templates(ws),
    queryFn: () => get<PromptTemplateDto[]>(`workspaces/${ws}/prompt-templates`),
  });
}

export function useSavePromptTemplate() {
  const { ws } = useRoute();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: PromptTemplateInput & { id?: string }) =>
      id
        ? put<PromptTemplateDto>(`workspaces/${ws}/prompt-templates/${id}`, input)
        : post<PromptTemplateDto>(`workspaces/${ws}/prompt-templates`, input),
    onSuccess: () => void client.invalidateQueries({ queryKey: chatKeys.templates(ws) }),
  });
}

export function useDeletePromptTemplate() {
  const { ws } = useRoute();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del<void>(`workspaces/${ws}/prompt-templates/${id}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: chatKeys.templates(ws) }),
  });
}

/** The prompts to offer for this page and card. Words are `suggestions.<id>` in the `chat` namespace. */
export function useSuggestions(input: SuggestionInput): ChatSuggestion[] {
  return suggestedPrompts(input);
}

'use client';

/**
 * @file queries.ts
 * @description Schema Studio's hooks (docs/17). `LiveProvider` rereads `qk.schema` on `schema.changed`, so a refresh, a name or a draft from Claude shows here with no code of its own.
 * Annotations are written optimistically: the page shows the new name at once, and puts the old one back if the write is refused.
 */
import type {
  AnnotationInput,
  CreateSchemaDraftInput,
  RefreshSchemaResult,
  ReviewDraftResult,
  SchemaAnnotationDto,
  SchemaDraftDto,
  SchemaSnapshotRow,
  SchemaSourceInput,
  SchemaStudioDto,
  UpdateSchemaDraftInput,
} from '@hub/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { get, patch, post, put } from '@/lib/api/client';

function useSchemaBase() {
  const { ws } = useRoute();
  const client = useQueryClient();
  const base = `workspaces/${ws}/schema`;
  const reread = () => void client.invalidateQueries({ queryKey: qk.schema(ws) });
  return { ws, base, reread, client };
}

export function useSchemaStudio() {
  const { ws, base } = useSchemaBase();
  return useQuery({
    queryKey: qk.schema(ws),
    queryFn: () => get<SchemaStudioDto>(base),
    staleTime: 60_000,
  });
}

export function useSchemaHistory(enabled: boolean) {
  const { ws, base } = useSchemaBase();
  return useQuery({
    queryKey: qk.schemaHistory(ws),
    queryFn: () => get<{ snapshots: SchemaSnapshotRow[] }>(`${base}/snapshots`),
    enabled,
  });
}

export function useRefreshSchema() {
  const { base, reread } = useSchemaBase();
  return useMutation({
    mutationFn: (input: { draftId?: string } = {}) => post<RefreshSchemaResult>(`${base}/refresh`, input),
    onSettled: reread,
  });
}

export function useSetSchemaSource() {
  const { ws, base, client } = useSchemaBase();
  return useMutation({
    mutationFn: (input: SchemaSourceInput) => put<SchemaStudioDto>(`${base}/source`, input),
    onSuccess: (data) => client.setQueryData(qk.schema(ws), data),
  });
}

/** Merges the change into the cached list, so the edit shows before the answer. */
function merged(
  list: readonly SchemaAnnotationDto[],
  inputs: readonly AnnotationInput[],
): SchemaAnnotationDto[] {
  const byTarget = new Map(list.map((entry) => [entry.target, entry]));
  for (const input of inputs) {
    const was = byTarget.get(input.target);
    byTarget.set(input.target, {
      target: input.target,
      nameAr: input.nameAr === undefined ? (was?.nameAr ?? null) : input.nameAr || null,
      descriptionAr:
        input.descriptionAr === undefined ? (was?.descriptionAr ?? null) : input.descriptionAr || null,
      notes: input.notes === undefined ? (was?.notes ?? null) : input.notes || null,
      tags: input.tags ?? was?.tags ?? [],
      sensitivity: input.sensitivity ?? was?.sensitivity ?? 'none',
      updatedBy: was?.updatedBy ?? null,
      updatedAt: new Date().toISOString(),
      syncedAt: null,
    });
  }
  return [...byTarget.values()];
}

export function useAnnotate() {
  const { ws, base, client, reread } = useSchemaBase();
  return useMutation({
    mutationFn: (annotations: AnnotationInput[]) =>
      put<{ annotations: SchemaAnnotationDto[] }>(`${base}/annotations`, { annotations }),
    onMutate: async (annotations) => {
      await client.cancelQueries({ queryKey: qk.schema(ws) });
      const before = client.getQueryData<SchemaStudioDto>(qk.schema(ws));
      if (before)
        client.setQueryData(qk.schema(ws), {
          ...before,
          annotations: merged(before.annotations, annotations),
        });
      return { before };
    },
    onError: (_error, _input, context) => {
      if (context?.before) client.setQueryData(qk.schema(ws), context.before);
    },
    onSuccess: (data) => {
      const now = client.getQueryData<SchemaStudioDto>(qk.schema(ws));
      if (now) client.setQueryData(qk.schema(ws), { ...now, annotations: data.annotations });
    },
    onSettled: reread,
  });
}

function patchDraft(client: ReturnType<typeof useQueryClient>, ws: string, draft: SchemaDraftDto) {
  const now = client.getQueryData<SchemaStudioDto>(qk.schema(ws));
  if (!now) return;
  const others = now.drafts.filter((entry) => entry.id !== draft.id);
  client.setQueryData(qk.schema(ws), { ...now, drafts: [draft, ...others] });
}

export function useCreateDraft() {
  const { ws, base, client, reread } = useSchemaBase();
  return useMutation({
    mutationFn: (input: CreateSchemaDraftInput) => post<SchemaDraftDto>(`${base}/drafts`, input),
    onSuccess: (draft) => patchDraft(client, ws, draft),
    onSettled: reread,
  });
}

export function useUpdateDraft() {
  const { ws, base, client, reread } = useSchemaBase();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateSchemaDraftInput & { id: string }) =>
      patch<SchemaDraftDto>(`${base}/drafts/${id}`, input),
    onMutate: ({ id, ...input }) => {
      const now = client.getQueryData<SchemaStudioDto>(qk.schema(ws));
      const draft = now?.drafts.find((entry) => entry.id === id);
      if (draft)
        patchDraft(client, ws, {
          ...draft,
          ...(input.changes ? { changes: input.changes } : {}),
          ...(input.title ? { title: input.title } : {}),
        });
    },
    onSuccess: (draft) => patchDraft(client, ws, draft),
    onSettled: reread,
  });
}

export function useReviewDraft() {
  const { base, reread } = useSchemaBase();
  return useMutation({
    mutationFn: (id: string) => post<ReviewDraftResult>(`${base}/drafts/${id}/review`),
    onSettled: reread,
  });
}

export function useAttachDraftChat() {
  const { base, reread } = useSchemaBase();
  return useMutation({
    mutationFn: ({ id, chatId }: { id: string; chatId: string }) =>
      post<SchemaDraftDto>(`${base}/drafts/${id}/chat`, { chatId }),
    onSettled: reread,
  });
}

/**
 * @file evidence.ts
 * @description A plan step's evidence (v5-live-plan, batch 3): where its files are served, and adding or removing one. Hub keeps each file as an
 * attachment of the plan card (a picture without its hidden data, a video as it came) and names it on the step, so a step's `evidence` is the
 * server's: the plan's form never sends it.
 */
import { currentRoute } from '@/components/shell/router';
import { API_PREFIX, del, post } from '@/lib/api/client';

import { getQueryClient } from '../../lib/query-client';
import { qk } from '../cards/keys';
import type { StepEvidence } from '../cards/types';

export const EVIDENCE_KINDS = ['before', 'after', 'video'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** What the picker offers; Hub checks the bytes again, whatever the browser says. */
export const EVIDENCE_ACCEPT = 'image/png,image/jpeg,image/webp,video/mp4,video/webm';
export const EVIDENCE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const EVIDENCE_VIDEO_MAX_BYTES = 40 * 1024 * 1024;

/** The served file of an attachment of the card. */
export const evidenceUrl = (ws: string, cardKey: string, attachmentId: string) =>
  `${API_PREFIX}/workspaces/${encodeURIComponent(ws)}/cards/${encodeURIComponent(cardKey)}/attachments/${encodeURIComponent(attachmentId)}/file`;

/** A short name for a file, for its alt text, caption and download. */
export const evidenceName = (item: StepEvidence) =>
  item.caption ?? `${item.kind}.${item.mime.split('/')[1] ?? 'bin'}`;

/** The kind a file of this type can be, by default. */
export const defaultKind = (file: File | null, taken: readonly StepEvidence[]): EvidenceKind =>
  file?.type.startsWith('video/')
    ? 'video'
    : taken.some((e) => e.kind === 'before') && !taken.some((e) => e.kind === 'after')
      ? 'after'
      : 'before';

const reread = (key: string) => {
  const { ws } = currentRoute();
  void getQueryClient().invalidateQueries({ queryKey: qk.card(ws, key) });
  void getQueryClient().invalidateQueries({ queryKey: qk.events(ws, key) });
};

export async function addEvidence(
  key: string,
  stepId: string,
  input: { file: File; kind: EvidenceKind; caption?: string | undefined },
) {
  const { ws } = currentRoute();
  const form = new FormData();
  form.append('kind', input.kind);
  if (input.caption?.trim()) form.append('caption', input.caption.trim());
  form.append('file', input.file);
  try {
    return await post<unknown>(
      `workspaces/${ws}/plans/${encodeURIComponent(key)}/steps/${encodeURIComponent(stepId)}/evidence`,
      undefined,
      { body: form },
    );
  } finally {
    reread(key);
  }
}

export async function removeEvidence(key: string, stepId: string, attachmentId: string) {
  const { ws } = currentRoute();
  try {
    return await del<unknown>(
      `workspaces/${ws}/plans/${encodeURIComponent(key)}/steps/${encodeURIComponent(stepId)}/evidence/${encodeURIComponent(attachmentId)}`,
    );
  } finally {
    reread(key);
  }
}

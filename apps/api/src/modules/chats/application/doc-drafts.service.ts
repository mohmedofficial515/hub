/**
 * @file `propose_doc` and the save behind it (docs/16 §7.2, §7.1): a draft with server-computed duplicates and flagged claims, which `save_doc` saves only when each flag has its answer.
 * @description In a panel chat only the owner can answer a flag, through the approval route, so a model cannot clear its own flags. Outside the panel there is no such route, so `save_doc`'s `answers` carry what the owner said in that chat. A refused save is written on the draft and sent on the turn, so it never shows as sent.
 */
import {
  type AnswerApprovalInput,
  applyClaimAnswers,
  CHAT_LIMITS,
  type ChatDocDraftDto,
  type ClaimAnswer,
  type DocClaim,
  type DocDraftStatus,
  type DocDuplicate,
  type MemberActor,
  openFlags,
  type ProposeDocInput,
  redactSecrets,
  type SaveDocResult,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { z } from 'zod';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';
import { DocsWriteService } from '@/modules/docs';
import { ProjectsService } from '@/modules/workspaces';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { TurnRegistry } from './turn-registry';

interface DraftRow {
  id: string;
  workspaceId: string;
  chatId: string | null;
  messageId: string | null;
  docKey: string | null;
  source: string | null;
  path: string | null;
  title: string;
  reason: string;
  baseVersion: string | null;
  baseText: string | null;
  draft: string;
  duplicates: unknown;
  claims: unknown;
  status: string;
  refusedCode: string | null;
  savedVersion: string | null;
  revisionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toDraftDto(row: DraftRow): ChatDocDraftDto {
  return {
    id: row.id,
    docKey: row.docKey,
    source: row.source,
    path: row.path,
    title: row.title,
    reason: row.reason,
    baseVersion: row.baseVersion,
    baseText: row.baseText,
    draft: row.draft,
    duplicates: row.duplicates as DocDuplicate[],
    claims: row.claims as DocClaim[],
    status: row.status as DocDraftStatus,
    refusedCode: row.refusedCode,
    savedVersion: row.savedVersion,
    revisionId: row.revisionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class DocDraftsService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly docs: DocsWriteService,
    private readonly projects: ProjectsService,
    private readonly turns: TurnRegistry,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async propose(
    actor: MemberActor,
    toolUseId: string | undefined,
    input: ProposeDocInput,
  ): Promise<{ draft: ChatDocDraftDto; inPanel: boolean }> {
    assertNoSecrets(input);
    if (!input.doc && !(input.source && input.path)) {
      throw new AppException('hub.docs.draft_target_missing');
    }
    const missing = input.claims.filter(
      (claim) => claim.status === 'unverified' && !input.draft.includes(claim.text),
    );
    if (missing.length > 0) {
      throw new AppException('hub.docs.claim_not_in_draft', {
        details: { claims: missing.map((claim) => claim.text) },
      });
    }
    const current = await this.docs.current(actor, {
      ...(input.doc ? { key: input.doc } : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(input.path ? { path: input.path } : {}),
    });
    if (input.baseVersion && current.hash && input.baseVersion !== current.hash) {
      throw new AppException('hub.docs.stale_base', { details: { currentHash: current.hash } });
    }
    const duplicates = await this.duplicatesOf(actor, input.title, current.cardId);
    const turn = await this.turns.panelTurn(actor, toolUseId);
    const earlier = turn ? await this.dropEarlier(actor, turn.chatId, current.source, current.path) : [];
    const answered = new Map(
      earlier
        .flatMap((row) => row.claims as DocClaim[])
        .filter((claim) => claim.answer !== null)
        .map((claim) => [claim.text, claim.answer]),
    );
    const claims: DocClaim[] = input.claims.map((claim, index) => ({
      id: `c${index + 1}`,
      text: claim.text,
      status: claim.status,
      source: claim.source ?? null,
      // A redraft keeps the owner's answer while the claim's words are the same (review M5).
      answer: claim.status === 'unverified' ? (answered.get(claim.text) ?? null) : null,
    }));
    // A file that holds a secret is shown to nobody: its base is filtered like anything else stored from a chat.
    const baseText = current.text === null ? null : redactSecrets(current.text);
    const row = await this.txHost.tx.docDraft.create({
      data: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        chatId: turn?.chatId ?? null,
        messageId: turn?.messageId ?? null,
        docKey: current.key,
        source: current.source,
        path: current.path,
        title: input.title,
        reason: input.reason,
        baseVersion: current.hash,
        baseText: baseText && baseText.length <= CHAT_LIMITS.draftChars ? baseText : null,
        draft: input.draft,
        duplicates,
        claims,
      },
    });
    await this.audit.record(actor, {
      action: 'docs.draft',
      targetType: 'doc',
      targetId: current.cardId,
      summary: `Proposed a draft of ${current.source}/${current.path}`.slice(0, 500),
    });
    const draft = toDraftDto(row);
    if (turn) await this.turns.post(turn.chatId, { kind: 'doc.draft', draft });
    return { draft, inPanel: turn !== null };
  }

  /** A new draft of the same document in this chat replaces what was open, and that one says so. */
  private async dropEarlier(
    actor: MemberActor,
    chatId: string,
    source: string,
    path: string,
  ): Promise<DraftRow[]> {
    const rows = await this.txHost.tx.docDraft.findMany({
      where: {
        workspaceId: actor.workspaceId,
        chatId,
        source,
        path,
        status: { in: ['open', 'refused'] },
      },
    });
    for (const row of rows) {
      const written = await this.txHost.tx.docDraft.update({
        where: { id: row.id, workspaceId: actor.workspaceId },
        data: { status: 'dropped' },
      });
      await this.turns.post(chatId, { kind: 'doc.draft.updated', draft: toDraftDto(written) });
    }
    return rows;
  }

  /** The drafts of these turns, for a chat's read. */
  async ofMessages(
    actor: MemberActor,
    messageIds: readonly string[],
  ): Promise<Map<string, ChatDocDraftDto[]>> {
    const rows = await this.txHost.tx.docDraft.findMany({
      where: { workspaceId: actor.workspaceId, messageId: { in: [...messageIds] } },
      orderBy: { createdAt: 'asc' },
    });
    const byMessage = new Map<string, ChatDocDraftDto[]>();
    for (const row of rows) {
      if (!row.messageId) continue;
      byMessage.set(row.messageId, [...(byMessage.get(row.messageId) ?? []), toDraftDto(row)]);
    }
    return byMessage;
  }

  /**
   * The owner's edit and flag answers, given with Allow on a `save_doc` that names this draft. Refuses to go on while a flag stays open, and the approval stays pending, so the owner can answer it.
   */
  async applyOwnerAnswers(
    actor: MemberActor,
    chatId: string,
    draftId: string,
    doc: AnswerApprovalInput['doc'],
    decision: 'allow' | 'deny',
  ): Promise<void> {
    if (doc) assertNoSecrets(doc);
    const row = await this.draftOf(actor, draftId);
    if (row.chatId !== chatId) throw new AppException('hub.docs.draft_not_found');
    const claims = withAnswers(row.claims as DocClaim[], doc?.claims ?? []);
    if (decision === 'allow' && openFlags(claims).length > 0) {
      throw new AppException('hub.docs.draft_flags_open', {
        details: { claims: openFlags(claims).map((claim) => claim.text) },
      });
    }
    if (!doc) return;
    const written = await this.txHost.tx.docDraft.update({
      where: { id: draftId, workspaceId: actor.workspaceId },
      data: { claims, ...(doc.content === undefined ? {} : { draft: doc.content }) },
    });
    await this.turns.post(chatId, { kind: 'doc.draft.updated', draft: toDraftDto(written) });
  }

  /** `save_doc` with `draft`. Everything that can refuse it is written on the draft before the refusal leaves. */
  async save(
    actor: MemberActor,
    draftId: string,
    answers: readonly { readonly id: string; readonly answer: ClaimAnswer }[] = [],
  ): Promise<SaveDocResult> {
    const row = await this.draftOf(actor, draftId);
    if (row.status === 'saved' || row.status === 'dropped') {
      throw new AppException('hub.docs.draft_not_found');
    }
    // In a panel chat the flags are the owner's to answer, through the panel. A model cannot pass its own answers.
    const claims = withAnswers(row.claims as DocClaim[], row.chatId ? [] : answers);
    const open = openFlags(claims);
    if (open.length > 0) {
      await this.refuse(actor, row, 'hub.docs.draft_flags_open');
      throw new AppException('hub.docs.draft_flags_open', {
        details: { claims: open.map((claim) => claim.text) },
      });
    }
    const content = applyClaimAnswers(row.draft, claims);
    let saved: SaveDocResult;
    try {
      saved = await this.docs.save(actor, {
        content,
        ...(row.docKey ? { key: row.docKey } : { source: row.source ?? '', path: row.path ?? '' }),
        ...(row.baseVersion ? { baseHash: row.baseVersion } : {}),
        reason: row.reason.slice(0, 300),
      });
    } catch (error) {
      const code = (error as { code?: string }).code ?? 'hub.common.unavailable';
      await this.refuse(actor, row, code);
      throw error;
    }
    const written = await this.txHost.tx.docDraft.update({
      where: { id: row.id, workspaceId: actor.workspaceId },
      data: {
        status: 'saved',
        claims,
        refusedCode: null,
        savedVersion: saved.hash,
        revisionId: saved.revisionId,
        docKey: saved.key,
      },
    });
    if (row.chatId)
      await this.turns.post(row.chatId, { kind: 'doc.draft.updated', draft: toDraftDto(written) });
    return saved;
  }

  /** `save_doc` with plain content: a turn's open draft of the same document must not be bypassed by writing the text directly. */
  async assertNoOpenDraftBypass(
    actor: MemberActor,
    toolUseId: string | undefined,
    target: { readonly key?: string | undefined; readonly path?: string | undefined },
  ): Promise<void> {
    const turn = await this.turns.panelTurn(actor, toolUseId);
    if (!turn) return;
    const rows = await this.txHost.tx.docDraft.findMany({
      where: { workspaceId: actor.workspaceId, chatId: turn.chatId, status: { in: ['open', 'refused'] } },
    });
    const same = rows.find(
      (row) =>
        (target.key !== undefined && row.docKey === target.key) ||
        (target.path !== undefined && row.path === target.path),
    );
    if (same && openFlags(same.claims as unknown as DocClaim[]).length > 0) {
      await this.refuse(actor, same, 'hub.docs.draft_flags_open');
      throw new AppException('hub.docs.draft_flags_open', {
        details: { draft: same.id },
      });
    }
  }

  private async refuse(actor: MemberActor, row: DraftRow, code: string): Promise<void> {
    const written = await this.txHost.tx.docDraft.update({
      where: { id: row.id, workspaceId: actor.workspaceId },
      data: { status: 'refused', refusedCode: code },
    });
    if (row.chatId)
      await this.turns.post(row.chatId, { kind: 'doc.draft.updated', draft: toDraftDto(written) });
  }

  private async draftOf(actor: MemberActor, id: string): Promise<DraftRow> {
    const row = z.uuid().safeParse(id).success
      ? await this.txHost.tx.docDraft.findFirst({
          where: { id, workspaceId: actor.workspaceId, userId: actor.userId },
        })
      : null;
    if (!row) throw new AppException('hub.docs.draft_not_found');
    return row;
  }

  /** Real documents with a similar title, with links, so the owner can check the claim (review M6). */
  private async duplicatesOf(
    actor: MemberActor,
    title: string,
    cardId: string | null,
  ): Promise<DocDuplicate[]> {
    const project = await this.projects.get(actor);
    const base = this.config.HUB_PUBLIC_URL.replace(/\/+$/, '');
    const hits = await this.docs.similar(actor, title, cardId);
    return hits.map((hit) => ({
      key: hit.key,
      title: hit.title,
      source: hit.source,
      path: hit.path,
      url: `${base}/${project.defaultLocale}/${project.slug}/docs?card=${encodeURIComponent(hit.key)}`,
      overlap: hit.overlap,
    }));
  }
}

function withAnswers(
  claims: readonly DocClaim[],
  answers: readonly { readonly id: string; readonly answer: ClaimAnswer }[],
): DocClaim[] {
  return claims.map((claim) => {
    const given = answers.find((item) => item.id === claim.id);
    return given && claim.status === 'unverified' ? { ...claim, answer: given.answer } : claim;
  });
}

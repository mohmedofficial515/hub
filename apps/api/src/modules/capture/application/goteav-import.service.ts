/**
 * @file The one-time Goteav import (docs/06 §7), idempotent on re-run.
 * @description The only writer allowed to set dates in the past, so it writes through `CardRepository` rather than
 * `CardService.apply`, whose clock is always now. Everything else `apply` promises still holds: the secret filter, one
 * transaction per card, an event per change, an audit row. No realtime message goes out: this runs before anyone
 * is watching. A card edited since its import is left alone and reported. `scripts/import-goteav.ts` reads the files,
 * so the API never reads a path itself.
 */
import { type Actor, isSettingKey, parseSetting, type SettingKey, type SystemActor } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';
import { CardRepository, type CardView, type JsonObject } from '@/modules/cards';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import {
  GOTEAV_ONBOARDING,
  type ImportCard,
  moduleCatalogue,
  parseContractChanges,
  parseDecisions,
  parseStatusFiles,
  parseSuggestions,
  type StatusFile,
} from '../domain/goteav-import';

export const DOCS_SOURCE_NAME = 'backend-docs';

export interface GoteavImportInput {
  readonly decisionsYaml: string;
  readonly suggestionsYaml: string;
  readonly statusFiles: readonly StatusFile[];
  readonly contractChangesMd: string | null;
  /** The backend docs folder on this machine, for the source doc cards belong to. */
  readonly docsPath: string;
  /** Local folders of the project, so a chat there lands on it (docs/15 §5). */
  readonly repoPaths?: readonly string[];
  readonly dryRun?: boolean;
}

export interface GoteavImportReport {
  readonly dryRun: boolean;
  readonly created: Readonly<Record<string, number>>;
  readonly updated: Readonly<Record<string, number>>;
  readonly unchanged: number;
  readonly skippedEdited: readonly string[];
  readonly problems: readonly string[];
}

function bump(counts: Record<string, number>, type: string): void {
  counts[type] = (counts[type] ?? 0) + 1;
}

@Injectable()
export class GoteavImportService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly cards: CardRepository,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async run(slug: string, input: GoteavImportInput): Promise<GoteavImportReport> {
    const now = this.clock.now();
    const workspace = await this.txHost.tx.workspace.findUnique({
      where: { slug },
      select: { id: true, repoPaths: true },
    });
    if (!workspace) throw new AppException('hub.workspaces.not_found');
    const actor: SystemActor = {
      kind: 'system',
      userId: null,
      via: 'import',
      workspaceId: workspace.id,
      roles: [],
    };
    const dryRun = input.dryRun === true;

    const source = dryRun ? null : await this.ensureDocsSource(workspace.id, input.docsPath, now);
    const parsed = [
      parseDecisions(input.decisionsYaml, now),
      parseSuggestions(input.suggestionsYaml, now),
      parseStatusFiles(input.statusFiles, DOCS_SOURCE_NAME, source?.id ?? 'dry-run', now),
      ...(input.contractChangesMd ? [parseContractChanges(input.contractChangesMd)] : []),
    ];
    const specs = parsed.flatMap((part) => part.cards);
    const problems = parsed.flatMap((part) => part.problems);
    const created: Record<string, number> = {};
    const updated: Record<string, number> = {};
    const skippedEdited: string[] = [];
    let unchanged = 0;
    const owner = await this.firstOwner(workspace.id);

    for (const spec of specs) {
      try {
        assertNoSecrets({ title: spec.title, body: spec.body, detail: spec.detail });
      } catch {
        problems.push(`${spec.externalKey} holds something like a secret, so it was not imported`);
        continue;
      }
      const existing = await this.findExisting(workspace.id, spec.externalKey);
      if (!existing) {
        if (!dryRun) await this.create(actor, spec, owner);
        bump(created, spec.type);
        continue;
      }
      if (existing.lastVia !== 'import') {
        skippedEdited.push(existing.card.key);
        continue;
      }
      if (existing.card.title === spec.title && existing.card.body === spec.body) {
        unchanged += 1;
        continue;
      }
      if (!dryRun) await this.refresh(existing.card, spec);
      bump(updated, spec.type);
    }

    if (!dryRun) {
      await this.linkRelated(workspace.id, specs);
      await this.seedProject(actor, workspace.repoPaths, input.repoPaths ?? [], specs);
      await this.txHost.tx.captureRun.create({
        data: {
          sourceId: (source as { id: string }).id,
          kind: 'import',
          startedAt: now,
          finishedAt: this.clock.now(),
          status: problems.length > 0 ? 'failed' : 'ok',
          created: Object.values(created).reduce((sum, count) => sum + count, 0),
          updated: Object.values(updated).reduce((sum, count) => sum + count, 0),
          cursorAfter: { created, updated, skippedEdited, problems },
        },
      });
      await this.audit.record(actor, {
        action: 'capture.import.goteav',
        targetType: 'workspace',
        targetId: workspace.id,
        summary: `Imported Goteav: ${JSON.stringify(created)}`,
      });
    }
    return { dryRun, created, updated, unchanged, skippedEdited, problems };
  }

  private async ensureDocsSource(workspaceId: string, docsPath: string, now: Date) {
    return this.txHost.tx.source.upsert({
      where: { workspaceId_name: { workspaceId, name: DOCS_SOURCE_NAME } },
      create: {
        workspaceId,
        kind: 'local_path',
        name: DOCS_SOURCE_NAME,
        config: { path: docsPath, purpose: 'docs' },
        createdAt: now,
      },
      update: {},
      select: { id: true },
    });
  }

  private async firstOwner(workspaceId: string): Promise<string | null> {
    const owner = await this.txHost.tx.membership.findFirst({
      where: { workspaceId, status: 'active', roles: { has: 'owner' } },
      orderBy: { joinedAt: 'asc' },
      select: { userId: true },
    });
    return owner?.userId ?? null;
  }

  private async findExisting(workspaceId: string, externalKey: string) {
    const row = await this.txHost.tx.card.findFirst({
      where: { workspaceId, externalKey },
      select: { id: true },
    });
    if (!row) return null;
    const card = await this.cards.findCard(workspaceId, { cardId: row.id });
    if (!card) return null;
    const last = await this.txHost.tx.cardEvent.findFirst({
      where: { workspaceId, cardId: row.id },
      orderBy: { seq: 'desc' },
      select: { via: true },
    });
    return { card, lastVia: last?.via ?? 'import' };
  }

  private create(actor: Actor, spec: ImportCard, owner: string | null): Promise<void> {
    return this.txHost.withTransaction(async () => {
      const decided = spec.detail['decidedAt'] && owner ? { decidedById: owner } : {};
      const card = await this.cards.insertCard({
        actor,
        type: spec.type,
        status: spec.status,
        closedAt: spec.closedAt ?? null,
        fields: {
          title: spec.title,
          body: spec.body,
          source: 'import',
          externalKey: spec.externalKey,
          tags: spec.tags,
          ...(spec.priority ? { priority: spec.priority } : {}),
          ...(spec.ownerRole === undefined ? {} : { ownerRole: spec.ownerRole }),
          ...(spec.module === undefined ? {} : { module: spec.module }),
          ...(spec.repo === undefined ? {} : { repo: spec.repo }),
          ...(spec.branch === undefined ? {} : { branch: spec.branch }),
          ...(spec.commitSha === undefined ? {} : { commitSha: spec.commitSha }),
          ...(spec.dueAt === undefined ? {} : { dueAt: spec.dueAt }),
        },
        detail: { ...(spec.detail as JsonObject), ...decided },
        now: spec.createdAt,
      });
      await this.cards.insertEvent({
        actor,
        card,
        kind: 'created',
        data: { snapshot: { title: card.title, status: card.status }, importedFrom: spec.externalKey },
        now: spec.createdAt,
      });
      let current = card;
      for (const event of spec.events) {
        const written = await this.cards.insertEvent({
          actor,
          card: current,
          kind: event.kind,
          data: { ...event.data },
          now: event.at,
        });
        current = { ...current, eventSeq: written.seq };
      }
    });
  }

  private refresh(card: CardView, spec: ImportCard): Promise<void> {
    return this.txHost.withTransaction(async () => {
      await this.cards.updateCard({
        card,
        status: card.status,
        closedAt: card.closedAt,
        patch: { title: spec.title, body: spec.body },
        detail: undefined,
        now: card.lastEventAt,
      });
    });
  }

  /** Runs every time: `relates` links between imported cards, skipping any already there. */
  private async linkRelated(workspaceId: string, specs: readonly ImportCard[]): Promise<void> {
    for (const spec of specs) {
      for (const other of spec.relates ?? []) {
        const [from, to] = await Promise.all([
          this.findExisting(workspaceId, spec.externalKey),
          this.findExisting(workspaceId, other),
        ]);
        if (!from || !to) continue;
        const edge = { fromCardId: from.card.id, toCardId: to.card.id, kind: 'relates' };
        if (!(await this.cards.findLink(from.card, edge))) await this.cards.insertLink(from.card, edge, null);
      }
    }
  }

  /** Only fills what is still empty, so a project someone has configured keeps its settings. */
  private async seedProject(
    actor: SystemActor,
    current: readonly string[],
    repoPaths: readonly string[],
    specs: readonly ImportCard[],
  ): Promise<void> {
    const { workspaceId } = actor;
    if (current.length === 0 && repoPaths.length > 0) {
      await this.txHost.tx.workspace.update({
        where: { id: workspaceId },
        data: { repoPaths: [...repoPaths] },
      });
    }
    await this.seedSetting(workspaceId, 'modules.catalogue', moduleCatalogue(specs));
    await this.seedSetting(workspaceId, 'onboarding.paths', GOTEAV_ONBOARDING);
  }

  private async seedSetting(workspaceId: string, key: SettingKey, value: unknown): Promise<void> {
    if (!isSettingKey(key)) return;
    const known = await this.txHost.tx.workspaceSetting.findUnique({
      where: { workspaceId_key: { workspaceId, key } },
      select: { key: true },
    });
    if (known) return;
    await this.txHost.tx.workspaceSetting.create({
      data: { workspaceId, key, value: parseSetting(key, value) as object },
    });
  }
}

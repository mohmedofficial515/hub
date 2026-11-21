/**
 * @file Schema Studio (docs/17): the source of a project's design, its snapshots, the Arabic names given to it and the drafts of changes.
 * @description A refresh reads the files, parses them and keeps a snapshot only when their hash changed. A refresh that names a draft closes it as applied, and marks every annotation whose Arabic name now
 * appears in its target's `///` text as synced. Every change is audited and announced as `schema.changed`, so every open page rereads it.
 */
import {
  type AnnotationInput,
  canMoveDraft,
  type CreateSchemaDraftInput,
  createSchemaDraftSchema,
  isOpenDraft,
  type MemberActor,
  type RefreshSchemaResult,
  type ReviewDraftResult,
  type SchemaAnnotationDto,
  type SchemaChange,
  type SchemaChanged,
  type SchemaChangeSummary,
  type SchemaDoc,
  type SchemaDraftDto,
  type SchemaDraftStatus,
  schemaReviewPrompt,
  type SchemaSnapshotRow,
  type SchemaSourceDto,
  type SchemaSourceInput,
  schemaSourceInputSchema,
  type SchemaStats,
  type SchemaStudioDto,
  type Sensitivity,
  type SnapshotTrigger,
  type UpdateSchemaDraftInput,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { z } from 'zod';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { RealtimePublisher } from '@/infra/redis/redis.module';
import { AuditService } from '@/modules/audit';
import { DevicesService } from '@/modules/devices';
import { ProjectsService } from '@/modules/workspaces';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { parsePrismaFiles } from '../domain/prisma-parse';
import { diffSchemas } from '../domain/snapshot-diff';
import { SchemaReader } from './schema-reader';

const CLOSED_DRAFTS_SHOWN = 10;

interface SourceRow {
  id: string;
  workspaceId: string;
  name: string;
  path: string;
  schemaDir: string;
  deviceId: string | null;
}

interface DraftRow {
  id: string;
  title: string;
  status: string;
  changes: unknown;
  review: string | null;
  chatId: string | null;
  baseSnapshotId: string | null;
  appliedSnapshotId: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const normal = (path: string, windows: boolean) => {
  const plain = path.replaceAll('\\', '/').replace(/\/+$/, '');
  return windows ? plain.toLowerCase() : plain;
};

/** The folder must be at or under one of the project's folders, the same rule as a chat's folder. */
export function isRegistered(folder: string, repoPaths: readonly string[]): boolean {
  if (/(^|[\\/])\.\.([\\/]|$)/.test(folder)) return false;
  const windows = /^[A-Za-z]:/.test(folder);
  const inner = normal(folder, windows);
  return repoPaths.some(
    (path) => inner === normal(path, windows) || inner.startsWith(`${normal(path, windows)}/`),
  );
}

/** The `///` text a target has in the files, to tell whether its Arabic name was written there. */
function docOf(schema: SchemaDoc, target: string): string | null {
  const [kind, name] = target.split(':') as [string, string];
  const [owner, member] = name.split('.') as [string, string | undefined];
  if (kind === 'model') return schema.models.find((model) => model.name === owner)?.doc ?? null;
  if (kind === 'field') {
    return (
      schema.models.find((model) => model.name === owner)?.fields.find((field) => field.name === member)
        ?.doc ?? null
    );
  }
  if (kind === 'enum') return schema.enums.find((value) => value.name === owner)?.doc ?? null;
  return (
    schema.enums.find((value) => value.name === owner)?.values.find((value) => value.name === member)?.doc ??
    null
  );
}

@Injectable()
export class SchemaStudioService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly reader: SchemaReader,
    private readonly projects: ProjectsService,
    private readonly devices: DevicesService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimePublisher,
  ) {}

  private get tx() {
    return this.txHost.tx;
  }

  private async announce(actor: MemberActor, what: SchemaChanged['what']): Promise<void> {
    const data: SchemaChanged = { what };
    await this.realtime.publishEnvelope(actor.workspaceId, {
      event: 'schema.changed',
      data,
      audience: 'all',
    });
  }

  private async names(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (wanted.length === 0) return new Map();
    const users = await this.tx.user.findMany({
      where: { id: { in: wanted } },
      select: { id: true, displayName: true },
    });
    return new Map(users.map((user) => [user.id, user.displayName]));
  }

  // ── The source ────────────────────────────────────────────────────────────────────────────────

  private async source(actor: MemberActor): Promise<SourceRow | null> {
    return this.tx.schemaSource.findFirst({
      where: { workspaceId: actor.workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async requireSource(actor: MemberActor): Promise<SourceRow> {
    const source = await this.source(actor);
    if (!source) throw new AppException('hub.schema.no_source');
    return source;
  }

  private sourceDto(source: SourceRow): SchemaSourceDto {
    return {
      id: source.id,
      name: source.name,
      path: source.path,
      schemaDir: source.schemaDir,
      deviceId: source.deviceId,
    };
  }

  async setSource(actor: MemberActor, raw: SchemaSourceInput): Promise<SchemaStudioDto> {
    const input = schemaSourceInputSchema.parse(raw);
    const project = await this.projects.get(actor);
    if (!isRegistered(input.path, project.repoPaths)) throw new AppException('hub.schema.folder_not_allowed');
    if (input.deviceId) await this.devices.owned(actor.userId, input.deviceId);
    const existing = await this.source(actor);
    const data = {
      name: input.name,
      path: input.path,
      schemaDir: input.schemaDir,
      deviceId: input.deviceId ?? null,
    };
    const moved = existing && (existing.path !== data.path || existing.schemaDir !== data.schemaDir);
    if (existing)
      await this.tx.schemaSource.update({ where: { id: existing.id, workspaceId: actor.workspaceId }, data });
    else await this.tx.schemaSource.create({ data: { ...data, workspaceId: actor.workspaceId } });
    await this.audit.record(actor, {
      action: 'schema.source.set',
      targetType: 'schema_source',
      targetId: existing?.id ?? null,
      summary:
        `Schema source ${input.name}: ${input.path}/${input.schemaDir}${moved ? ' (moved)' : ''}`.slice(
          0,
          500,
        ),
    });
    await this.announce(actor, 'source');
    await this.refresh(actor, {}, 'manual');
    return this.studio(actor);
  }

  // ── Reads ─────────────────────────────────────────────────────────────────────────────────────

  async studio(actor: MemberActor): Promise<SchemaStudioDto> {
    const source = await this.source(actor);
    if (!source) return { source: null, snapshot: null, annotations: [], drafts: [] };
    const [snapshot, annotations, drafts] = await Promise.all([
      this.tx.schemaSnapshot.findFirst({
        where: { workspaceId: source.workspaceId, sourceId: source.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.annotationsOf(source),
      this.draftsOf(source),
    ]);
    return {
      source: this.sourceDto(source),
      snapshot: snapshot
        ? {
            id: snapshot.id,
            hash: snapshot.hash,
            createdAt: snapshot.createdAt.toISOString(),
            trigger: snapshot.trigger as SnapshotTrigger,
            schema: snapshot.parsed as unknown as SchemaDoc,
            changes: (snapshot.changes as unknown as SchemaChangeSummary | null) ?? null,
          }
        : null,
      annotations,
      drafts,
    };
  }

  async latestSchema(
    actor: MemberActor,
  ): Promise<{ schema: SchemaDoc; annotations: SchemaAnnotationDto[]; source: SchemaSourceDto; at: string }> {
    const source = await this.requireSource(actor);
    let snapshot = await this.tx.schemaSnapshot.findFirst({
      where: { workspaceId: source.workspaceId, sourceId: source.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!snapshot) {
      await this.refresh(actor, {}, 'mcp');
      snapshot = await this.tx.schemaSnapshot.findFirst({
        where: { workspaceId: source.workspaceId, sourceId: source.id },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!snapshot) throw new AppException('hub.schema.unreadable');
    return {
      schema: snapshot.parsed as unknown as SchemaDoc,
      annotations: await this.annotationsOf(source),
      source: this.sourceDto(source),
      at: snapshot.createdAt.toISOString(),
    };
  }

  async snapshots(actor: MemberActor): Promise<SchemaSnapshotRow[]> {
    const source = await this.requireSource(actor);
    const rows = await this.tx.schemaSnapshot.findMany({
      where: { workspaceId: source.workspaceId, sourceId: source.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        hash: true,
        trigger: true,
        takenById: true,
        createdAt: true,
        stats: true,
        changes: true,
        draftId: true,
      },
    });
    const names = await this.names(rows.map((row) => row.takenById));
    return rows.map((row) => ({
      id: row.id,
      hash: row.hash,
      trigger: row.trigger as SnapshotTrigger,
      takenBy: row.takenById ? (names.get(row.takenById) ?? null) : null,
      createdAt: row.createdAt.toISOString(),
      stats: row.stats as unknown as SchemaStats,
      changes: (row.changes as unknown as SchemaChangeSummary | null) ?? null,
      draftId: row.draftId,
    }));
  }

  // ── Refresh ───────────────────────────────────────────────────────────────────────────────────

  async refresh(
    actor: MemberActor,
    input: { draftId?: string | undefined },
    trigger: SnapshotTrigger,
  ): Promise<RefreshSchemaResult> {
    const source = await this.requireSource(actor);
    const draft = input.draftId ? await this.draftRow(source, input.draftId) : null;
    if (draft && !isOpenDraft(draft.status as SchemaDraftStatus))
      throw new AppException('hub.schema.draft_wrong_state');

    const read = await this.reader.read(source);
    const latest = await this.tx.schemaSnapshot.findFirst({
      where: { workspaceId: source.workspaceId, sourceId: source.id },
      orderBy: { createdAt: 'desc' },
    });
    const schema = parsePrismaFiles(read.files);
    let snapshotId = latest?.id ?? '';
    let changes: SchemaChangeSummary | null = null;
    const created = !latest || latest.hash !== read.hash;
    if (created) {
      changes = latest ? diffSchemas(latest.parsed as unknown as SchemaDoc, schema) : null;
      const row = await this.tx.schemaSnapshot.create({
        data: {
          workspaceId: actor.workspaceId,
          sourceId: source.id,
          hash: read.hash,
          parsed: schema,
          stats: schema.stats,
          ...(changes ? { changes } : {}),
          trigger: draft ? 'after_apply' : trigger,
          takenById: actor.userId,
          draftId: draft?.id ?? null,
        },
      });
      snapshotId = row.id;
      // Keep the history to its limit, oldest out first.
      const old = await this.tx.schemaSnapshot.findMany({
        where: { workspaceId: source.workspaceId, sourceId: source.id },
        orderBy: { createdAt: 'desc' },
        skip: 50,
        select: { id: true },
      });
      if (old.length > 0)
        await this.tx.schemaSnapshot.deleteMany({
          where: { workspaceId: source.workspaceId, id: { in: old.map((entry) => entry.id) } },
        });
    }

    if (draft) {
      await this.tx.schemaDraft.update({
        where: { id: draft.id, workspaceId: source.workspaceId },
        data: { status: 'applied', appliedSnapshotId: snapshotId },
      });
      await this.markSynced(source, schema);
    }
    await this.audit.record(actor, {
      action: 'schema.refresh',
      targetType: 'schema_source',
      targetId: source.id,
      summary:
        `Schema ${source.name}: ${created ? `new snapshot, ${schema.stats.models} models` : 'unchanged'}${draft ? `, applied draft "${draft.title}"` : ''}`.slice(
          0,
          500,
        ),
    });
    if (created || draft) await this.announce(actor, created ? 'snapshot' : 'draft');
    return { snapshotId, created, changes, stats: schema.stats };
  }

  private async markSynced(source: SourceRow, schema: SchemaDoc): Promise<void> {
    const rows = await this.tx.schemaAnnotation.findMany({
      where: { workspaceId: source.workspaceId, sourceId: source.id, nameAr: { not: null } },
    });
    const synced = rows.filter((row) => row.nameAr && (docOf(schema, row.target) ?? '').includes(row.nameAr));
    if (synced.length > 0) {
      await this.tx.schemaAnnotation.updateMany({
        where: { workspaceId: source.workspaceId, id: { in: synced.map((row) => row.id) } },
        data: { syncedAt: new Date() },
      });
    }
  }

  // ── Annotations ───────────────────────────────────────────────────────────────────────────────

  private async annotationsOf(source: SourceRow): Promise<SchemaAnnotationDto[]> {
    const rows = await this.tx.schemaAnnotation.findMany({
      where: { workspaceId: source.workspaceId, sourceId: source.id },
      orderBy: { target: 'asc' },
    });
    const names = await this.names(rows.map((row) => row.updatedById));
    return rows.map((row) => ({
      target: row.target,
      nameAr: row.nameAr,
      descriptionAr: row.descriptionAr,
      notes: row.notes,
      tags: row.tags,
      sensitivity: row.sensitivity as Sensitivity,
      updatedBy: row.updatedById ? (names.get(row.updatedById) ?? null) : null,
      updatedAt: row.updatedAt.toISOString(),
      syncedAt: row.syncedAt && row.syncedAt >= row.updatedAt ? row.syncedAt.toISOString() : null,
    }));
  }

  async putAnnotations(
    actor: MemberActor,
    annotations: readonly AnnotationInput[],
  ): Promise<SchemaAnnotationDto[]> {
    assertNoSecrets(annotations);
    const source = await this.requireSource(actor);
    for (const entry of annotations) {
      const change = {
        ...(entry.nameAr === undefined ? {} : { nameAr: entry.nameAr || null }),
        ...(entry.descriptionAr === undefined ? {} : { descriptionAr: entry.descriptionAr || null }),
        ...(entry.notes === undefined ? {} : { notes: entry.notes || null }),
        ...(entry.tags === undefined ? {} : { tags: [...new Set(entry.tags)] }),
        ...(entry.sensitivity === undefined ? {} : { sensitivity: entry.sensitivity }),
        updatedById: actor.userId,
      };
      await this.tx.schemaAnnotation.upsert({
        where: {
          sourceId_target: { sourceId: source.id, target: entry.target },
          workspaceId: source.workspaceId,
        },
        create: { workspaceId: actor.workspaceId, sourceId: source.id, target: entry.target, ...change },
        update: change,
      });
    }
    await this.audit.record(actor, {
      action: 'schema.annotate',
      targetType: 'schema_source',
      targetId: source.id,
      summary: `Named ${annotations.length} in ${source.name}: ${annotations
        .slice(0, 5)
        .map((entry) => entry.target)
        .join(', ')}${annotations.length > 5 ? '…' : ''}`.slice(0, 500),
    });
    await this.announce(actor, 'annotations');
    return this.annotationsOf(source);
  }

  // ── Drafts ────────────────────────────────────────────────────────────────────────────────────

  private async draftRow(source: SourceRow, id: string): Promise<DraftRow> {
    if (!z.uuid().safeParse(id).success) throw new AppException('hub.schema.draft_not_found');
    const row = await this.tx.schemaDraft.findFirst({
      where: { id, workspaceId: source.workspaceId, sourceId: source.id },
    });
    if (!row) throw new AppException('hub.schema.draft_not_found');
    return row;
  }

  private async toDrafts(rows: readonly DraftRow[]): Promise<SchemaDraftDto[]> {
    const names = await this.names(rows.map((row) => row.createdById));
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status as SchemaDraftStatus,
      changes: (row.changes as SchemaChange[]) ?? [],
      review: row.review,
      chatId: row.chatId,
      baseSnapshotId: row.baseSnapshotId,
      appliedSnapshotId: row.appliedSnapshotId,
      createdBy: row.createdById ? (names.get(row.createdById) ?? null) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  private async draftsOf(source: SourceRow): Promise<SchemaDraftDto[]> {
    const [open, closed] = await Promise.all([
      this.tx.schemaDraft.findMany({
        where: {
          workspaceId: source.workspaceId,
          sourceId: source.id,
          status: { in: ['editing', 'in_review', 'applying'] },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.tx.schemaDraft.findMany({
        where: {
          workspaceId: source.workspaceId,
          sourceId: source.id,
          status: { in: ['applied', 'discarded'] },
        },
        orderBy: { updatedAt: 'desc' },
        take: CLOSED_DRAFTS_SHOWN,
      }),
    ]);
    return this.toDrafts([...open, ...closed]);
  }

  async draft(actor: MemberActor, id: string): Promise<SchemaDraftDto> {
    const source = await this.requireSource(actor);
    const [dto] = await this.toDrafts([await this.draftRow(source, id)]);
    return dto as SchemaDraftDto;
  }

  async createDraft(actor: MemberActor, raw: CreateSchemaDraftInput): Promise<SchemaDraftDto> {
    const input = createSchemaDraftSchema.parse(raw);
    assertNoSecrets(input.changes);
    const source = await this.requireSource(actor);
    const latest = await this.tx.schemaSnapshot.findFirst({
      where: { workspaceId: source.workspaceId, sourceId: source.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const row = await this.tx.schemaDraft.create({
      data: {
        workspaceId: actor.workspaceId,
        sourceId: source.id,
        title: input.title,
        changes: input.changes,
        baseSnapshotId: latest?.id ?? null,
        createdById: actor.userId,
      },
    });
    await this.audit.record(actor, {
      action: 'schema.draft.create',
      targetType: 'schema_draft',
      targetId: row.id,
      summary: `Draft "${input.title}"`.slice(0, 500),
    });
    await this.announce(actor, 'draft');
    return (await this.toDrafts([row]))[0] as SchemaDraftDto;
  }

  async updateDraft(actor: MemberActor, id: string, input: UpdateSchemaDraftInput): Promise<SchemaDraftDto> {
    assertNoSecrets(input);
    const source = await this.requireSource(actor);
    const row = await this.draftRow(source, id);
    const from = row.status as SchemaDraftStatus;
    if (!isOpenDraft(from)) throw new AppException('hub.schema.draft_wrong_state');
    if (input.status && input.status !== from && !canMoveDraft(from, input.status)) {
      throw new AppException('hub.schema.draft_wrong_state');
    }
    const updated = await this.tx.schemaDraft.update({
      where: { id: row.id, workspaceId: source.workspaceId },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.changes === undefined ? {} : { changes: input.changes }),
        ...(input.review === undefined ? {} : { review: input.review }),
        ...(input.status === undefined ? {} : { status: input.status }),
      },
    });
    await this.audit.record(actor, {
      action: 'schema.draft.update',
      targetType: 'schema_draft',
      targetId: row.id,
      summary:
        `Draft "${updated.title}"${input.status && input.status !== from ? `: ${from} to ${input.status}` : ''}`.slice(
          0,
          500,
        ),
    });
    await this.announce(actor, 'draft');
    return (await this.toDrafts([updated]))[0] as SchemaDraftDto;
  }

  /** The owner's press: the draft goes to review, and the page sends the prompt to the panel in Plan. */
  async review(actor: MemberActor, id: string): Promise<ReviewDraftResult> {
    const source = await this.requireSource(actor);
    const row = await this.draftRow(source, id);
    const from = row.status as SchemaDraftStatus;
    if (from !== 'in_review' && !canMoveDraft(from, 'in_review'))
      throw new AppException('hub.schema.draft_wrong_state');
    const draft =
      from === 'in_review'
        ? ((await this.toDrafts([row]))[0] as SchemaDraftDto)
        : await this.updateDraft(actor, id, { status: 'in_review' });
    return { draft, prompt: schemaReviewPrompt(draft, source) };
  }

  async attachChat(actor: MemberActor, id: string, chatId: string): Promise<SchemaDraftDto> {
    const source = await this.requireSource(actor);
    const row = await this.draftRow(source, id);
    const updated = await this.tx.schemaDraft.update({
      where: { id: row.id, workspaceId: source.workspaceId },
      data: { chatId },
    });
    await this.announce(actor, 'draft');
    return (await this.toDrafts([updated]))[0] as SchemaDraftDto;
  }
}

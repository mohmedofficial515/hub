/**
 * @file Sources (docs/04 §3.7, docs/15 §3): what Hub reads from, including `local_path` folders.
 * @description A secret is encrypted on the way in and leaves only through `readSecret`, which the capture
 * adapters use. `toDto` lists the fields a response may carry, so it can never echo one. Setting a secret is
 * for the web only (docs/15 §2), so an API token that sends one is refused. Deleting is soft (docs/04 §3.7).
 */
import { readdir } from 'node:fs/promises';

import {
  type CreateSourceInput,
  type MemberActor,
  SOURCE_CONFIG_SCHEMAS,
  SOURCE_KINDS,
  type SourceDto,
  type SourceKind,
  type UpdateSourceInput,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { Prisma } from '@/generated/prisma/client';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';
import { AppException } from '@/shared/errors';
import { SecretCipher } from '@/shared/security/secret-cipher';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { ProjectGate } from './project-gate';

interface SourceRow {
  id: string;
  kind: string;
  name: string;
  config: unknown;
  secretEnc: string | null;
  enabled: boolean;
  cursor: unknown;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

export interface SourceSecret {
  readonly read: string;
  readonly write?: string;
}

function isKind(kind: string): kind is SourceKind {
  return (SOURCE_KINDS as readonly string[]).includes(kind);
}

function isDeleted(row: { config: unknown }): boolean {
  return typeof (row.config as { deletedAt?: unknown } | null)?.deletedAt === 'string';
}

function parseConfig(kind: SourceKind, config: unknown): Prisma.InputJsonValue {
  const parsed = SOURCE_CONFIG_SCHEMAS[kind].safeParse(config);
  if (!parsed.success) {
    throw new AppException('hub.common.validation', {
      details: {
        issues: parsed.error.issues.map((issue) => ({
          path: ['config', ...issue.path.map(String)].join('.'),
          message: issue.message,
        })),
      },
    });
  }
  assertNoSecrets({ config: parsed.data });
  return parsed.data;
}

@Injectable()
export class SourcesService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly audit: AuditService,
    private readonly gate: ProjectGate,
    private readonly cipher: SecretCipher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(workspaceId: string): Promise<SourceDto[]> {
    const rows = await this.txHost.tx.source.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.filter((row) => !isDeleted(row)).map((row) => this.toDto(row));
  }

  async get(workspaceId: string, id: string): Promise<SourceDto> {
    return this.toDto(await this.found(workspaceId, id));
  }

  async create(actor: MemberActor, input: CreateSourceInput): Promise<SourceDto> {
    this.assertMaySetSecret(actor, input.secret);
    await this.gate.assertOpen(actor.workspaceId);
    if (!isKind(input.kind)) throw new AppException('hub.workspaces.source_kind_invalid');
    const config = parseConfig(input.kind, input.config);
    await this.assertDependency(actor.workspaceId, input.kind, config);
    return this.txHost.withTransaction(async () => {
      const row = await this.txHost.tx.source.create({
        data: {
          workspaceId: actor.workspaceId,
          kind: input.kind,
          name: input.name,
          config,
          createdAt: this.clock.now(),
          ...(input.secret === undefined ? {} : { secretEnc: this.seal(input.secret) }),
        },
      });
      await this.audit.record(actor, {
        action: 'sources.create',
        targetType: 'source',
        targetId: row.id,
        summary: `Added ${input.kind} source ${input.name}`,
      });
      return this.toDto(row);
    });
  }

  async update(actor: MemberActor, id: string, input: UpdateSourceInput): Promise<SourceDto> {
    this.assertMaySetSecret(actor, input.secret);
    await this.gate.assertOpen(actor.workspaceId);
    const current = await this.found(actor.workspaceId, id);
    const config =
      input.config === undefined ? undefined : parseConfig(current.kind as SourceKind, input.config);
    if (config !== undefined) {
      await this.assertDependency(actor.workspaceId, current.kind as SourceKind, config);
    }
    return this.txHost.withTransaction(async () => {
      const row = await this.txHost.tx.source.update({
        where: { id, workspaceId: actor.workspaceId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(config === undefined ? {} : { config }),
          ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
          ...(input.secret === undefined
            ? {}
            : { secretEnc: input.secret === null ? null : this.seal(input.secret) }),
        },
      });
      // Which fields changed, never their values: `secret` must not reach the log.
      const changed = Object.keys(input).join(', ');
      await this.audit.record(actor, {
        action: 'sources.update',
        targetType: 'source',
        targetId: id,
        summary: `Changed ${changed || 'nothing'}`,
      });
      return this.toDto(row);
    });
  }

  /** Soft: the row stays for its capture history, and the name becomes free again. */
  async remove(actor: MemberActor, id: string): Promise<void> {
    await this.gate.assertOpen(actor.workspaceId);
    const current = await this.found(actor.workspaceId, id);
    const now = this.clock.now();
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.source.update({
        where: { id, workspaceId: actor.workspaceId },
        data: {
          enabled: false,
          secretEnc: null,
          name: `${current.name}~${now.getTime()}`,
          config: {
            ...(current.config as Prisma.JsonObject),
            deletedAt: now.toISOString(),
          },
        },
      });
      await this.audit.record(actor, {
        action: 'sources.delete',
        targetType: 'source',
        targetId: id,
        summary: `Deleted source ${current.name}`,
      });
    });
  }

  /**
   * Tests that the source can be reached. `local_path` lists the folder. The GitHub kinds need a token and
   * arrive with H2-01, so they say so instead of pretending.
   */
  async test(actor: MemberActor, id: string): Promise<{ ok: boolean; details: { filesFound?: number } }> {
    const source = await this.found(actor.workspaceId, id);
    if (source.kind !== 'local_path') {
      throw new AppException('hub.workspaces.source_connection_failed', {
        details: { reason: 'not_available_in_this_release' },
      });
    }
    const { path } = source.config as { path: string };
    try {
      const files = await readdir(path, { recursive: true });
      return { ok: true, details: { filesFound: files.length } };
    } catch (cause) {
      throw new AppException('hub.workspaces.source_connection_failed', {
        details: { reason: 'folder_unreadable' },
        cause,
      });
    }
  }

  /** The decrypted secret, for capture adapters only. Never put it in a response, log or event. */
  async readSecret(workspaceId: string, id: string): Promise<SourceSecret | null> {
    const row = await this.txHost.tx.source.findUnique({
      where: { id, workspaceId },
      select: { secretEnc: true },
    });
    return row?.secretEnc ? (JSON.parse(this.cipher.decrypt(row.secretEnc)) as SourceSecret) : null;
  }

  private seal(secret: string): string {
    return this.cipher.encrypt(JSON.stringify({ read: secret } satisfies SourceSecret));
  }

  private assertMaySetSecret(actor: MemberActor, secret: string | null | undefined): void {
    if (secret !== undefined && actor.kind !== 'user') {
      throw new AppException('hub.identity.token_scope');
    }
  }

  /** `openapi` and `docs_folder` read through a `github_repo` source of the same project. */
  private async assertDependency(
    workspaceId: string,
    kind: SourceKind,
    config: Prisma.InputJsonValue,
  ): Promise<void> {
    if (kind !== 'openapi' && kind !== 'docs_folder') return;
    const { repoSourceId } = config as { repoSourceId: string };
    const repo = await this.txHost.tx.source.findUnique({
      where: { id: repoSourceId, workspaceId },
      select: { kind: true, config: true },
    });
    if (!repo || repo.kind !== 'github_repo' || isDeleted(repo)) {
      throw new AppException('hub.workspaces.source_dependency_missing');
    }
  }

  private async found(workspaceId: string, id: string): Promise<SourceRow> {
    const row = await this.txHost.tx.source.findUnique({ where: { id, workspaceId } });
    if (!row || isDeleted(row)) throw new AppException('hub.common.not_found');
    return row;
  }

  private toDto(row: SourceRow): SourceDto {
    const now = this.clock.now().getTime();
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      config: row.config as Record<string, unknown>,
      hasSecret: row.secretEnc !== null,
      enabled: row.enabled,
      cursor: row.cursor as Record<string, unknown>,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
      lastError: row.lastError,
      lagSec: row.lastSuccessAt ? Math.round((now - row.lastSuccessAt.getTime()) / 1000) : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

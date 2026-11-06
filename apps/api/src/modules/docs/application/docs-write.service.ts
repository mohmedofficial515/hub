/**
 * @file `save_doc` (docs/16 §10): writes a local-path document on the device holding it, keeps the earlier text as a revision that can be restored, and refuses a save based on an older version. No Git commit.
 * @description Only a Markdown file under a registered docs source, with the path checked and links resolved. The API writes the file itself when the folder is on its own machine, and asks the bridge when the source names a device. One advisory lock per file holds the read, compare and write together, so two saves cannot both pass the check.
 * A save writes the revision first, in the transaction, so a failed write leaves the database as it was. A similar existing document is a warning in the answer, not a refusal: the owner may mean to write a second one.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import {
  type Actor,
  type DocRevisionDetail,
  type DocRevisionSummary,
  type LocalPathSourceConfig,
  localPathSourceConfigSchema,
  type MemberActor,
  type SaveDocInput,
  type SaveDocResult,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { z } from 'zod';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';
import { CardQueryService } from '@/modules/cards';
import { BridgeHub } from '@/modules/devices';
import { SearchService } from '@/modules/search';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { splitFrontMatter, titleOf } from '../domain/markdown';
import { DocsIndexerService } from './docs-indexer.service';

const MAX_DOC_BYTES = 2_000_000;
const SIMILAR_LIMIT = 3;
const BRIDGE_TIMEOUT_MS = 30_000;
const REVISIONS_LIMIT = 100;

interface SourceRow {
  readonly id: string;
  readonly name: string;
  readonly workspaceId: string;
  readonly config: LocalPathSourceConfig;
}

const hashOf = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex');

/** A path inside a root, in posix form, or an error. Pure, so the rule has its own test. */
export function safeDocPath(path: string): string {
  const plain = path.replaceAll('\\', '/').replace(/^\.\//, '');
  const bad =
    plain === '' ||
    plain.includes('\0') ||
    isAbsolute(path) ||
    /^[A-Za-z]:/.test(plain) ||
    plain.startsWith('/') ||
    plain.split('/').some((part) => part === '..' || part === '' || part.startsWith('.')) ||
    !/\.mdx?$/i.test(plain);
  if (bad) throw new AppException('hub.docs.bad_path');
  return plain;
}

@Injectable()
export class DocsWriteService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly query: CardQueryService,
    private readonly indexer: DocsIndexerService,
    private readonly search: SearchService,
    private readonly audit: AuditService,
    private readonly hub: BridgeHub,
  ) {}

  async save(actor: MemberActor, input: SaveDocInput): Promise<SaveDocResult> {
    assertNoSecrets({ content: input.content, reason: input.reason });
    if (Buffer.byteLength(input.content) > MAX_DOC_BYTES) throw new AppException('hub.docs.too_large');
    const place = await this.placeOf(actor, input);
    const similar = await this.similarTo(actor, input, place.cardId);
    const saved = await this.write(actor, place.source, place.path, input.content, {
      baseHash: input.baseHash ?? null,
      reason: input.reason ?? null,
      keepFrontMatter: true,
    });
    return { ...saved, similar };
  }

  async revisions(actor: Actor, key: string): Promise<DocRevisionSummary[]> {
    const card = await this.docCard(actor, key);
    const rows = await this.txHost.tx.docRevision.findMany({
      where: { workspaceId: actor.workspaceId, docCardId: card.id },
      orderBy: { createdAt: 'desc' },
      take: REVISIONS_LIMIT,
      select: { id: true, contentHash: true, reason: true, savedById: true, createdAt: true, content: true },
    });
    return rows.map((row) => ({
      id: row.id,
      contentHash: row.contentHash,
      reason: row.reason,
      savedById: row.savedById,
      createdAt: row.createdAt.toISOString(),
      chars: row.content.length,
    }));
  }

  async revision(actor: Actor, key: string, id: string): Promise<DocRevisionDetail> {
    const card = await this.docCard(actor, key);
    const row = await this.revisionRow(actor, card.id, id);
    return {
      id: row.id,
      contentHash: row.contentHash,
      reason: row.reason,
      savedById: row.savedById,
      createdAt: row.createdAt.toISOString(),
      chars: row.content.length,
      content: row.content,
    };
  }

  /** A restore is a save: what is there now becomes a revision of its own, so a restore can be undone. */
  async restore(actor: MemberActor, key: string, id: string, baseHash?: string): Promise<SaveDocResult> {
    const card = await this.docCard(actor, key);
    const row = await this.revisionRow(actor, card.id, id);
    const source = await this.sourceOf(actor.workspaceId, String(card.detail?.['sourceId']));
    const path = safeDocPath(String(card.detail?.['path']));
    const saved = await this.write(actor, source, path, row.content, {
      baseHash: baseHash ?? null,
      reason: `Restored the revision of ${row.createdAt.toISOString()}`,
      keepFrontMatter: false,
      anyBase: baseHash === undefined,
    });
    return { ...saved, similar: [] };
  }

  private async revisionRow(actor: Actor, cardId: string, id: string) {
    if (!z.uuid().safeParse(id).success) throw new AppException('hub.docs.revision_not_found');
    const row = await this.txHost.tx.docRevision.findFirst({
      where: { id, workspaceId: actor.workspaceId, docCardId: cardId },
    });
    if (!row) throw new AppException('hub.docs.revision_not_found');
    return row;
  }

  private async docCard(actor: Actor, key: string) {
    const card = await this.query.readable(actor, { cardKey: key }).catch((cause: unknown) => {
      throw new AppException('hub.docs.not_found', { cause });
    });
    if (card.type !== 'doc') throw new AppException('hub.docs.not_found');
    return card;
  }

  private async sourceOf(workspaceId: string, id: string): Promise<SourceRow> {
    const row = await this.txHost.tx.source.findFirst({ where: { id, workspaceId } });
    return this.asDocsSource(row);
  }

  private asDocsSource(
    row: { id: string; name: string; workspaceId: string; kind: string; config: unknown } | null,
  ): SourceRow {
    if (!row) throw new AppException('hub.docs.source_not_writable');
    const config = localPathSourceConfigSchema.safeParse(row.config);
    if (row.kind !== 'local_path' || !config.success || config.data.purpose !== 'docs') {
      throw new AppException('hub.docs.source_not_writable');
    }
    return { id: row.id, name: row.name, workspaceId: row.workspaceId, config: config.data };
  }

  /** Where this save goes: an existing doc by key, or a source and a path, which may be a new file. */
  private async placeOf(
    actor: Actor,
    input: SaveDocInput,
  ): Promise<{ source: SourceRow; path: string; cardId: string | null }> {
    if (input.key) {
      const card = await this.docCard(actor, input.key);
      const source = await this.sourceOf(actor.workspaceId, String(card.detail?.['sourceId']));
      return { source, path: safeDocPath(String(card.detail?.['path'])), cardId: card.id };
    }
    const row = await this.txHost.tx.source.findFirst({
      where: { workspaceId: actor.workspaceId, name: input.source ?? '' },
    });
    const source = this.asDocsSource(row);
    const path = safeDocPath(input.path ?? '');
    const existing = await this.txHost.tx.docDetail.findFirst({
      where: { sourceId: source.id, path },
      select: { cardId: true },
    });
    return { source, path, cardId: existing?.cardId ?? null };
  }

  private async similarTo(
    actor: Actor,
    input: SaveDocInput,
    cardId: string | null,
  ): Promise<SaveDocResult['similar']> {
    const title = titleOf(splitFrontMatter(input.content).body, '').trim();
    if (title.length < 2) return [];
    const hits = await this.search.docs(actor, title.slice(0, 200), undefined, SIMILAR_LIMIT + 1);
    return hits
      .filter((hit) => hit.card.id !== cardId)
      .slice(0, SIMILAR_LIMIT)
      .map((hit) => ({ key: hit.card.key, title: hit.card.title, path: hit.path, source: hit.source }));
  }

  private async write(
    actor: MemberActor,
    source: SourceRow,
    path: string,
    text: string,
    options: {
      baseHash: string | null;
      reason: string | null;
      keepFrontMatter: boolean;
      anyBase?: boolean;
    },
  ): Promise<Omit<SaveDocResult, 'similar'>> {
    const { workspaceId } = actor;
    const outcome = await this.txHost.withTransaction(async () => {
      await this.txHost.tx
        .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`doc:${source.id}:${path}`}, 0))`;
      const current = await this.readFile(source, path);
      // A revision is stored, and Hub stores no secret. The file stays as it is, and the owner removes the value by hand.
      assertNoSecrets({ current: current.text });
      if (current.exists && !options.anyBase && !options.baseHash) {
        throw new AppException('hub.docs.base_required');
      }
      if (!options.anyBase && current.hash !== options.baseHash) {
        throw new AppException('hub.docs.stale_base', { details: { currentHash: current.hash } });
      }
      // The file's front matter is not the writer's to lose: `get_doc` shows the text without it.
      const next = options.keepFrontMatter && current.text ? withFrontMatterOf(current.text, text) : text;
      if (current.exists && current.hash === hashOf(next)) {
        return { unchanged: true, hash: current.hash ?? hashOf(next), revisionId: null, text: next };
      }
      let revisionId: string | null = null;
      const detail = await this.txHost.tx.docDetail.findFirst({
        where: { sourceId: source.id, path },
        select: { cardId: true },
      });
      if (current.exists && detail) {
        const revision = await this.txHost.tx.docRevision.create({
          data: {
            workspaceId,
            docCardId: detail.cardId,
            contentHash: current.hash ?? '',
            content: current.text ?? '',
            reason: options.reason,
            savedById: actor.userId,
          },
        });
        revisionId = revision.id;
      }
      const hash = await this.writeFile(source, path, next, current.hash);
      await this.audit.record(actor, {
        action: 'docs.save',
        targetType: 'doc',
        targetId: detail?.cardId ?? null,
        summary: `Saved ${source.name}/${path}`.slice(0, 500),
      });
      return { unchanged: false, hash, revisionId, text: next };
    });
    const indexed = await this.indexer.indexOne(source, path, Buffer.from(outcome.text));
    return {
      path,
      source: source.name,
      key: indexed.key,
      hash: outcome.hash,
      revisionId: outcome.revisionId,
      unchanged: outcome.unchanged,
      withheld: indexed.withheld,
    };
  }

  private async readFile(
    source: SourceRow,
    path: string,
  ): Promise<{ exists: boolean; text: string | null; hash: string | null }> {
    if (source.config.deviceId) {
      if (!this.hub.isOnline(source.config.deviceId)) throw new AppException('hub.docs.unavailable');
      return this.hub.request(
        source.config.deviceId,
        'doc.read',
        { root: source.config.path, path },
        { timeoutMs: BRIDGE_TIMEOUT_MS },
      );
    }
    const file = this.localFile(source, path);
    if (!existsSync(file)) return { exists: false, text: null, hash: null };
    const bytes = await readFile(file);
    return { exists: true, text: bytes.toString('utf8'), hash: hashOf(bytes) };
  }

  private async writeFile(
    source: SourceRow,
    path: string,
    text: string,
    baseHash: string | null,
  ): Promise<string> {
    if (source.config.deviceId) {
      const answer = await this.hub.request<{ outcome: string; hash: string | null }>(
        source.config.deviceId,
        'doc.write',
        { root: source.config.path, path, text, baseHash },
        { timeoutMs: BRIDGE_TIMEOUT_MS },
      );
      if (answer.outcome !== 'written' || !answer.hash) {
        throw new AppException('hub.docs.stale_base', { details: { currentHash: answer.hash } });
      }
      return answer.hash;
    }
    const file = this.localFile(source, path);
    mkdirSync(dirname(file), { recursive: true });
    const temp = join(dirname(file), `.hub-${randomUUID()}.tmp`);
    try {
      await writeFile(temp, text);
      await rename(temp, file);
    } finally {
      await rm(temp, { force: true });
    }
    return hashOf(text);
  }

  /** The file under this root, with links resolved: a link inside a source cannot lead out of it. */
  private localFile(source: SourceRow, path: string): string {
    const root = source.config.path;
    if (!existsSync(root)) throw new AppException('hub.docs.unavailable');
    const file = resolve(root, path);
    let folder = dirname(file);
    while (!existsSync(folder)) folder = dirname(folder);
    const inner = relative(realpathSync.native(root), realpathSync.native(folder));
    if (inner.startsWith('..') || isAbsolute(inner)) throw new AppException('hub.docs.bad_path');
    return file;
  }
}

function withFrontMatterOf(current: string, text: string): string {
  const { frontMatter } = splitFrontMatter(current);
  if (!frontMatter || splitFrontMatter(text).frontMatter) return text;
  return `${frontMatter}${text}`;
}

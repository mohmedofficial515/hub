/**
 * @file Indexes a `local_path` docs source (docs/06 §6, docs/15 §3): each Markdown file is a `doc` card with chunks.
 * @description A file's hash decides whether it changed. Card ids stay stable across re-indexing, so links survive.
 * A file that looks like it holds a secret is left out and counted: Hub never stores one. The card goes through
 * `CardService.apply`; its chunks are replaced in their own transaction, and a failure there leaves the old hash, so the
 * next run repairs it.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';

import type { LocalPathSourceConfig, SystemActor } from '@hub/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardService } from '@/modules/cards';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import {
  type Chunk,
  chunksOf,
  headingsOf,
  kindOf,
  langOf,
  matchesGlob,
  stripFrontMatter,
  titleOf,
  wordCountOf,
} from '../domain/markdown';

const ALWAYS_EXCLUDED = ['**/node_modules/**', 'node_modules/**', '.git/**', '**/.git/**'];
const MAX_FILE_BYTES = 2_000_000;
const DOC_KINDS_ALLOWED = new Set(['doc', 'adr', 'status', 'readme', 'other']);

export interface IndexResult {
  readonly created: number;
  readonly updated: number;
  readonly removed: number;
  readonly unchanged: number;
  /** Files left out because they look like they hold a secret. */
  readonly withheld: readonly string[];
}

export interface IndexableSource {
  readonly id: string;
  readonly name: string;
  readonly workspaceId: string;
  readonly config: LocalPathSourceConfig;
}

interface KnownDoc {
  readonly id: string;
  readonly status: string;
  readonly doc: { readonly path: string; readonly contentHash: string | null } | null;
}

const toPosix = (path: string): string => path.split(sep).join('/');

@Injectable()
export class DocsIndexerService {
  private readonly logger = new Logger(DocsIndexerService.name);

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly cards: CardService,
  ) {}

  private async listFiles(source: IndexableSource): Promise<string[]> {
    const root = source.config.path;
    const entries = await readdir(root, { recursive: true, withFileTypes: true });
    const include = source.config.include?.length ? source.config.include : ['**/*.md'];
    const exclude = [...ALWAYS_EXCLUDED, ...(source.config.exclude ?? [])];
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => toPosix(relative(root, join(entry.parentPath, entry.name))))
      .filter(
        (path) =>
          include.some((glob) => matchesGlob(path, glob)) && !exclude.some((glob) => matchesGlob(path, glob)),
      )
      .sort();
  }

  private async replaceChunks(workspaceId: string, cardId: string, chunks: readonly Chunk[]): Promise<void> {
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.docChunk.deleteMany({ where: { workspaceId, docCardId: cardId } });
      if (chunks.length === 0) return;
      await this.txHost.tx.docChunk.createMany({
        data: chunks.map((chunk, ordinal) => ({
          workspaceId,
          docCardId: cardId,
          ordinal,
          heading: chunk.heading,
          anchor: chunk.anchor,
          content: chunk.content,
        })),
      });
    });
  }

  async index(source: IndexableSource): Promise<IndexResult> {
    const { workspaceId } = source;
    const actor: SystemActor = { kind: 'system', userId: null, via: 'adapter', workspaceId, roles: [] };
    const files = await this.listFiles(source);
    const known = await this.txHost.tx.card.findMany({
      where: { workspaceId, type: 'doc', doc: { sourceId: source.id } },
      select: { id: true, status: true, doc: { select: { path: true, contentHash: true } } },
    });
    const byPath = new Map(known.map((card) => [card.doc?.path ?? '', card]));
    const result = { created: 0, updated: 0, removed: 0, unchanged: 0, withheld: [] as string[] };

    for (const path of files) {
      const raw = await readFile(join(source.config.path, path));
      if (raw.length > MAX_FILE_BYTES) continue;
      const outcome = await this.indexFile(source, actor, path, raw, byPath.get(path));
      if (outcome === 'withheld') result.withheld.push(path);
      else result[outcome] += 1;
    }

    const onDisk = new Set(files);
    for (const card of known) {
      if (!card.doc || onDisk.has(card.doc.path) || card.status === 'removed') continue;
      await this.cards.apply(actor, { cardId: card.id }, 'doc.mark_removed', {});
      await this.txHost.tx.docChunk.deleteMany({ where: { workspaceId, docCardId: card.id } });
      result.removed += 1;
    }
    if (result.withheld.length > 0) {
      this.logger.warn(`${source.name}: ${result.withheld.length} files look like they hold a secret`);
    }
    return result;
  }

  /** One file just saved (docs/16 §10), so search and pages see it at once, with no whole-source run. */
  async indexOne(
    source: IndexableSource,
    path: string,
    raw: Buffer,
  ): Promise<{ key: string | null; withheld: boolean }> {
    const { workspaceId } = source;
    const actor: SystemActor = { kind: 'system', userId: null, via: 'adapter', workspaceId, roles: [] };
    const known = await this.txHost.tx.card.findFirst({
      where: { workspaceId, type: 'doc', doc: { sourceId: source.id, path } },
      select: { id: true, status: true, doc: { select: { path: true, contentHash: true } } },
    });
    const outcome = await this.indexFile(source, actor, path, raw, known ?? undefined);
    const card = await this.txHost.tx.card.findFirst({
      where: { workspaceId, type: 'doc', doc: { sourceId: source.id, path } },
      select: { key: true },
    });
    return { key: card?.key ?? null, withheld: outcome === 'withheld' };
  }

  private async indexFile(
    source: IndexableSource,
    actor: SystemActor,
    path: string,
    raw: Buffer,
    existing: KnownDoc | undefined,
  ): Promise<'created' | 'updated' | 'unchanged' | 'withheld'> {
    const { workspaceId } = source;
    const text = raw.toString('utf8');
    const hash = createHash('sha256').update(raw).digest('hex');
    if (existing?.doc?.contentHash === hash && existing.status === 'current') return 'unchanged';
    const body = stripFrontMatter(text);
    try {
      assertNoSecrets({ body });
    } catch (error) {
      if (!(error instanceof AppException)) throw error;
      return 'withheld';
    }
    {
      const kind = kindOf(path, source.config.kinds);
      const detail = {
        sourceId: source.id,
        path,
        kind: (DOC_KINDS_ALLOWED.has(kind) ? kind : 'other') as 'doc',
        lang: langOf(path, body),
        headings: headingsOf(body).slice(0, 1000),
        wordCount: wordCountOf(body),
        contentHash: hash,
      };
      const title = titleOf(body, basename(path)) || path.slice(0, 200);
      let cardId = existing?.id;
      if (existing) {
        if (existing.status !== 'current') {
          await this.cards.apply(actor, { cardId: existing.id }, 'doc.mark_current', {});
        }
        await this.cards.apply(actor, { cardId: existing.id }, 'doc.update', { title, detail });
      } else {
        const written = await this.cards.apply(actor, null, 'doc.create', {
          title,
          repo: source.name.slice(0, 80),
          externalKey: `doc:${source.id}:${path}`.slice(0, 500),
          detail,
        });
        cardId = written.card.id;
      }
      if (cardId) await this.replaceChunks(workspaceId, cardId, chunksOf(body));
      return existing ? 'updated' : 'created';
    }
  }
}

/**
 * @file Reads the docs (docs/04 §3.15, §3.23): the tree, a document with its live file, by path, and who mentions it.
 * @description The file is read from the source's folder on each view, with the path checked against that folder, and
 * passes the secret filter on the way out as it did on the way in, since the file may have changed since the last run.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';

import type { Actor, CardSummary, CardWithDetail, DocContent, DocFolder, DocMentions } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardQueryService, CardReader, type CardView } from '@/modules/cards';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { docMentionsIn, stripFrontMatter } from '../domain/markdown';

const TREE_MAX = 5000;
const MENTIONS_MAX = 25;

interface MutableFolder {
  name: string;
  path: string;
  docs: CardWithDetail[];
  folders: Map<string, MutableFolder>;
}

const newFolder = (name: string, path: string): MutableFolder => ({
  name,
  path,
  docs: [],
  folders: new Map(),
});

const freeze = (folder: MutableFolder): DocFolder => ({
  name: folder.name,
  path: folder.path,
  docs: folder.docs,
  folders: [...folder.folders.values()].sort((a, b) => a.name.localeCompare(b.name)).map(freeze),
});

@Injectable()
export class DocsReadService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly query: CardQueryService,
    private readonly reader: CardReader,
  ) {}

  async tree(actor: Actor, sourceId?: string) {
    const sources = await this.txHost.tx.source.findMany({
      where: { workspaceId: actor.workspaceId, ...(sourceId ? { id: sourceId } : {}) },
      select: { id: true, name: true },
    });
    const rows = await this.txHost.tx.card.findMany({
      where: {
        workspaceId: actor.workspaceId,
        type: 'doc',
        archivedAt: null,
        status: { not: 'removed' },
        doc: { sourceId: { in: sources.map((source) => source.id) } },
      },
      select: { id: true },
      take: TREE_MAX,
    });
    const cards = await this.reader.findByIds(
      actor.workspaceId,
      rows.map((row) => row.id),
    );
    const detailed = await this.query.withDetail(actor, cards);
    const roots = new Map<string, MutableFolder>();
    const totals = new Map<string, number>();
    const sorted = [...detailed].sort((a, b) =>
      String(a.detail?.['path']).localeCompare(String(b.detail?.['path'])),
    );
    for (const doc of sorted) {
      const id = String(doc.detail?.['sourceId']);
      const root = roots.get(id) ?? newFolder('', '');
      roots.set(id, root);
      totals.set(id, (totals.get(id) ?? 0) + 1);
      const segments = String(doc.detail?.['path']).split('/');
      segments.pop();
      let folder = root;
      let path = '';
      for (const segment of segments) {
        path = path ? `${path}/${segment}` : segment;
        const next = folder.folders.get(segment) ?? newFolder(segment, path);
        folder.folders.set(segment, next);
        folder = next;
      }
      folder.docs.push(doc);
    }
    return sources.flatMap((source) => {
      const root = roots.get(source.id);
      return root
        ? [
            {
              source: { id: source.id, name: source.name },
              root: freeze(root),
              total: totals.get(source.id) ?? 0,
            },
          ]
        : [];
    });
  }

  private async fileOf(
    workspaceId: string,
    card: CardView,
  ): Promise<{
    content: string | null;
    unavailable: DocContent['unavailable'];
    docSource: DocContent['docSource'];
    fileHash: string | null;
  }> {
    const sourceId = String(card.detail?.['sourceId']);
    const source = await this.txHost.tx.source.findUnique({
      where: { id: sourceId, workspaceId },
      select: { id: true, name: true, config: true },
    });
    if (!source) throw new AppException('hub.docs.not_found');
    const summary = { id: source.id, name: source.name };
    const { path: root } = source.config as { path?: string };
    const inner = String(card.detail?.['path']);
    if (!root || isAbsolute(inner) || relative(root, join(root, inner)).startsWith('..')) {
      return { content: null, unavailable: 'missing', docSource: summary, fileHash: null };
    }
    try {
      const bytes = await readFile(join(root, inner));
      const body = stripFrontMatter(bytes.toString('utf8'));
      assertNoSecrets({ body });
      return {
        content: body,
        unavailable: null,
        docSource: summary,
        fileHash: createHash('sha256').update(bytes).digest('hex'),
      };
    } catch (error) {
      return {
        content: null,
        unavailable: error instanceof AppException ? 'secret' : 'missing',
        docSource: summary,
        fileHash: null,
      };
    }
  }

  /** Cards whose text names this path, or its file name with a folder (H5-03). */
  private mentionedBy(actor: Actor, card: CardView): Promise<CardSummary[]> {
    const path = String(card.detail?.['path']);
    return this.query.matching(
      actor,
      {
        id: { not: card.id },
        type: { not: 'doc' },
        OR: [{ body: { contains: path } }, { title: { contains: path } }],
      },
      { limit: MENTIONS_MAX },
    );
  }

  async content(actor: Actor, key: string): Promise<CardWithDetail & DocContent> {
    const card = await this.docCard(actor, { cardKey: key });
    const [detailed] = await this.query.withDetail(actor, [card]);
    if (!detailed) throw new AppException('hub.docs.not_found');
    const file = await this.fileOf(actor.workspaceId, card);
    return {
      ...detailed,
      ...file,
      toc: (card.detail?.['headings'] ?? []) as DocContent['toc'],
      mentionedBy: await this.mentionedBy(actor, card),
    };
  }

  async byPath(actor: Actor, sourceName: string, path: string): Promise<CardWithDetail & DocContent> {
    const row = await this.txHost.tx.card.findFirst({
      where: {
        workspaceId: actor.workspaceId,
        type: 'doc',
        archivedAt: null,
        doc: { path },
        repo: sourceName,
      },
      select: { key: true },
    });
    if (!row) throw new AppException('hub.docs.not_found');
    return this.content(actor, row.key);
  }

  /** The docs a card's text names, as chips (H5-03). `docs/21-x.md` matches a doc indexed as `21-x.md`. */
  async mentionsOf(actor: Actor, key: string): Promise<DocMentions> {
    const card = await this.query.readable(actor, { cardKey: key });
    const mentions = docMentionsIn(`${card.title}\n${card.body ?? ''}`);
    if (mentions.length === 0) return [];
    const fileNames = mentions.map((mention) => mention.slice(mention.lastIndexOf('/') + 1));
    const docs = await this.txHost.tx.docDetail.findMany({
      where: {
        OR: fileNames.map((name) => ({ path: { endsWith: name } })),
        card: { workspaceId: actor.workspaceId, archivedAt: null, status: { not: 'removed' } },
      },
      select: { path: true, card: { select: { key: true, title: true, repo: true } } },
      take: 200,
    });
    return mentions.flatMap((mention) => {
      const doc = docs.find((row) => row.path === mention || mention.endsWith(`/${row.path}`));
      return doc
        ? [{ mention, key: doc.card.key, path: doc.path, source: doc.card.repo ?? '', title: doc.card.title }]
        : [];
    });
  }

  private async docCard(actor: Actor, target: { cardKey: string }): Promise<CardView> {
    const card = await this.query.readable(actor, target).catch((cause: unknown) => {
      throw new AppException('hub.docs.not_found', { cause });
    });
    if (card.type !== 'doc') throw new AppException('hub.docs.not_found');
    return card;
  }
}

/**
 * @file The lab's reads (docs/04 §3.14): pages with versions, a version's files, and two versions side by side.
 */
import type { Actor, CardWithDetail, LabPage } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardQueryService, CardReader, type CardView } from '@/modules/cards';
import { AppException } from '@/shared/errors';

import { parseFrontMatter } from '../domain/front-matter';
import { LabFilesService } from './lab-files.service';
import { labFrameUrl } from './lab-root';
import type { LabCursor } from './lab-scanner.service';

const PAGE_LIMIT = 1000;

@Injectable()
export class LabReadService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly query: CardQueryService,
    private readonly reader: CardReader,
    private readonly files: LabFilesService,
  ) {}

  /** Every page the scanner saw. Empty when the project has no lab. */
  async pages(actor: Actor): Promise<LabPage[]> {
    const lab = await this.files.locate(actor.workspaceId);
    if (!lab) return [];
    const source = await this.txHost.tx.source.findUnique({
      where: { id: lab.sourceId, workspaceId: actor.workspaceId },
      select: { cursor: true },
    });
    const cursor = (source?.cursor ?? {}) as Partial<LabCursor>;
    const rows = await this.txHost.tx.card.findMany({
      where: { workspaceId: actor.workspaceId, type: 'redesign', archivedAt: null },
      select: { id: true },
      take: PAGE_LIMIT,
    });
    const cards = await this.reader.findByIds(
      actor.workspaceId,
      rows.map((row) => row.id),
    );
    const detailed = await this.query.withDetail(actor, cards);
    const byPage = new Map<string, CardWithDetail[]>();
    for (const card of detailed) {
      const key = `${String(card.detail?.['app'])}/${String(card.detail?.['page'])}`;
      byPage.set(key, [...(byPage.get(key) ?? []), card]);
    }
    const versionNumber = (card: CardWithDetail): number =>
      Number(/^v(\d+)/.exec(String(card.detail?.['version']))?.[1] ?? 0);
    return Object.entries(cursor.pages ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, page]) => ({
        ...page,
        // A cursor from before this field says nothing until its next scan.
        renderable: page.renderable ? [...page.renderable] : null,
        versions: (byPage.get(key) ?? []).sort((a, b) => versionNumber(a) - versionNumber(b)),
      }));
  }

  private async version(actor: Actor, key: string): Promise<CardView> {
    const card = await this.query.readable(actor, { cardKey: key });
    if (card.type !== 'redesign') throw new AppException('hub.cards.type_mismatch');
    return card;
  }

  async readme(actor: Actor, key: string): Promise<{ markdown: string | null; review: string | null }> {
    const card = await this.version(actor, key);
    const labPath = String(card.detail?.['labPath']);
    const read = async (name: string): Promise<string | null> => {
      try {
        return await this.files.readText(actor.workspaceId, `${labPath}/${name}`);
      } catch {
        return null;
      }
    };
    const raw = await read('README.md');
    return {
      markdown: raw === null ? card.body : parseFrontMatter(raw).body,
      review: await read('review.md'),
    };
  }

  private frameUrl(card: CardView): string {
    const { app, page, version } = (card.detail ?? {}) as { app?: string; page?: string; version?: string };
    return labFrameUrl(String(app), String(page), String(version));
  }

  async compare(actor: Actor, a: string, b: string) {
    const [left, right] = await Promise.all([this.version(actor, a), this.version(actor, b)]);
    const side = async (card: CardView) => {
      const [detailed] = await this.query.withDetail(actor, [card]);
      if (!detailed) throw new AppException('hub.cards.not_found');
      const attachments = await this.reader.findAttachments(card.id);
      return {
        card: detailed,
        shots: attachments
          .filter((row) => row.kind === 'screenshot')
          .map((row) => ({ name: row.name, url: row.url, width: row.width, height: row.height })),
        frameUrl: this.frameUrl(card),
      };
    };
    const [sideA, sideB] = await Promise.all([side(left), side(right)]);
    const names = new Set(sideB.shots.map((shot) => shot.name));
    return {
      a: sideA,
      b: sideB,
      commonShots: sideA.shots.map((shot) => shot.name).filter((name) => names.has(name)),
    };
  }
}

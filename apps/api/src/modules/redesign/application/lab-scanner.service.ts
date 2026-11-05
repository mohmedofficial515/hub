/**
 * @file The lab scanner (docs/06 §5): each version folder is a `redesign` card, and the file is the truth for status.
 * @description Local path mode (docs/15 §3): reads the folder directly. It only reads. A version whose README, review
 * and screenshots are unchanged since the last run is skipped, so a re-scan is idempotent. A version whose text the
 * secret filter refuses is reported and skipped.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { REDESIGN_STATUSES, type RedesignStatus, type SystemActor } from '@hub/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardService } from '@/modules/cards';
import { AppException } from '@/shared/errors';

import { parseFrontMatter, reviewOf, textField } from '../domain/front-matter';
import { IMAGE_TYPES, LabFilesService, type LabLocation, sha256 } from './lab-files.service';

const NOT_APPS = new Set(['_templates', 'lab', 'shared', 'node_modules', 'dist', 'research']);
const VERSION_FOLDER = /^v\d+-/;
const BODY_MAX = 20_000;

export interface PageCursor {
  readonly app: string;
  readonly page: string;
  readonly route: string | null;
  readonly liveUrl: string | null;
  readonly status: string | null;
  readonly brief: string | null;
}

interface VersionState {
  readonly status: string;
  readonly readmeHash: string;
  /** The review and the screenshots' names. */
  readonly extrasHash: string;
}

export interface LabCursor {
  readonly versions: Readonly<Record<string, VersionState>>;
  readonly pages: Readonly<Record<string, PageCursor>>;
}

export interface ScanResult {
  readonly created: number;
  readonly updated: number;
  readonly missing: number;
  readonly unchanged: number;
  /** Versions left out, with why. */
  readonly problems: readonly string[];
  readonly cursor: LabCursor;
}

async function subfolders(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function textOf(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function imagesIn(folder: string): Promise<string[]> {
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    return entries
      .filter(
        (entry) => entry.isFile() && IMAGE_TYPES[entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase()],
      )
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

export function statusFromFile(version: string, declared: string | null): RedesignStatus {
  if (version === 'v1-baseline') return 'reference';
  return (REDESIGN_STATUSES as readonly string[]).includes(declared ?? '') && declared !== 'reference'
    ? (declared as RedesignStatus)
    : 'draft';
}

@Injectable()
export class LabScannerService {
  private readonly logger = new Logger(LabScannerService.name);

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly cards: CardService,
    private readonly files: LabFilesService,
  ) {}

  private labUrlOf(labPath: string): string {
    return `${this.files.labUrl ?? ''}/#/${labPath}`;
  }

  private async replaceAttachments(
    cardId: string,
    slug: string,
    labPath: string,
    shots: readonly { name: string; inner: string }[],
    hasReview: boolean,
  ): Promise<void> {
    const urlOf = (inner: string): string =>
      `/api/v1/workspaces/${slug}/lab/file?path=${encodeURIComponent(`${labPath}/${inner}`)}`;
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.cardAttachment.deleteMany({ where: { cardId } });
      await this.txHost.tx.cardAttachment.createMany({
        data: [
          ...shots.map((shot) => ({
            cardId,
            kind: 'screenshot',
            name: shot.name,
            url: urlOf(shot.inner),
            mime: IMAGE_TYPES[shot.name.slice(shot.name.lastIndexOf('.')).toLowerCase()] ?? null,
          })),
          ...(hasReview
            ? [
                {
                  cardId,
                  kind: 'review',
                  name: 'review.md',
                  url: `${labPath}/review.md`,
                  mime: 'text/markdown',
                },
              ]
            : []),
        ],
      });
    });
  }

  async scan(workspaceId: string, lab: LabLocation, previous: Partial<LabCursor>): Promise<ScanResult> {
    const actor: SystemActor = { kind: 'system', userId: null, via: 'adapter', workspaceId, roles: [] };
    const workspace = await this.txHost.tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { slug: true },
    });
    const known = await this.txHost.tx.card.findMany({
      where: { workspaceId, type: 'redesign', source: 'lab' },
      select: {
        id: true,
        externalKey: true,
        tags: true,
        status: true,
        redesign: { select: { readmeHash: true } },
      },
    });
    const byKey = new Map(known.map((card) => [card.externalKey ?? '', card]));
    const versions: Record<string, VersionState> = {};
    const pages: Record<string, PageCursor> = {};
    const seen = new Set<string>();
    const result = { created: 0, updated: 0, missing: 0, unchanged: 0, problems: [] as string[] };

    for (const app of (await subfolders(lab.root)).filter(
      (name) => !NOT_APPS.has(name) && !name.startsWith('.'),
    )) {
      for (const page of (await subfolders(join(lab.root, app))).filter((name) => !NOT_APPS.has(name))) {
        const pageFolder = join(lab.root, app, page);
        const folders = (await subfolders(pageFolder)).filter((name) => VERSION_FOLDER.test(name));
        if (folders.length === 0) continue;
        const brief = await textOf(join(pageFolder, 'README.md'));
        const parsed = brief ? parseFrontMatter(brief) : null;
        pages[`${app}/${page}`] = {
          app,
          page,
          route: parsed ? textField(parsed.data, 'route') : null,
          liveUrl: parsed ? textField(parsed.data, 'live-url') : null,
          status: parsed ? textField(parsed.data, 'status') : null,
          brief: parsed ? parsed.body.trim() : null,
        };
        for (const version of folders) {
          const labPath = `${app}/${page}/${version}`;
          const externalKey = `lab:${labPath}`;
          seen.add(externalKey);
          try {
            const outcome = await this.scanVersion(
              actor,
              workspace.slug,
              lab,
              { app, page, version, labPath, externalKey },
              byKey,
              previous,
              versions,
            );
            result[outcome] += 1;
          } catch (error) {
            const reason = error instanceof AppException ? error.code : String(error);
            result.problems.push(`${labPath}: ${reason}`);
            this.logger.warn(`Lab ${labPath}: ${reason}`);
            const prior = previous.versions?.[labPath];
            if (prior) versions[labPath] = prior;
          }
        }
      }
    }

    for (const card of known) {
      const key = card.externalKey ?? '';
      if (seen.has(key) || !key.startsWith('lab:') || card.tags.includes('missing-in-lab')) continue;
      await this.cards.apply(actor, { cardId: card.id }, 'redesign.sync', { presence: 'missing' });
      result.missing += 1;
    }
    return { ...result, cursor: { versions, pages } };
  }

  private async scanVersion(
    actor: SystemActor,
    slug: string,
    lab: LabLocation,
    id: { app: string; page: string; version: string; labPath: string; externalKey: string },
    byKey: ReadonlyMap<
      string,
      {
        id: string;
        tags: readonly string[];
        status: string;
        redesign: { readmeHash: string } | null;
      }
    >,
    previous: Partial<LabCursor>,
    versions: Record<string, VersionState>,
  ): Promise<'created' | 'updated' | 'unchanged'> {
    const folder = join(lab.root, ...id.labPath.split('/'));
    const raw = await readFile(join(folder, 'README.md'), 'utf8');
    const reviewText = await textOf(join(folder, 'review.md'));
    const shots = [
      ...(await imagesIn(folder)).map((name) => ({ name, inner: name })),
      ...(await imagesIn(join(folder, 'shots'))).map((name) => ({ name, inner: `shots/${name}` })),
    ];
    const readmeHash = sha256(raw);
    const extrasHash = sha256(`${reviewText ?? ''}|${shots.map((shot) => shot.inner).join(',')}`);
    const { data, body } = parseFrontMatter(raw);
    const status = statusFromFile(id.version, textField(data, 'status'));
    const card = byKey.get(id.externalKey);
    versions[id.labPath] = { status, readmeHash, extrasHash };
    const prior = previous.versions?.[id.labPath];
    const missingTag = card?.tags.includes('missing-in-lab') ?? false;
    // Compared with the card, not the cursor: a write from Hub already stored its new hash, so it is not news.
    const readmeChanged = card?.redesign?.readmeHash !== readmeHash;
    if (card && !readmeChanged && prior?.extrasHash === extrasHash && card.status === status && !missingTag) {
      return 'unchanged';
    }

    const review = reviewText ? reviewOf(reviewText) : { score: null, summary: null };
    const touches = data['touches-components'];
    const title = `${id.app}/${id.page} · ${id.version} — ${textField(data, 'title') ?? id.version}`.slice(
      0,
      200,
    );
    const detail = {
      app: id.app,
      page: id.page,
      version: id.version,
      labPath: id.labPath,
      labUrl: this.labUrlOf(id.labPath).slice(0, 500),
      ...(textField(data, 'base') ? { base: String(textField(data, 'base')).slice(0, 100) } : {}),
      touchesComponents: (Array.isArray(touches) ? touches : [])
        .map((name) => name.slice(0, 200))
        .slice(0, 200),
      ...(review.score !== null ? { reviewScore: review.score } : {}),
      ...(review.summary ? { reviewSummary: review.summary } : {}),
      frontMatter: data,
      readmeHash,
    };
    const text = body.trim().slice(0, BODY_MAX);
    let cardId = card?.id;
    if (card) {
      await this.cards.apply(actor, { cardId: card.id }, 'redesign.sync', {
        title,
        body: text,
        status,
        detail,
        presence: 'present',
        changed: readmeChanged,
      });
    } else {
      const created = await this.cards.apply(actor, null, 'redesign.create', {
        title,
        body: text,
        status,
        externalKey: id.externalKey,
        detail,
      });
      cardId = created.card.id;
    }
    if (cardId) await this.replaceAttachments(cardId, slug, id.labPath, shots, reviewText !== null);
    return card ? 'updated' : 'created';
  }
}

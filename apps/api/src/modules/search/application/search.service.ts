/**
 * @file Search over cards and doc chunks (docs/03 §12, docs/04 §3.9). Exact words first, then any word with Arabic
 * spellings, then trigram on titles. Always scoped to the project; deleted cards and removed docs never appear (D28).
 */
import type { Actor, CardSummary, DocHit, SearchQueryInput, SearchResult } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { Prisma } from '@/generated/prisma/client';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardQueryService, CardReader } from '@/modules/cards';

import { HEADLINE_OPTIONS, safeExcerpt, widenedQuery } from '../domain/query';

const MIN_HITS = 3;
const DEFAULT_LIMIT = 20;
const CHUNKS_PER_DOC = 2;
const TRIGRAM_THRESHOLD = 0.3;

interface CardHit {
  readonly id: string;
  readonly rank: number;
  readonly highlight: string;
}

interface ChunkRow {
  card_id: string;
  path: string;
  source: string;
  heading: string | null;
  anchor: string | null;
  headline: string;
  rank: number;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly query: CardQueryService,
    private readonly reader: CardReader,
  ) {}

  /** The two tsqueries, as SQL: what the words mean exactly, and the wider one. */
  private tsqueries(q: string): Prisma.Sql[] {
    const wide = widenedQuery(q);
    return [
      Prisma.sql`websearch_to_tsquery('hub_simple', ${q})`,
      ...(wide ? [Prisma.sql`to_tsquery('hub_simple', ${wide})`] : []),
    ];
  }

  private async cardHits(actor: Actor, input: SearchQueryInput, limit: number): Promise<CardHit[]> {
    const typeFilter = input.types?.length
      ? Prisma.sql`c.type IN (${Prisma.join(input.types)})`
      : Prisma.sql`c.type <> 'doc'`;
    const hits = new Map<string, CardHit>();
    for (const tsquery of this.tsqueries(input.q)) {
      const rows = await this.txHost.tx.$queryRaw<{ id: string; rank: number; highlight: string }[]>`
        SELECT c.id, ts_rank_cd(c.search_vector, q)::float8 AS rank,
               ts_headline('hub_simple', c.title || ' ' || coalesce(c.body, ''), q, ${HEADLINE_OPTIONS}) AS highlight
        FROM cards c, ${tsquery} q
        WHERE c.workspace_id = ${actor.workspaceId}::uuid AND c.archived_at IS NULL AND ${typeFilter}
          AND c.search_vector @@ q
        ORDER BY rank DESC, c.last_event_at DESC
        LIMIT ${limit}`;
      for (const row of rows) {
        if (!hits.has(row.id)) {
          hits.set(row.id, { id: row.id, rank: row.rank, highlight: safeExcerpt(row.highlight) });
        }
      }
      if (hits.size >= MIN_HITS) break;
    }
    if (hits.size < MIN_HITS) {
      const rows = await this.txHost.tx.$queryRaw<{ id: string; title: string; rank: number }[]>`
        SELECT c.id, c.title, similarity(c.title, ${input.q})::float8 AS rank FROM cards c
        WHERE c.workspace_id = ${actor.workspaceId}::uuid AND c.archived_at IS NULL AND ${typeFilter}
          AND similarity(c.title, ${input.q}) > ${TRIGRAM_THRESHOLD}
        ORDER BY rank DESC LIMIT ${limit}`;
      for (const row of rows) {
        if (!hits.has(row.id))
          hits.set(row.id, { id: row.id, rank: row.rank, highlight: safeExcerpt(row.title) });
      }
    }
    return [...hits.values()].slice(0, limit);
  }

  async cards(actor: Actor, input: SearchQueryInput): Promise<SearchResult['cards']> {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const hits = await this.cardHits(actor, input, limit);
    const rows = await this.reader.findByIds(
      actor.workspaceId,
      hits.map((hit) => hit.id),
    );
    const summaries = await this.query.summaries(actor, rows);
    const byId = new Map<string, CardSummary>(summaries.map((card) => [card.id, card]));
    return hits.flatMap((hit) => {
      const card = byId.get(hit.id);
      return card ? [{ ...card, rank: hit.rank, highlight: hit.highlight }] : [];
    });
  }

  /** Grouped by document, the best two chunks of each (docs/03 §12). */
  async docs(
    actor: Actor,
    q: string,
    kinds: readonly string[] | undefined,
    limit = DEFAULT_LIMIT,
  ): Promise<DocHit[]> {
    const byCard = new Map<string, ChunkRow[]>();
    for (const tsquery of this.tsqueries(q)) {
      const rows = await this.txHost.tx.$queryRaw<ChunkRow[]>`
        SELECT d.card_id, d.path, s.name AS source, ch.heading, ch.anchor,
               ts_headline('hub_simple', ch.content, q, ${HEADLINE_OPTIONS}) AS headline,
               ts_rank_cd(ch.search_vector, q)::float8 AS rank
        FROM doc_chunks ch
        JOIN doc_details d ON d.card_id = ch.doc_card_id
        JOIN cards c ON c.id = d.card_id
        JOIN sources s ON s.id = d.source_id,
        ${tsquery} q
        WHERE ch.workspace_id = ${actor.workspaceId}::uuid AND c.archived_at IS NULL AND c.status <> 'removed'
          AND ch.search_vector @@ q
          AND ${kinds?.length ? Prisma.sql`d.kind IN (${Prisma.join(kinds)})` : Prisma.sql`TRUE`}
        ORDER BY rank DESC
        LIMIT ${limit * 5}`;
      for (const row of rows) {
        const chunks = byCard.get(row.card_id) ?? [];
        const same = chunks.some((chunk) => chunk.anchor === row.anchor && chunk.headline === row.headline);
        if (!same && chunks.length < CHUNKS_PER_DOC) chunks.push(row);
        byCard.set(row.card_id, chunks);
      }
      if (byCard.size >= MIN_HITS) break;
    }
    const ids = [...byCard.keys()].slice(0, limit);
    const rows = await this.reader.findByIds(actor.workspaceId, ids);
    const summaries = await this.query.summaries(actor, rows);
    const cards = new Map<string, CardSummary>(summaries.map((card) => [card.id, card]));
    return ids.flatMap((id) => {
      const card = cards.get(id);
      const chunks = byCard.get(id);
      if (!card || !chunks?.[0]) return [];
      return [
        {
          card,
          path: chunks[0].path,
          source: chunks[0].source,
          chunks: chunks.map((chunk) => ({
            heading: chunk.heading,
            anchor: chunk.anchor,
            excerpt: safeExcerpt(chunk.headline),
            rank: chunk.rank,
          })),
        },
      ];
    });
  }

  async search(actor: Actor, input: SearchQueryInput): Promise<SearchResult> {
    const [cards, docs] = await Promise.all([
      this.cards(actor, input),
      input.includeDocs === false ? [] : this.docs(actor, input.q, undefined, input.limit ?? DEFAULT_LIMIT),
    ]);
    return { cards, docs };
  }
}

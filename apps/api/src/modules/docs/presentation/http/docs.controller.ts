/**
 * @file Doc reads (docs/04 §3.15). Docs live in Git, so there are no writes. Content, tree and search need the
 * indexer, and arrive with H2-06 in local path mode.
 */
import { DOC_KINDS, type MemberActor, queryList } from '@hub/contracts';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CardQueryService } from '@/modules/cards';
import { AppException } from '@/shared/errors';
import { Actor, Permissions } from '@/shared/http';

class DocsQueryDto extends createZodDto(
  z.object({
    source: queryList(z.uuid()),
    kind: queryList(z.enum(DOC_KINDS)),
    q: z.string().trim().min(1).max(200).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
) {}

@ApiTags('docs')
@Controller('workspaces/:ws/docs')
export class DocsController {
  constructor(private readonly query: CardQueryService) {}

  @Get()
  @Permissions('docs.read')
  @ApiOperation({ summary: 'Indexed documents' })
  list(@Actor() actor: MemberActor, @Query() query: DocsQueryDto) {
    return this.query.listWithDetail(actor, 'doc', {
      q: query.q,
      where: {
        doc: {
          ...(query.source ? { sourceId: { in: query.source } } : {}),
          ...(query.kind ? { kind: { in: query.kind } } : {}),
        },
      },
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Get(':key')
  @Permissions('docs.read')
  @ApiOperation({ summary: 'One document, as a card' })
  async get(@Actor() actor: MemberActor, @Param('key') key: string) {
    const card = await this.query.readable(actor, { cardKey: key }).catch((cause: unknown) => {
      throw new AppException('hub.docs.not_found', { cause });
    });
    if (card.type !== 'doc') throw new AppException('hub.docs.not_found');
    return this.query.full(actor, key);
  }
}

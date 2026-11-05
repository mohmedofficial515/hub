/**
 * @file Doc reads (docs/04 §3.15, §3.23). Docs live in their folders, so there are no writes here. Search is
 * `modules/search`; reindex is `modules/system`, which runs sources.
 */
import {
  DOC_KINDS,
  docByPathQuerySchema,
  docMentionsSchema,
  docsTreeQuerySchema,
  docsTreeSchema,
  type MemberActor,
  queryList,
} from '@hub/contracts';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CardQueryService } from '@/modules/cards';
import { Actor, Permissions } from '@/shared/http';

import { DocsReadService } from '../../application/docs-read.service';

class DocsQueryDto extends createZodDto(
  z.object({
    source: queryList(z.uuid()),
    kind: queryList(z.enum(DOC_KINDS)),
    q: z.string().trim().min(1).max(200).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
) {}
class TreeQueryDto extends createZodDto(docsTreeQuerySchema) {}
class ByPathQueryDto extends createZodDto(docByPathQuerySchema) {}
class MentionsDto extends createZodDto(z.object({ data: docMentionsSchema })) {}
class TreeDto extends createZodDto(z.object({ data: docsTreeSchema })) {}

@ApiTags('docs')
@Controller('workspaces/:ws/docs')
export class DocsController {
  constructor(
    private readonly query: CardQueryService,
    private readonly read: DocsReadService,
  ) {}

  @Get()
  @Permissions('docs.read')
  @ApiOperation({ summary: 'Indexed documents' })
  list(@Actor() actor: MemberActor, @Query() query: DocsQueryDto) {
    return this.query.listWithDetail(actor, 'doc', {
      statuses: ['current', 'stale'],
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

  @Get('tree')
  @Permissions('docs.read')
  @ApiOperation({ summary: 'Documents as folders, per source' })
  @ApiOkResponse({ type: TreeDto })
  tree(@Actor() actor: MemberActor, @Query() query: TreeQueryDto) {
    return this.read.tree(actor, query.source);
  }

  @Get('by-path')
  @Permissions('docs.read')
  @ApiOperation({ summary: 'One document by source name and path' })
  byPath(@Actor() actor: MemberActor, @Query() query: ByPathQueryDto) {
    return this.read.byPath(actor, query.source, query.path);
  }

  @Get('mentions/:cardKey')
  @Permissions('docs.read')
  @ApiOperation({ summary: "The documents a card's text names, for chips" })
  @ApiOkResponse({ type: MentionsDto })
  mentions(@Actor() actor: MemberActor, @Param('cardKey') cardKey: string) {
    return this.read.mentionsOf(actor, cardKey);
  }

  @Get(':key')
  @Permissions('docs.read')
  @ApiOperation({ summary: 'One document with its file, contents and who mentions it' })
  get(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.read.content(actor, key);
  }
}

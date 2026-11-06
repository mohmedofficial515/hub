/**
 * @file Docs (docs/04 §3.15, §3.23, docs/16 §10): reads, `save_doc`'s route and revisions. Search is
 * `modules/search`; reindex is `modules/system`, which runs sources.
 */
import {
  DOC_KINDS,
  docByPathQuerySchema,
  docMentionsSchema,
  docRevisionDetailSchema,
  docRevisionSummarySchema,
  docsTreeQuerySchema,
  docsTreeSchema,
  type MemberActor,
  queryList,
  restoreDocRevisionSchema,
  saveDocResultSchema,
  saveDocSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CardQueryService } from '@/modules/cards';
import { Actor, Permissions } from '@/shared/http';

import { DocsReadService } from '../../application/docs-read.service';
import { DocsWriteService } from '../../application/docs-write.service';

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
class SaveDocDto extends createZodDto(saveDocSchema) {}
class SaveDocResultDto extends createZodDto(saveDocResultSchema) {}
class RestoreDocRevisionDto extends createZodDto(restoreDocRevisionSchema) {}
class DocRevisionSummaryDto extends createZodDto(docRevisionSummarySchema) {}
class DocRevisionDetailDto extends createZodDto(docRevisionDetailSchema) {}

@ApiTags('docs')
@Controller('workspaces/:ws/docs')
export class DocsController {
  constructor(
    private readonly query: CardQueryService,
    private readonly read: DocsReadService,
    private readonly write: DocsWriteService,
  ) {}

  @Post('save')
  @HttpCode(200)
  @Permissions('docs.write')
  @ApiOperation({
    summary: 'Write a document to its file, keeping the earlier text as a revision. Refuses a stale base. No Git commit',
  })
  @ApiOkResponse({ type: SaveDocResultDto })
  save(@Actor() actor: MemberActor, @Body() body: SaveDocDto): Promise<SaveDocResultDto> {
    return this.write.save(actor, body);
  }

  @Get(':key/revisions')
  @Permissions('docs.read')
  @ApiOperation({ summary: 'The earlier texts of a document, newest first' })
  @ApiOkResponse({ type: [DocRevisionSummaryDto] })
  revisions(@Actor() actor: MemberActor, @Param('key') key: string): Promise<DocRevisionSummaryDto[]> {
    return this.write.revisions(actor, key);
  }

  @Get(':key/revisions/:id')
  @Permissions('docs.read')
  @ApiOperation({ summary: 'One earlier text of a document' })
  @ApiOkResponse({ type: DocRevisionDetailDto })
  revision(
    @Actor() actor: MemberActor,
    @Param('key') key: string,
    @Param('id') id: string,
  ): Promise<DocRevisionDetailDto> {
    return this.write.revision(actor, key, id);
  }

  @Post(':key/revisions/:id/restore')
  @HttpCode(200)
  @Permissions('docs.write')
  @ApiOperation({ summary: 'Put an earlier text back. What is there now becomes a revision too' })
  @ApiOkResponse({ type: SaveDocResultDto })
  restore(
    @Actor() actor: MemberActor,
    @Param('key') key: string,
    @Param('id') id: string,
    @Body() body: RestoreDocRevisionDto,
  ): Promise<SaveDocResultDto> {
    return this.write.restore(actor, key, id, body.baseHash);
  }

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

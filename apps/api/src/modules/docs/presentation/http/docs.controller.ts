/**
 * @file Docs (docs/04 §3.15, §3.23, docs/16 §10): reads, `save_doc`'s route and revisions, and the images a document names
 * (decision 13b). Search is `modules/search`; reindex is `modules/system`, which runs sources.
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
import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CardQueryService } from '@/modules/cards';
import { Actor, Permissions, RawResponse } from '@/shared/http';

import { DocImagesService } from '../../application/doc-images.service';
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
/** The image's address as the document writes it, relative to the document's folder. */
class DocImageQueryDto extends createZodDto(z.object({ src: z.string().trim().min(1).max(500) })) {}

/** Nothing an image carries may run or load: an SVG opened on its own draws, and that is all. */
const IMAGE_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";
const IMAGE_TYPES_PRODUCED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

@ApiTags('docs')
@Controller('workspaces/:ws/docs')
export class DocsController {
  constructor(
    private readonly query: CardQueryService,
    private readonly read: DocsReadService,
    private readonly write: DocsWriteService,
    private readonly images: DocImagesService,
  ) {}

  @Post('save')
  @HttpCode(200)
  @Permissions('docs.write')
  @ApiOperation({
    summary:
      'Write a document to its file, keeping the earlier text as a revision. Refuses a stale base. No Git commit',
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

  @Get(':key/image')
  @Permissions('docs.read')
  @RawResponse()
  @ApiOperation({
    summary:
      "An image the document names, from its source's local folder, resolved against the document's own folder. Read only",
  })
  @ApiProduces(...IMAGE_TYPES_PRODUCED)
  @ApiOkResponse({
    description: 'The image bytes. Cache-Control private, an ETag, nosniff and a CSP that runs nothing',
    content: Object.fromEntries(
      IMAGE_TYPES_PRODUCED.map((type) => [type, { schema: { type: 'string', format: 'binary' } }]),
    ),
  })
  @ApiResponse({ status: 304, description: 'Not modified: the ETag in If-None-Match still matches' })
  @ApiResponse({
    status: 404,
    description: 'hub.docs.not_found · hub.docs.image_not_found (also a link out of the source)',
  })
  @ApiResponse({ status: 413, description: 'hub.docs.image_too_large (over 10 MB)' })
  @ApiResponse({
    status: 415,
    description: 'hub.docs.image_type_refused (only png, jpg, jpeg, gif, webp, svg)',
  })
  @ApiResponse({
    status: 422,
    description: 'hub.docs.image_bad_path (absolute, a scheme, a backslash, or a `..` above the source)',
  })
  async image(
    @Actor() actor: MemberActor,
    @Param('key') key: string,
    @Query() query: DocImageQueryDto,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const image = await this.images.image(actor, key, query.src);
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.setHeader('ETag', image.etag);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', IMAGE_CSP);
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (ifNoneMatch === image.etag) {
      response.status(304).end();
      return;
    }
    // Read whole before any status goes out, so a file that vanished or is locked is a 404, not a dropped connection.
    const body = await this.images.bytes(image);
    response.status(200);
    response.setHeader('Content-Type', image.type);
    response.setHeader('Content-Length', body.length);
    response.end(body);
  }

  @Get(':key')
  @Permissions('docs.read')
  @ApiOperation({ summary: 'One document with its file, contents and who mentions it' })
  get(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.read.content(actor, key);
  }
}

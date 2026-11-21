/**
 * @file Redesign routes (docs/04 §3.14), and screenshots from the lab folder. Rescan is `modules/system`, which runs sources.
 */
import { createReadStream } from 'node:fs';

import {
  approveRedesignSchema,
  compareQuerySchema,
  compareSchema,
  labPageSchema,
  labReadmeSchema,
  markPortedSchema,
  type MemberActor,
  type PermissionAction,
  queryList,
  REDESIGN_STATUSES,
  redesignNoteSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, UseInterceptors } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CardQueryService,
  CardService,
  CardWrittenResponseDto,
  IdempotencyInterceptor,
} from '@/modules/cards';
import { AppException } from '@/shared/errors';
import { Actor, Permissions, RawResponse } from '@/shared/http';

import { LabFilesService } from '../../application/lab-files.service';
import { LabReadService } from '../../application/lab-read.service';

class VersionsQueryDto extends createZodDto(
  z.object({
    app: z.string().max(40).optional(),
    page: z.string().max(100).optional(),
    status: queryList(z.enum(REDESIGN_STATUSES)),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
) {}
class LabPageDto extends createZodDto(labPageSchema) {}
class LabReadmeDto extends createZodDto(labReadmeSchema) {}
class CompareQueryDto extends createZodDto(compareQuerySchema) {}
class CompareDto extends createZodDto(compareSchema) {}
class LabFileQueryDto extends createZodDto(z.object({ path: z.string().min(1).max(500) })) {}
class ApproveDto extends createZodDto(approveRedesignSchema) {}
class NoteDto extends createZodDto(redesignNoteSchema) {}
class MarkPortedDto extends createZodDto(markPortedSchema) {}

@ApiTags('redesign')
@Controller('workspaces/:ws/redesign')
export class RedesignController {
  constructor(
    private readonly cards: CardService,
    private readonly query: CardQueryService,
    private readonly lab: LabReadService,
  ) {}

  @Get('pages')
  @Permissions('card.read')
  @ApiOperation({ summary: 'Lab pages with their versions. Empty when the project has no lab.' })
  @ApiOkResponse({ type: LabPageDto, isArray: true })
  pages(@Actor() actor: MemberActor) {
    return this.lab.pages(actor);
  }

  @Get('compare')
  @Permissions('card.read')
  @ApiOperation({ summary: 'Two versions side by side: detail, screenshots paired by name, frame URLs' })
  @ApiOkResponse({ type: CompareDto })
  compare(@Actor() actor: MemberActor, @Query() query: CompareQueryDto) {
    return this.lab.compare(actor, query.a, query.b);
  }

  @Get(':key/readme')
  @Permissions('card.read')
  @ApiOperation({ summary: "A version's README and review, from the lab folder" })
  @ApiOkResponse({ type: LabReadmeDto })
  readme(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.lab.readme(actor, key);
  }

  private async run(actor: MemberActor, key: string, action: PermissionAction, payload: unknown) {
    return this.query.written(actor, await this.cards.apply(actor, { cardKey: key }, action, payload));
  }

  @Get('versions')
  @Permissions('card.read')
  @ApiOperation({ summary: 'Redesign versions' })
  versions(@Actor() actor: MemberActor, @Query() query: VersionsQueryDto) {
    return this.query.listWithDetail(actor, 'redesign', {
      statuses: query.status,
      where: {
        redesign: {
          ...(query.app ? { app: query.app } : {}),
          ...(query.page ? { page: query.page } : {}),
        },
      },
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Post(':key/submit-review')
  @HttpCode(200)
  @Permissions('redesign.send_to_review')
  @ApiOperation({ summary: 'Send a version to review' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  submit(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.run(actor, key, 'redesign.send_to_review', {});
  }

  @Post(':key/approve')
  @HttpCode(200)
  // `apply` refuses with this action's own code, which the route-level check would hide.
  @Permissions('card.read')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Approve a version, creating its port task' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  approve(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ApproveDto) {
    return this.run(actor, key, 'redesign.approve', body);
  }

  @Post(':key/reject')
  @HttpCode(200)
  // `apply` refuses with this action's own code, which the route-level check would hide.
  @Permissions('card.read')
  @ApiOperation({ summary: 'Reject a version, with a note' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  reject(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: NoteDto) {
    return this.run(actor, key, 'redesign.reject', body);
  }

  @Post(':key/request-changes')
  @HttpCode(200)
  @Permissions('redesign.request_changes')
  @ApiOperation({ summary: 'Ask for changes. The status stays review.' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  requestChanges(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: NoteDto) {
    return this.run(actor, key, 'redesign.request_changes', body);
  }

  @Post(':key/mark-ported')
  @HttpCode(200)
  @Permissions('redesign.mark_ported')
  @ApiOperation({ summary: 'Mark a version ported, closing its port task' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  markPorted(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: MarkPortedDto) {
    return this.run(actor, key, 'redesign.mark_ported', body);
  }
}

/** Images under the lab root, for members only. Anything else, or any way out of the root, is not found (docs/15 §3). */
@ApiTags('redesign')
@Controller('workspaces/:ws/lab')
export class LabFilesController {
  constructor(private readonly files: LabFilesService) {}

  @Get('file')
  @Permissions('card.read')
  @RawResponse()
  @ApiOperation({ summary: 'A screenshot from the lab folder' })
  async file(
    @Actor() actor: MemberActor,
    @Query() query: LabFileQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const image = await this.files.image(actor.workspaceId, query.path);
    if (!image) throw new AppException('hub.common.not_found');
    response.status(200);
    response.setHeader('Content-Type', image.type);
    response.setHeader('Content-Length', image.size);
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    createReadStream(image.absolute).pipe(response);
  }
}

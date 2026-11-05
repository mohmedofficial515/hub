/**
 * @file Redesign routes (docs/04 §3.14). Pages, readme and rescan read the lab, so they arrive with H2-05.
 */
import {
  approveRedesignSchema,
  markPortedSchema,
  type MemberActor,
  type PermissionAction,
  queryList,
  REDESIGN_STATUSES,
  redesignNoteSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  CardQueryService,
  CardService,
  CardWrittenResponseDto,
  IdempotencyInterceptor,
} from '@/modules/cards';
import { Actor, Permissions } from '@/shared/http';

class VersionsQueryDto extends createZodDto(
  z.object({
    app: z.string().max(40).optional(),
    page: z.string().max(100).optional(),
    status: queryList(z.enum(REDESIGN_STATUSES)),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
) {}
class ApproveDto extends createZodDto(approveRedesignSchema) {}
class NoteDto extends createZodDto(redesignNoteSchema) {}
class MarkPortedDto extends createZodDto(markPortedSchema) {}

@ApiTags('redesign')
@Controller('workspaces/:ws/redesign')
export class RedesignController {
  constructor(
    private readonly cards: CardService,
    private readonly query: CardQueryService,
  ) {}

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
  @Permissions('redesign.approve')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Approve a version, creating its port task' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  approve(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ApproveDto) {
    return this.run(actor, key, 'redesign.approve', body);
  }

  @Post(':key/reject')
  @HttpCode(200)
  @Permissions('redesign.reject')
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

/**
 * @file Release routes (docs/04 §3.20).
 */
import {
  editReleaseSchema,
  type MemberActor,
  type PermissionAction,
  queryList,
  RELEASE_STATUSES,
  releaseSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CardQueryService, CardService, CardWrittenResponseDto } from '@/modules/cards';
import { Actor, Permissions } from '@/shared/http';

import { ReleaseNotesService } from '../../application/release-notes.service';

class ReleasesQueryDto extends createZodDto(
  z.object({
    status: queryList(z.enum(RELEASE_STATUSES)),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
) {}
class EditDto extends createZodDto(editReleaseSchema) {}
class ReleaseDto extends createZodDto(releaseSchema) {}

@ApiTags('releases')
@Controller('workspaces/:ws/releases')
export class ReleasesController {
  constructor(
    private readonly cards: CardService,
    private readonly query: CardQueryService,
    private readonly notes: ReleaseNotesService,
  ) {}

  private async run(actor: MemberActor, key: string, action: PermissionAction, payload: unknown) {
    return this.query.written(actor, await this.cards.apply(actor, { cardKey: key }, action, payload));
  }

  @Get()
  @Permissions('card.read')
  @ApiOperation({ summary: 'Releases' })
  list(@Actor() actor: MemberActor, @Query() query: ReleasesQueryDto) {
    return this.query.listWithDetail(actor, 'release', {
      statuses: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Patch(':key')
  @Permissions('release.edit')
  @ApiOperation({ summary: 'Edit a release' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  edit(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: EditDto) {
    return this.run(actor, key, 'release.edit', body);
  }

  @Post(':key/generate-notes')
  @HttpCode(200)
  @Permissions('release.edit')
  @ApiOperation({ summary: 'Fill the empty audiences from the included cards' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  async generate(@Actor() actor: MemberActor, @Param('key') key: string) {
    return this.query.written(actor, await this.notes.generate(actor, key));
  }

  @Post(':key/release')
  @HttpCode(200)
  @Permissions('release.release')
  @ApiOperation({ summary: 'Mark released' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  release(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ReleaseDto) {
    return this.run(actor, key, 'release.release', body);
  }
}

/**
 * @file Handoff routes (docs/04 §3.13).
 */
import {
  acknowledgeHandoffSchema,
  applyHandoffSchema,
  HANDOFF_SEVERITIES,
  HANDOFF_STATUSES,
  type MemberActor,
  type PermissionAction,
  queryFlag,
  queryList,
  reasonSchema,
  roleSchema,
} from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import {
  CardQueryService,
  CardService,
  CardWrittenResponseDto,
  IdempotencyInterceptor,
} from '@/modules/cards';
import { Actor, Permissions } from '@/shared/http';

class HandoffsQueryDto extends createZodDto(
  z.object({
    status: queryList(z.enum(HANDOFF_STATUSES)),
    toRole: queryList(roleSchema),
    fromRole: queryList(roleSchema),
    mine: queryFlag,
    severity: queryList(z.enum(HANDOFF_SEVERITIES)),
    stale: queryFlag,
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
) {}
class AcknowledgeDto extends createZodDto(acknowledgeHandoffSchema) {}
class ApplyDto extends createZodDto(applyHandoffSchema) {}
class ReasonDto extends createZodDto(reasonSchema) {}

const SEVERITY_ORDER: readonly string[] = ['breaking', 'notable', 'info'];
const HOUR_MS = 3_600_000;

@ApiTags('handoffs')
@Controller('workspaces/:ws/handoffs')
export class HandoffsController {
  constructor(
    private readonly cards: CardService,
    private readonly query: CardQueryService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async run(actor: MemberActor, key: string, action: PermissionAction, payload: unknown) {
    return this.query.written(actor, await this.cards.apply(actor, { cardKey: key }, action, payload));
  }

  @Get()
  @Permissions('card.read')
  @ApiOperation({ summary: 'Handoffs, breaking first within a page, then oldest' })
  async list(@Actor() actor: MemberActor, @Query() query: HandoffsQueryDto) {
    const now = this.clock.now().getTime();
    const page = await this.query.listWithDetail(actor, 'handoff', {
      statuses: query.status ?? ['pending', 'acknowledged'],
      roles: query.mine ? actor.roles : query.toRole,
      flags: query.stale ? ['stale'] : undefined,
      where: {
        handoff: {
          ...(query.fromRole ? { fromRole: { in: query.fromRole } } : {}),
          ...(query.severity ? { severity: { in: query.severity } } : {}),
        },
      },
      sort: 'createdAsc',
      cursor: query.cursor,
      limit: query.limit,
    });
    const rank = (card: (typeof page.items)[number]) =>
      SEVERITY_ORDER.indexOf(card.detail?.['severity'] as string);
    return {
      ...page,
      items: [...page.items]
        .sort((a, b) => rank(a) - rank(b))
        .map((card) => ({
          ...card,
          pendingHours: Math.floor((now - Date.parse(card.createdAt)) / HOUR_MS),
        })),
    };
  }

  @Post(':key/acknowledge')
  @HttpCode(200)
  @Permissions('handoff.acknowledge')
  @ApiOperation({ summary: 'Acknowledge a handoff' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  acknowledge(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: AcknowledgeDto) {
    return this.run(actor, key, 'handoff.acknowledge', body);
  }

  @Post(':key/apply')
  @HttpCode(200)
  @Permissions('handoff.apply')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Mark a handoff applied, optionally creating its task' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  apply(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ApplyDto) {
    return this.run(actor, key, 'handoff.apply', body);
  }

  @Post(':key/dismiss')
  @HttpCode(200)
  @Permissions('handoff.dismiss')
  @ApiOperation({ summary: 'Dismiss a handoff, with a reason' })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  dismiss(@Actor() actor: MemberActor, @Param('key') key: string, @Body() body: ReasonDto) {
    return this.run(actor, key, 'handoff.dismiss', body);
  }
}

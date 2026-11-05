/**
 * @file The routes the team pack's hooks call: `POST /capture/session` and `GET /me/context` (docs/04 §3.16).
 * @description Both take an API token, of kind hook or mcp, and no project in the path: the folder's `X-Hub-Project`,
 * then the project holding `cwd`, then the member's default decide (docs/15 §5). A session cookie has no business here.
 */
import {
  hookSessionPayloadSchema,
  hookSessionResultSchema,
  type Principal,
  PROJECT_HEADER,
  sessionContextQuerySchema,
  sessionContextSchema,
} from '@hub/contracts';
import { Body, Controller, Get, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { ApiAcceptedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import { AppException } from '@/shared/errors';
import { CurrentPrincipal, Permissions } from '@/shared/http';

import { SessionContextService } from '../../application/session-context.service';
import { SessionsService } from '../../application/sessions.service';

class HookSessionDto extends createZodDto(hookSessionPayloadSchema) {}
class HookSessionResultDto extends createZodDto(hookSessionResultSchema) {}
class ContextQueryDto extends createZodDto(sessionContextQuerySchema) {}
class ContextDto extends createZodDto(sessionContextSchema) {}

function assertToken(principal: Principal): void {
  if (principal.kind === 'user') throw new AppException('hub.identity.token_scope');
}

@ApiTags('capture')
@Controller()
export class CaptureController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly context: SessionContextService,
  ) {}

  @Post('capture/session')
  @HttpCode(202)
  @Permissions('session.log')
  @ApiOperation({ summary: 'Git facts of a finished Claude Code session, from the SessionEnd hook' })
  @ApiAcceptedResponse({ type: HookSessionResultDto })
  async session(
    @CurrentPrincipal() principal: Principal,
    @Headers(PROJECT_HEADER) header: string | undefined,
    @Body() body: HookSessionDto,
  ): Promise<HookSessionResultDto> {
    assertToken(principal);
    const actor = await this.sessions.actorFor(principal, header, body.cwd);
    const result = await this.sessions.ingestHook(actor, hookSessionPayloadSchema.parse(body));
    const context = await this.context.projectOf(actor);
    return { ...result, project: context };
  }

  @Get('me/context')
  @Permissions('project.read')
  @ApiOperation({ summary: 'What a new chat should know, naming the active project' })
  @ApiOkResponse({ type: ContextDto })
  me(
    @CurrentPrincipal() principal: Principal,
    @Headers(PROJECT_HEADER) header: string | undefined,
    @Query() query: ContextQueryDto,
  ): Promise<ContextDto> {
    assertToken(principal);
    return this.context.render(principal, header, query.cwd);
  }
}

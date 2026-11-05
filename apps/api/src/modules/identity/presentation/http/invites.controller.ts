/**
 * @file Invite routes: the public link (docs/04 §3.2) and a project's list (docs/04 §3.5).
 */
import type { MemberActor } from '@hub/contracts';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, Res } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { RateLimit } from '@/infra/throttler/rate-limit.guard';
import { Actor, Permissions, Public } from '@/shared/http';

import { InviteService } from '../../application/invite.service';
import { PRINCIPAL_RESOLVER, type PrincipalResolver } from '../../application/ports/principal-resolver';
import { setSessionCookies } from '../cookies';
import {
  AcceptInviteDto,
  CreateInviteDto,
  InviteAcceptedDto,
  InviteCreatedDto,
  InvitePreviewDto,
  InviteRowDto,
  OneTimeUrlDto,
} from './identity.dto';

@ApiTags('auth')
@Controller('auth/invites')
export class PublicInvitesController {
  constructor(
    private readonly invites: InviteService,
    @Inject(PRINCIPAL_RESOLVER) private readonly resolver: PrincipalResolver,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get(':token')
  @Public()
  @RateLimit('auth')
  @ApiOperation({ summary: 'What an invite link offers' })
  @ApiOkResponse({ type: InvitePreviewDto })
  preview(@Param('token') token: string): Promise<InvitePreviewDto> {
    return this.invites.preview(token);
  }

  @Post(':token/accept')
  @HttpCode(201)
  @Public()
  @RateLimit('auth')
  @ApiOperation({ summary: 'Join the project, creating the account when there is no session' })
  @ApiCreatedResponse({ type: InviteAcceptedDto })
  async accept(
    @Param('token') token: string,
    @Body() body: AcceptInviteDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<InviteAcceptedDto> {
    const principal = await this.resolver.resolve(request);
    const accepted = await this.invites.accept(token, body, principal);
    if (accepted.session) setSessionCookies(response, accepted.session, this.config, this.clock.now());
    return { user: accepted.user, workspace: accepted.workspace };
  }
}

@ApiTags('members')
@Controller('workspaces/:ws/invites')
export class WorkspaceInvitesController {
  constructor(private readonly invites: InviteService) {}

  @Get()
  @Permissions('member.invite')
  @ApiOperation({ summary: 'The project’s invites' })
  @ApiOkResponse({ type: [InviteRowDto] })
  list(@Actor() actor: MemberActor): Promise<InviteRowDto[]> {
    return this.invites.list(actor);
  }

  @Post()
  @HttpCode(201)
  @Permissions('member.invite')
  @ApiOperation({ summary: 'Invite someone by email. The link is shown this one time' })
  @ApiCreatedResponse({ type: InviteCreatedDto })
  create(@Actor() actor: MemberActor, @Body() body: CreateInviteDto): Promise<InviteCreatedDto> {
    return this.invites.create(actor, body.email, body.roles);
  }

  @Post(':id/resend')
  @HttpCode(200)
  @Permissions('member.invite')
  @ApiOperation({ summary: 'Issue a new link; the old one stops working' })
  @ApiOkResponse({ type: OneTimeUrlDto })
  resend(@Actor() actor: MemberActor, @Param('id') id: string): Promise<OneTimeUrlDto> {
    return this.invites.resend(actor, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('member.invite')
  @ApiOperation({ summary: 'Revoke an invite' })
  @ApiNoContentResponse()
  async revoke(@Actor() actor: MemberActor, @Param('id') id: string): Promise<void> {
    await this.invites.revoke(actor, id);
  }
}

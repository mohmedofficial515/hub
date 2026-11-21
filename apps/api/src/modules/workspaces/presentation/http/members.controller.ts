/**
 * @file Member routes (docs/04 §3.5, §3.23). Invites are in the identity module.
 */
import type { MemberActor } from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SessionOnly } from '@/modules/identity';
import { Actor, type Paginated, Permissions } from '@/shared/http';

import { MembersService } from '../../application/members.service';
import { GithubLoginsDto, MemberRowDto, PaginationQueryDto, UpdateMemberRolesDto } from './workspaces.dto';

@ApiTags('members')
@Controller('workspaces/:ws/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @Permissions('member.read')
  @ApiOperation({ summary: 'The project’s members, oldest first' })
  @ApiOkResponse({ type: [MemberRowDto] })
  list(@Actor() actor: MemberActor, @Query() query: PaginationQueryDto): Promise<Paginated<MemberRowDto>> {
    return this.members.list(actor, query);
  }

  @Patch(':userId')
  @Permissions('member.change_roles')
  @ApiOperation({ summary: 'Replace a member’s roles' })
  @ApiOkResponse({ type: MemberRowDto })
  changeRoles(
    @Actor() actor: MemberActor,
    @Param('userId') userId: string,
    @Body() body: UpdateMemberRolesDto,
  ): Promise<MemberRowDto> {
    return this.members.changeRoles(actor, userId, body.roles);
  }

  @Post(':userId/remove')
  @HttpCode(204)
  @Permissions('member.disable')
  @ApiOperation({ summary: 'Remove a member from the project' })
  @ApiNoContentResponse()
  async remove(@Actor() actor: MemberActor, @Param('userId') userId: string): Promise<void> {
    await this.members.remove(actor, userId);
  }

  @Post(':userId/disable')
  @HttpCode(204)
  @Permissions('member.disable')
  @ApiOperation({ summary: 'Remove a member; the account is disabled when this was their only project' })
  @ApiNoContentResponse()
  async disable(@Actor() actor: MemberActor, @Param('userId') userId: string): Promise<void> {
    await this.members.disable(actor, userId);
  }

  @Post(':userId/enable')
  @HttpCode(204)
  @Permissions('member.disable')
  @ApiOperation({ summary: 'Bring a removed or disabled member back' })
  @ApiNoContentResponse()
  async enable(@Actor() actor: MemberActor, @Param('userId') userId: string): Promise<void> {
    await this.members.enable(actor, userId);
  }

  @Post(':userId/password-reset-link')
  @HttpCode(201)
  @Permissions('member.disable')
  @SessionOnly()
  @ApiOperation({ summary: 'A reset link to hand to the member. Shown this one time' })
  @ApiCreatedResponse({ schema: { properties: { url: { type: 'string' } } } })
  passwordResetLink(@Actor() actor: MemberActor, @Param('userId') userId: string): Promise<{ url: string }> {
    return this.members.passwordResetLink(actor, userId);
  }

  @Put(':userId/github-logins')
  @Permissions('member.github_identity')
  @ApiOperation({ summary: 'Replace the GitHub logins that map to this member' })
  @ApiOkResponse({ type: GithubLoginsDto })
  setGithubLogins(
    @Actor() actor: MemberActor,
    @Param('userId') userId: string,
    @Body() body: GithubLoginsDto,
  ): Promise<GithubLoginsDto> {
    return this.members.setGithubLogins(actor, userId, body.logins);
  }
}

/**
 * @file The member's own profile, API tokens and default project (docs/04 §3.3, docs/15 §5).
 * @description Tokens and the profile are session only: an API token cannot mint another (D27 limits).
 */
import type { Principal } from '@hub/contracts';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentPrincipal, Permissions } from '@/shared/http';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { ApiTokenService } from '../../application/api-token.service';
import { MeService } from '../../application/me.service';
import { SessionOnly } from '../session-only.decorator';
import {
  ApiTokenCreatedDto,
  ApiTokenRowDto,
  CreateApiTokenDto,
  MeDto,
  SetDefaultProjectDto,
  UpdateProfileDto,
} from './identity.dto';

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly tokens: ApiTokenService,
  ) {}

  @Patch()
  @Permissions('profile.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Change the member’s own profile' })
  @ApiOkResponse({ type: MeDto })
  update(@CurrentPrincipal() principal: Principal, @Body() body: UpdateProfileDto): Promise<MeDto> {
    assertNoSecrets(body);
    return this.me.updateProfile(principal.userId, body);
  }

  @Put('default-project')
  @Permissions('project.switch')
  @ApiOperation({ summary: 'Set the project a chat lands on when nothing else names one' })
  @ApiOkResponse({ type: MeDto })
  setDefaultProject(
    @CurrentPrincipal() principal: Principal,
    @Body() body: SetDefaultProjectDto,
  ): Promise<MeDto> {
    return this.me.setDefaultProject(principal.userId, body.slug);
  }

  @Get('tokens')
  @Permissions('token.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'The member’s API tokens, without their values' })
  @ApiOkResponse({ type: [ApiTokenRowDto] })
  listTokens(@CurrentPrincipal() principal: Principal): Promise<ApiTokenRowDto[]> {
    return this.tokens.list(principal.userId);
  }

  @Post('tokens')
  @HttpCode(201)
  @Permissions('token.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Create an API token. Its value is shown this one time' })
  @ApiCreatedResponse({ type: ApiTokenCreatedDto })
  createToken(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateApiTokenDto,
  ): Promise<ApiTokenCreatedDto> {
    return this.tokens.create(principal.userId, body.name, body.kind);
  }

  @Delete('tokens/:id')
  @HttpCode(204)
  @Permissions('token.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Revoke an API token, effective at once' })
  @ApiNoContentResponse()
  async revokeToken(@CurrentPrincipal() principal: Principal, @Param('id') id: string): Promise<void> {
    await this.tokens.revoke(principal.userId, id);
  }
}

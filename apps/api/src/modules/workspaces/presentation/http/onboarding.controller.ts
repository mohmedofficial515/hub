/**
 * @file Onboarding progress routes (docs/04 §3.23).
 */
import type { MemberActor } from '@hub/contracts';
import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Actor, Permissions } from '@/shared/http';

import { OnboardingService } from '../../application/onboarding.service';
import { OnboardingGroupDto } from './workspaces.dto';

@ApiTags('onboarding')
@Controller('workspaces/:ws/onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  @Permissions('onboarding.use')
  @ApiOperation({ summary: 'The reading path of each role the member holds' })
  @ApiOkResponse({ type: [OnboardingGroupDto] })
  get(@Actor() actor: MemberActor): Promise<OnboardingGroupDto[]> {
    return this.onboarding.get(actor);
  }

  @Post(':itemId/done')
  @HttpCode(204)
  @Permissions('onboarding.use')
  @ApiOperation({ summary: 'Tick an item' })
  @ApiNoContentResponse()
  async tick(@Actor() actor: MemberActor, @Param('itemId') itemId: string): Promise<void> {
    await this.onboarding.tick(actor, itemId);
  }

  @Delete(':itemId/done')
  @HttpCode(204)
  @Permissions('onboarding.use')
  @ApiOperation({ summary: 'Untick an item' })
  @ApiNoContentResponse()
  async untick(@Actor() actor: MemberActor, @Param('itemId') itemId: string): Promise<void> {
    await this.onboarding.untick(actor, itemId);
  }
}

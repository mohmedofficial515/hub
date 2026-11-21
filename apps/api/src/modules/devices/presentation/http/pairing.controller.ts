/**
 * @file Pairing routes (docs/16 §5). `start` and `poll` are public: the device has nothing yet, and its long code is what it proves. Viewing and answering
 * are session only, so no API token or device credential can approve another device (D27 limits).
 */
import { type Principal, userCodeSchema } from '@hub/contracts';
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RateLimit } from '@/infra/throttler/rate-limit.guard';
import { SessionOnly } from '@/modules/identity';
import { AppException } from '@/shared/errors';
import { CurrentPrincipal, Permissions, Public } from '@/shared/http';

import { PairingService } from '../../application/pairing.service';
import {
  PairingPollAnswerDto,
  PairingPollDto,
  PairingStartDto,
  PairingStartedDto,
  PairingViewDto,
} from './devices.dto';

function codeOf(raw: string): string {
  const code = userCodeSchema.safeParse(raw);
  if (!code.success) throw new AppException('hub.devices.pairing_not_found');
  return code.data;
}

@ApiTags('devices')
@Controller('pairing')
export class PairingController {
  constructor(private readonly pairing: PairingService) {}

  @Post('start')
  @Public()
  @RateLimit('auth')
  @ApiOperation({ summary: 'A device asks to pair. It shows the short code and opens the approval page' })
  @ApiCreatedResponse({ type: PairingStartedDto })
  start(@Body() body: PairingStartDto): Promise<PairingStartedDto> {
    return this.pairing.start(body);
  }

  @Post('poll')
  @HttpCode(200)
  @Public()
  @RateLimit('poll')
  @ApiOperation({ summary: 'A device asks for the answer. Its credentials come back once' })
  @ApiOkResponse({ type: PairingPollAnswerDto })
  poll(@Body() body: PairingPollDto): Promise<PairingPollAnswerDto> {
    return this.pairing.poll(body.deviceCode);
  }

  @Get(':code')
  @Permissions('device.pair')
  @SessionOnly()
  @ApiOperation({ summary: 'What is asking to pair, for the approval page' })
  @ApiOkResponse({ type: PairingViewDto })
  view(@Param('code') code: string): Promise<PairingViewDto> {
    return this.pairing.view(codeOf(code));
  }

  @Post(':code/approve')
  @HttpCode(204)
  @Permissions('device.pair')
  @SessionOnly()
  @ApiOperation({ summary: 'Approve a device' })
  @ApiNoContentResponse()
  async approve(@CurrentPrincipal() principal: Principal, @Param('code') code: string): Promise<void> {
    await this.pairing.approve(principal, codeOf(code));
  }

  @Post(':code/deny')
  @HttpCode(204)
  @Permissions('device.pair')
  @SessionOnly()
  @ApiOperation({ summary: 'Refuse a device' })
  @ApiNoContentResponse()
  async deny(@CurrentPrincipal() principal: Principal, @Param('code') code: string): Promise<void> {
    await this.pairing.deny(principal, codeOf(code));
  }
}

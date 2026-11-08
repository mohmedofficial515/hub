/**
 * @file The one REST route a device credential reaches: asking whether Hub sees its bridge, for `pnpm start:local`, and giving itself up, when `hub-bridge uninstall` runs.
 */
import { type Principal } from '@hub/contracts';
import { Controller, Delete, Get, HttpCode } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AppException } from '@/shared/errors';
import { CurrentPrincipal, Permissions } from '@/shared/http';

import { DevicesService } from '../../application/devices.service';
import { BridgeSelfDto } from './devices.dto';

@ApiTags('devices')
@Controller('bridge/self')
export class BridgeSelfController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  @Permissions('device.manage')
  @ApiOperation({ summary: 'Whether Hub sees this device’s bridge connected right now' })
  @ApiOkResponse({ type: BridgeSelfDto })
  state(@CurrentPrincipal() principal: Principal): BridgeSelfDto {
    if (principal.kind !== 'agent' || !principal.deviceId) throw new AppException('hub.identity.token_scope');
    return { online: this.devices.isOnline(principal.deviceId) };
  }

  @Delete()
  @HttpCode(204)
  @Permissions('device.manage')
  @ApiOperation({ summary: 'A device revokes itself as it uninstalls' })
  @ApiNoContentResponse()
  async remove(@CurrentPrincipal() principal: Principal): Promise<void> {
    if (principal.kind !== 'agent' || !principal.deviceId) throw new AppException('hub.identity.token_scope');
    await this.devices.revoke(principal, principal.deviceId);
  }
}

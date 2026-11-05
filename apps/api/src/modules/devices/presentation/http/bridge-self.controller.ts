/**
 * @file The one REST route a device credential reaches: giving itself up, when `hub-bridge uninstall` runs.
 */
import { type Principal } from '@hub/contracts';
import { Controller, Delete, HttpCode } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AppException } from '@/shared/errors';
import { CurrentPrincipal, Permissions } from '@/shared/http';

import { DevicesService } from '../../application/devices.service';

@ApiTags('devices')
@Controller('bridge/self')
export class BridgeSelfController {
  constructor(private readonly devices: DevicesService) {}

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

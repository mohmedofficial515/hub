/**
 * @file A member's devices (Settings › Devices), and the Link button on a project (D44).
 */
import { type MemberActor, type Principal, publishingSchema } from '@hub/contracts';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { createZodDto } from 'nestjs-zod';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { SessionOnly } from '@/modules/identity';
import { Actor, CurrentPrincipal, Permissions } from '@/shared/http';

import { DevicesService } from '../../application/devices.service';
import { PublishingService } from '../../application/publishing.service';
import { connectCommand } from '../../domain/connect-script';
import { ConnectCommandDto, DeviceRowDto, FixDeviceDto, LinkFolderDto, LinkResultDto } from './devices.dto';
import { publicApiUrl } from './public-url';

class PublishingDto extends createZodDto(publishingSchema) {}

@ApiTags('devices')
@Controller('me/devices')
export class DevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly publishing: PublishingService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  @Permissions('device.manage')
  @ApiOperation({ summary: 'The member’s paired devices, with online state and the last health report' })
  @ApiOkResponse({ type: [DeviceRowDto] })
  list(@CurrentPrincipal() principal: Principal): Promise<DeviceRowDto[]> {
    return this.devices.list(principal.userId);
  }

  @Get('connect-command')
  @Permissions('device.manage')
  @ApiOperation({
    summary: 'The one command that connects a new device, and the one that removes Hub from it',
  })
  @ApiOkResponse({ type: ConnectCommandDto })
  connectCommand(@Req() request: Request): ConnectCommandDto {
    const apiUrl = publicApiUrl(this.config, request);
    return {
      apiUrl,
      connect: connectCommand(apiUrl),
      uninstall: connectCommand(apiUrl, 'uninstall'),
    };
  }

  @Get('publishing')
  @Permissions('device.manage')
  @ApiOperation({
    summary:
      'How other devices reach Hub: the public URL, Secure cookies, where the API listens, and what Tailscale serves',
  })
  @ApiOkResponse({ type: PublishingDto })
  publishingStatus(@Req() request: Request): Promise<PublishingDto> {
    // `Cache-Control: no-cache` is the page's "Check again": the facts are read again rather than from the 30 s cache.
    return this.publishing.status({ fresh: /no-cache/i.test(request.headers['cache-control'] ?? '') });
  }

  @Get(':id/health')
  @Permissions('device.manage')
  @ApiOperation({ summary: 'Runs the device’s health checks now. Offline, the last report stands' })
  @ApiOkResponse({ type: DeviceRowDto })
  health(@CurrentPrincipal() principal: Principal, @Param('id') id: string): Promise<DeviceRowDto> {
    return this.devices.health(principal, id);
  }

  @Post(':id/fix')
  @HttpCode(200)
  @Permissions('device.manage')
  @ApiOperation({ summary: 'Runs one fix from the closed list on the device, then its checks' })
  @ApiOkResponse({ type: DeviceRowDto })
  fix(
    @CurrentPrincipal() principal: Principal,
    @Param('id') id: string,
    @Body() body: FixDeviceDto,
  ): Promise<DeviceRowDto> {
    return this.devices.fix(principal, id, body.fix);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions('device.manage')
  @ApiOperation({ summary: 'Revoke a device. Its credentials stop at once and its socket closes' })
  @ApiNoContentResponse()
  async revoke(@CurrentPrincipal() principal: Principal, @Param('id') id: string): Promise<void> {
    await this.devices.revoke(principal, id);
  }
}

@ApiTags('devices')
@Controller('workspaces/:ws/devices')
export class WorkspaceDevicesController {
  constructor(private readonly devices: DevicesService) {}

  /** Session only on purpose: D44 lets Hub write a folder's trust only on the owner's own press, so no agent can do this. */
  @Post(':id/link')
  @HttpCode(200)
  @Permissions('device.link')
  @SessionOnly()
  @ApiOperation({ summary: 'Link a folder on this device to the project, and accept its trust (D44)' })
  @ApiOkResponse({ type: LinkResultDto })
  link(
    @Actor() actor: MemberActor,
    @Param('id') id: string,
    @Body() body: LinkFolderDto,
  ): Promise<LinkResultDto> {
    return this.devices.link(actor, id, body.folder);
  }
}

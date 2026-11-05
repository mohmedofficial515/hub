/**
 * @file Settings routes (docs/04 §3.6).
 */
import { type MemberActor, settingsCatalogue } from '@hub/contracts';
import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Actor, Permissions } from '@/shared/http';

import { SettingsService } from '../../application/settings.service';
import { PutSettingDto, SettingCatalogueRowDto, SettingRowDto } from './workspaces.dto';

@ApiTags('settings')
@Controller('workspaces/:ws/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Permissions('settings.read')
  @ApiOperation({ summary: 'Every setting with its value and default' })
  @ApiOkResponse({ type: [SettingRowDto] })
  list(@Actor() actor: MemberActor): Promise<SettingRowDto[]> {
    return this.settings.list(actor.workspaceId);
  }

  @Get('catalogue')
  @Permissions('settings.read')
  @ApiOperation({ summary: 'What each setting means and what it accepts' })
  @ApiOkResponse({ type: [SettingCatalogueRowDto] })
  catalogue(): SettingCatalogueRowDto[] {
    return settingsCatalogue();
  }

  @Put(':key')
  @Permissions('settings.write')
  @ApiOperation({ summary: 'Change one setting' })
  @ApiOkResponse({ type: SettingRowDto })
  put(
    @Actor() actor: MemberActor,
    @Param('key') key: string,
    @Body() body: PutSettingDto,
  ): Promise<SettingRowDto> {
    return this.settings.put(actor, key, body.value);
  }

  @Delete(':key')
  @Permissions('settings.write')
  @ApiOperation({ summary: 'Put one setting back to its default' })
  @ApiOkResponse({ type: SettingRowDto })
  reset(@Actor() actor: MemberActor, @Param('key') key: string): Promise<SettingRowDto> {
    return this.settings.reset(actor, key);
  }
}

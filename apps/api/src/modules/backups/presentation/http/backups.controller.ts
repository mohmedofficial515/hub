/**
 * @file Settings › Backups (docs/16 D61 to D63). The owner's alone, and only from the web: no token and no agent can start, keep or
 * delete a backup, or move where they go. There is no restore route: restoring is `pnpm hub:restore`, run by the owner with Hub stopped.
 */
import {
  backupSchema,
  backupSettingsInputSchema,
  backupSettingsSchema,
  backupsSchema,
  type MemberActor,
  pinBackupSchema,
} from '@hub/contracts';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import { SessionOnly } from '@/modules/identity';
import { Actor, Permissions } from '@/shared/http';

import { BackupsService } from '../../application/backups.service';

class BackupDto extends createZodDto(backupSchema) {}
class BackupsDto extends createZodDto(backupsSchema) {}
class BackupSettingsDto extends createZodDto(backupSettingsSchema) {}
class BackupSettingsInputDto extends createZodDto(backupSettingsInputSchema) {}
class PinBackupDto extends createZodDto(pinBackupSchema) {}

@ApiTags('backups')
@Controller('workspaces/:ws/backups')
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Get()
  @Permissions('backup.manage')
  @SessionOnly()
  @ApiOperation({
    summary: 'The backup history, the settings, the next nightly time and the free space on the backup drive',
  })
  @ApiOkResponse({ type: BackupsDto })
  list(): Promise<BackupsDto> {
    return this.backups.list();
  }

  @Post()
  @HttpCode(202)
  @Permissions('backup.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Back up now. Answers the running backup; the history shows how it ends' })
  @ApiAcceptedResponse({ type: BackupDto })
  run(@Actor() actor: MemberActor): Promise<BackupDto> {
    return this.backups.runNow(actor);
  }

  @Patch('settings')
  @Permissions('backup.manage')
  @SessionOnly()
  @ApiOperation({
    summary: 'The folder, the nightly time, how many unpinned backups to keep, and whether the night runs',
  })
  @ApiOkResponse({ type: BackupSettingsDto })
  settings(@Actor() actor: MemberActor, @Body() body: BackupSettingsInputDto): Promise<BackupSettingsDto> {
    return this.backups.updateSettings(actor, body);
  }

  @Post(':id/pin')
  @HttpCode(200)
  @Permissions('backup.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Keep a backup forever (pinned: true), or hand it back to the retention rule' })
  @ApiOkResponse({ type: BackupDto })
  pin(@Actor() actor: MemberActor, @Param('id') id: string, @Body() body: PinBackupDto): Promise<BackupDto> {
    return this.backups.pin(actor, id, body.pinned);
  }

  @Delete(':id')
  @Permissions('backup.manage')
  @SessionOnly()
  @ApiOperation({ summary: 'Delete a backup’s files. The history keeps the line, marked deleted' })
  @ApiOkResponse({ type: BackupDto })
  remove(@Actor() actor: MemberActor, @Param('id') id: string): Promise<BackupDto> {
    return this.backups.remove(actor, id);
  }
}

/**
 * @file Nightly backups of the main machine (docs/16 §10, D61 to D63): the history, the settings, and the scheduler in the API process.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '@/modules/audit';
import { NotificationsModule } from '@/modules/notifications';

import { BackupMachine } from './application/backup-machine';
import { BackupScheduler } from './application/backup-scheduler';
import { BackupsService } from './application/backups.service';
import { BackupsController } from './presentation/http/backups.controller';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [BackupsController],
  providers: [BackupMachine, BackupsService, BackupScheduler],
  exports: [BackupsService, BackupScheduler, BackupMachine],
})
export class BackupsModule {}

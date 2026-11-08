/**
 * @file Skills (docs/16 §11, D64 to D66): Hub's skills, written through Hub with revisions, the owner's personal ones read only with Move to Hub, and Sync now.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '@/modules/audit';
import { DevicesModule } from '@/modules/devices';

import { SkillFolders } from './application/skill-folders';
import { SkillsService } from './application/skills.service';
import { SkillsController } from './presentation/http/skills.controller';

@Module({
  imports: [AuditModule, DevicesModule],
  controllers: [SkillsController],
  providers: [SkillFolders, SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}

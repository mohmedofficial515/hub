/**
 * @file Schema Studio (docs/17): a project's database design, read from its Prisma files, named in Arabic, and changed through drafts reviewed in a chat.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '@/modules/audit';
import { DevicesModule } from '@/modules/devices';
import { IdentityModule } from '@/modules/identity';
import { WorkspacesModule } from '@/modules/workspaces';

import { SchemaReader } from './application/schema-reader';
import { SchemaStudioService } from './application/schema-studio.service';
import { SchemaStudioController } from './presentation/http/schema.controller';

@Module({
  imports: [AuditModule, DevicesModule, IdentityModule, WorkspacesModule],
  controllers: [SchemaStudioController],
  providers: [SchemaReader, SchemaStudioService],
  exports: [SchemaStudioService],
})
export class SchemaStudioModule {}

/**
 * @file Audit: every module writes through `AuditService`; owner and pm read through the list endpoint.
 */
import { Module } from '@nestjs/common';

import { AuditService } from './application/audit.service';
import { AuditQueryService } from './application/audit-query.service';
import { AuditController } from './presentation/http/audit.controller';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditQueryService],
  exports: [AuditQueryService, AuditService],
})
export class AuditModule {}

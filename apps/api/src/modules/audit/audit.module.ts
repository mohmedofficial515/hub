/**
 * @file Audit module. The read endpoint (`GET /workspaces/:ws/audit`) belongs to H5-04.
 */
import { Module } from '@nestjs/common';

import { AuditService } from './application/audit.service';

@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}

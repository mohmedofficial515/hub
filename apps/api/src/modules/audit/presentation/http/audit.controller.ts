/**
 * @file `GET /workspaces/{ws}/audit`, for owner and pm (docs/04 §3.21).
 */
import { auditQuerySchema, auditRowSchema, type MemberActor } from '@hub/contracts';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import { Actor, Permissions } from '@/shared/http';

import { AuditQueryService } from '../../application/audit-query.service';

class AuditQueryDto extends createZodDto(auditQuerySchema) {}
class AuditRowDto extends createZodDto(auditRowSchema) {}

@ApiTags('audit')
@Controller('workspaces/:ws/audit')
export class AuditController {
  constructor(private readonly audit: AuditQueryService) {}

  @Get()
  @Permissions('audit.read')
  @ApiOperation({ summary: 'Who did what, newest first' })
  @ApiOkResponse({ type: AuditRowDto, isArray: true })
  list(@Actor() actor: MemberActor, @Query() query: AuditQueryDto) {
    return this.audit.list(actor, query);
  }
}

/**
 * @file `GET /workspaces/{ws}/audit`, for owner and pm (docs/04 §3.21).
 */
import { auditQuerySchema, auditRowSchema, type MemberActor } from '@hub/contracts';
import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';

import { Actor, Permissions, RawResponse } from '@/shared/http';

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

  @Get('export.csv')
  @Permissions('audit.read')
  @RawResponse()
  @ApiOperation({ summary: 'The same filters as a CSV file, up to 50 000 rows' })
  async csv(
    @Actor() actor: MemberActor,
    @Query() query: AuditQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const body = await this.audit.csv(actor, query);
    response.status(200);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="audit.csv"');
    response.end(body);
  }
}

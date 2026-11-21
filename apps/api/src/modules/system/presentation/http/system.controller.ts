/**
 * @file Running sources, the system page and `/metrics` (docs/04 §3.7, §3.14, §3.15, §3.23).
 */
import { timingSafeEqual } from 'node:crypto';

import { type MemberActor, reindexSchema, runAcceptedSchema, systemSchema } from '@hub/contracts';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { QUEUES, QueueService } from '@/infra/queue/queue.service';
import { AppException } from '@/shared/errors';
import { Actor, Permissions, Public, RawResponse } from '@/shared/http';

import { SourceRunnerService } from '../../application/source-runner.service';
import { SystemService } from '../../application/system.service';

class RunAcceptedDto extends createZodDto(runAcceptedSchema) {}
class ReindexDto extends createZodDto(reindexSchema) {}
class SystemDto extends createZodDto(systemSchema) {}
class RunsQueryDto extends createZodDto(
  z.object({
    source: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
) {}

@ApiTags('system')
@Controller('workspaces/:ws')
export class SystemController {
  constructor(
    private readonly runner: SourceRunnerService,
    private readonly system: SystemService,
    private readonly queues: QueueService,
  ) {}

  private async start(workspaceId: string, sourceId: string): Promise<{ runId: string }> {
    const runId = await this.runner.open(workspaceId, sourceId);
    await this.queues.add(QUEUES.capture, 'run', { workspaceId, runId });
    return { runId };
  }

  @Post('sources/:id/run')
  @HttpCode(202)
  @Permissions('source.run')
  @ApiOperation({ summary: 'Run a source now. `source.run` on the stream says how it went.' })
  @ApiAcceptedResponse({ type: RunAcceptedDto })
  run(@Actor() actor: MemberActor, @Param('id', ParseUUIDPipe) id: string) {
    return this.start(actor.workspaceId, id);
  }

  @Post('docs/reindex')
  @HttpCode(202)
  @Permissions('docs.reindex')
  @ApiOperation({ summary: 'Index one docs source, or all of them, now' })
  @ApiAcceptedResponse({ type: RunAcceptedDto })
  async reindex(@Actor() actor: MemberActor, @Body() body: ReindexDto) {
    const sources = body.source
      ? [{ id: body.source }]
      : await this.runner.sourcesFor(actor.workspaceId, 'docs');
    if (sources.length === 0) throw new AppException('hub.common.not_found');
    const runs = await Promise.all(sources.map((source) => this.start(actor.workspaceId, source.id)));
    return { runId: runs[0]?.runId ?? '' };
  }

  @Post('redesign/rescan')
  @HttpCode(202)
  @Permissions('redesign.rescan')
  @ApiOperation({ summary: 'Scan the lab folder now' })
  @ApiAcceptedResponse({ type: RunAcceptedDto })
  async rescan(@Actor() actor: MemberActor) {
    const [source] = await this.runner.sourcesFor(actor.workspaceId, 'lab');
    if (!source) throw new AppException('hub.redesign.lab_unavailable');
    return this.start(actor.workspaceId, source.id);
  }

  @Get('capture/runs')
  @Permissions('source.manage')
  @ApiOperation({ summary: 'Runs of the sources, newest first' })
  runs(@Actor() actor: MemberActor, @Query() query: RunsQueryDto) {
    return this.runner.runs(actor, query.source, query.limit);
  }

  @Get('system')
  @Permissions('source.manage')
  @ApiOperation({ summary: 'Sources, queues, outbox, streams, database, worker' })
  @ApiOkResponse({ type: SystemDto })
  get(@Actor() actor: MemberActor) {
    return this.system.get(actor.workspaceId);
  }
}

/** With no `METRICS_TOKEN` metrics are off (docs/13 §6): not found, so nothing says they exist. */
@ApiTags('system')
@Controller()
export class MetricsController {
  constructor(
    private readonly system: SystemService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private allowed(header: string | undefined): boolean {
    const token = this.config.METRICS_TOKEN;
    if (!token || !header?.startsWith('Bearer ')) return false;
    const given = Buffer.from(header.slice('Bearer '.length));
    const wanted = Buffer.from(token);
    return given.length === wanted.length && timingSafeEqual(given, wanted);
  }

  @Get('metrics')
  @Public()
  @RawResponse()
  @ApiOperation({ summary: 'Prometheus text, with `Authorization: Bearer <METRICS_TOKEN>`' })
  async metrics(
    @Headers('authorization') header: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (!this.allowed(header)) throw new AppException('hub.common.not_found');
    response.status(200);
    response.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    response.end(await this.system.metrics());
  }
}

/**
 * @file `GET /workspaces/{ws}/events/stream`: the member's live stream (docs/04 §3.22, docs/15 §7).
 * @description `Last-Event-ID` replays from the project's Redis stream. A cursor too old to resume answers
 * `event: resync`, so the page refetches rather than silently missing changes.
 */
import {
  type MemberActor,
  REALTIME_REPLAY,
  type RealtimeCardEvent,
  type RealtimeEnvelope,
  type RealtimeMessage,
  workspaceEventsStream,
} from '@hub/contracts';
import { Controller, Get, Headers, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { RedisClients } from '@/infra/redis/redis.module';
import { Actor, Permissions, RawResponse } from '@/shared/http';

import { RealtimeHub, RealtimeTimings } from '../../application/realtime-hub';
import { compareStreamIds, frame, isForMember, isValidStreamId, toFrames } from '../../domain/sse-format';

@ApiTags('events')
@Controller('workspaces/:ws/events')
export class EventsController {
  constructor(
    private readonly hub: RealtimeHub,
    private readonly redis: RedisClients,
    private readonly timings: RealtimeTimings,
  ) {}

  @Get('stream')
  @RawResponse()
  @Permissions('card.read')
  @ApiOperation({ summary: 'Live events of this project, for this member' })
  @ApiProduces('text/event-stream')
  async stream(
    @Actor() actor: MemberActor,
    @Req() request: Request,
    @Res() response: Response,
    @Headers('last-event-id') lastEventId: string | undefined,
  ): Promise<void> {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    const member = { userId: actor.userId, roles: actor.roles };
    let lastSent = lastEventId && isValidStreamId(lastEventId) ? lastEventId : '0-0';
    const send = (message: RealtimeMessage): void => {
      if (compareStreamIds(message.streamId, lastSent) <= 0) return;
      lastSent = message.streamId;
      if (isForMember(message, member)) response.write(toFrames(message));
    };

    // Until the replay is done, hold live messages: they are newer than anything it finds.
    let held: RealtimeMessage[] | null = [];
    const leave = await this.hub.register(actor.workspaceId, {
      deliver: (message) => {
        if (held) held.push(message);
        else send(message);
      },
    });

    const heartbeat = setInterval(() => response.write(': ping\n\n'), this.timings.heartbeatMs);
    const limit = setTimeout(() => response.end(), this.timings.maxConnectionMs);
    const close = (): void => {
      clearInterval(heartbeat);
      clearTimeout(limit);
      leave();
    };
    request.on('close', close);

    response.write('retry: 3000\n\n: connected\n\n');
    if (lastEventId) await this.replay(actor.workspaceId, lastEventId, send, response);
    const pending = held;
    held = null;
    for (const message of pending) send(message);
  }

  private async replay(
    workspaceId: string,
    lastEventId: string,
    send: (message: RealtimeMessage) => void,
    response: Response,
  ): Promise<void> {
    const stream = workspaceEventsStream(workspaceId);
    const entries = isValidStreamId(lastEventId)
      ? await this.redis.main.xrange(stream, `(${lastEventId}`, '+')
      : [];
    const [oldest] = await this.redis.main.xrange(stream, '-', '+', 'COUNT', 1);
    const tooOld =
      !isValidStreamId(lastEventId) ||
      Date.now() - Number(lastEventId.split('-')[0]) > REALTIME_REPLAY.maxAgeMs ||
      (oldest !== undefined && entries.length > 0 && compareStreamIds(lastEventId, oldest[0]) < 0);
    if (tooOld) {
      response.write(frame(null, 'resync', { reason: 'cursor_too_old' }));
      return;
    }
    for (const [streamId, fields] of entries) {
      const raw = fields[fields.indexOf('message') + 1];
      if (!raw) continue;
      send({ ...(JSON.parse(raw) as RealtimeCardEvent | RealtimeEnvelope), streamId });
    }
  }
}

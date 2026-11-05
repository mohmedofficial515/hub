/**
 * @file Root module. New bounded contexts join `imports` here.
 */
import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import type { Request } from 'express';
import { ClsModule } from 'nestjs-cls';
import { ZodValidationPipe } from 'nestjs-zod';

import { ConfigModule } from './config/config.module';
import { ClockModule } from './infra/clock/clock';
import { AppI18nModule } from './infra/i18n/i18n.module';
import { AppLoggerModule } from './infra/logger/logger.module';
import { OutboxModule } from './infra/outbox/outbox';
import { PrismaModule, prismaTransactionalPlugin } from './infra/prisma/prisma.module';
import { QueueModule } from './infra/queue/queue.service';
import { RedisModule } from './infra/redis/redis.module';
import { AuditModule, CLS_IP, CLS_USER_AGENT } from './modules/audit';
import { CaptureModule } from './modules/capture';
import { CardsModule } from './modules/cards';
import { DecisionsModule } from './modules/decisions';
import { DocsModule } from './modules/docs';
import { HandoffsModule } from './modules/handoffs';
import { HealthModule } from './modules/health';
import { IdeasModule } from './modules/ideas';
import { IdentityModule } from './modules/identity';
import { McpModule } from './modules/mcp';
import { NeedsModule } from './modules/needs';
import { NotificationsModule } from './modules/notifications';
import { PlansModule } from './modules/plans';
import { RealtimeModule } from './modules/realtime';
import { RedesignModule } from './modules/redesign';
import { ReleasesModule } from './modules/releases';
import { TasksModule } from './modules/tasks';
import { WorkspacesModule } from './modules/workspaces';
import { AllExceptionsFilter, EnvelopeInterceptor } from './shared/http';

const REQUEST_ID_HEADER = 'x-request-id';

@Module({
  imports: [
    ConfigModule,
    ClockModule,
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (request: Request) => request.header(REQUEST_ID_HEADER) ?? randomUUID(),
        setup: (cls, request: Request) => {
          cls.set(CLS_IP, request.ip);
          cls.set(CLS_USER_AGENT, request.header('user-agent'));
        },
      },
      plugins: [prismaTransactionalPlugin()],
    }),
    AppLoggerModule,
    AppI18nModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    OutboxModule,
    IdentityModule,
    AuditModule,
    CardsModule,
    NotificationsModule,
    TasksModule,
    DecisionsModule,
    NeedsModule,
    HandoffsModule,
    RedesignModule,
    DocsModule,
    ReleasesModule,
    IdeasModule,
    PlansModule,
    RealtimeModule,
    HealthModule,
    WorkspacesModule,
    CaptureModule,
    McpModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}

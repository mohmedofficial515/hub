/**
 * @file Cards core. Type modules import this and declare `@CardActionHandler()` providers.
 */
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { AuditModule } from '@/modules/audit';

import {
  CardCommentAction,
  CardCommentEditAction,
  CardCommentRedactAction,
} from './application/actions/card-comment.actions';
import { CardEditAction } from './application/actions/card-edit.action';
import {
  CardDeleteAction,
  CardRestoreAction,
  CardUnblockAction,
} from './application/actions/card-lifecycle.actions';
import { CardLinkAction } from './application/actions/card-link.action';
import { CardWatchAction } from './application/actions/card-watch.action';
import { CardService } from './application/card.service';
import { CardActionRegistry } from './application/card-action.registry';
import { CardEventHooks } from './application/card-event-hooks';
import { CardQueryService } from './application/card-query.service';
import { IdempotencyService } from './application/idempotency.service';
import { CardReader } from './application/ports/card.reader';
import { CardRepository } from './application/ports/card.repository';
import { PrismaCardReader } from './infrastructure/prisma-card.reader';
import { PrismaCardRepository } from './infrastructure/prisma-card.repository';
import { CardsController } from './presentation/http/cards.controller';
import { IdempotencyInterceptor } from './presentation/http/idempotency.interceptor';
import { TimelineController } from './presentation/http/timeline.controller';

@Module({
  imports: [DiscoveryModule, AuditModule],
  controllers: [CardsController, TimelineController],
  providers: [
    CardService,
    CardActionRegistry,
    CardEventHooks,
    CardQueryService,
    IdempotencyService,
    IdempotencyInterceptor,
    { provide: CardRepository, useClass: PrismaCardRepository },
    { provide: CardReader, useClass: PrismaCardReader },
    CardEditAction,
    CardDeleteAction,
    CardRestoreAction,
    CardUnblockAction,
    CardCommentAction,
    CardCommentEditAction,
    CardCommentRedactAction,
    CardLinkAction,
    CardWatchAction,
  ],
  exports: [
    CardService,
    CardActionRegistry,
    CardEventHooks,
    CardRepository,
    CardReader,
    CardQueryService,
    IdempotencyService,
    IdempotencyInterceptor,
  ],
})
export class CardsModule {}

/**
 * @file Capture: Claude Code sessions (H1-02) and the one-time Goteav import (H0-09).
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';
import { IdentityModule } from '@/modules/identity';
import { WorkspacesModule } from '@/modules/workspaces';

import { SessionChangeCreateAction, SessionLogAction } from './application/session-actions';
import { SessionContextService } from './application/session-context.service';
import { SessionReconcileProcessor } from './application/session-reconcile.processor';
import { SessionsService } from './application/sessions.service';
import { CaptureController } from './presentation/http/capture.controller';

@Module({
  imports: [CardsModule, IdentityModule, WorkspacesModule],
  controllers: [CaptureController],
  providers: [
    SessionChangeCreateAction,
    SessionLogAction,
    SessionContextService,
    SessionReconcileProcessor,
    SessionsService,
  ],
  exports: [SessionContextService, SessionsService],
})
export class CaptureModule {}

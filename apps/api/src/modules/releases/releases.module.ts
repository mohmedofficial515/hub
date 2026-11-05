/**
 * @file Releases: what shipped, with notes per audience.
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import { ReleaseCreateAction, ReleaseEditAction, ReleaseReleaseAction } from './application/release-actions';
import { ReleaseNotesService } from './application/release-notes.service';
import { ReleasesController } from './presentation/http/releases.controller';

@Module({
  imports: [CardsModule],
  controllers: [ReleasesController],
  providers: [ReleaseNotesService, ReleaseCreateAction, ReleaseEditAction, ReleaseReleaseAction],
})
export class ReleasesModule {}

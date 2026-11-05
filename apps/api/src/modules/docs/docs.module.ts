/**
 * @file Docs (H2-06 in local path mode). `doc.create` is system only: the indexer creates them.
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import { DocMarkCurrentAction, DocMarkRemovedAction, DocUpdateAction } from './application/doc-actions';
import { DocCreateAction } from './application/doc-create.action';
import { DocsIndexerService } from './application/docs-indexer.service';
import { DocsReadService } from './application/docs-read.service';
import { DocsController } from './presentation/http/docs.controller';

@Module({
  imports: [CardsModule],
  controllers: [DocsController],
  providers: [
    DocCreateAction,
    DocUpdateAction,
    DocMarkRemovedAction,
    DocMarkCurrentAction,
    DocsIndexerService,
    DocsReadService,
  ],
  exports: [DocsIndexerService, DocsReadService],
})
export class DocsModule {}

/**
 * @file Docs (H2-06 in local path mode). `doc.create` is system only: the indexer creates them.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '@/modules/audit';
import { CardsModule } from '@/modules/cards';
import { DevicesModule } from '@/modules/devices';
import { SearchModule } from '@/modules/search';

import { DocMarkCurrentAction, DocMarkRemovedAction, DocUpdateAction } from './application/doc-actions';
import { DocCreateAction } from './application/doc-create.action';
import { DocImagesService } from './application/doc-images.service';
import { DocsIndexerService } from './application/docs-indexer.service';
import { DocsReadService } from './application/docs-read.service';
import { DocsWriteService } from './application/docs-write.service';
import { DocsController } from './presentation/http/docs.controller';

@Module({
  imports: [AuditModule, CardsModule, DevicesModule, SearchModule],
  controllers: [DocsController],
  providers: [
    DocCreateAction,
    DocImagesService,
    DocUpdateAction,
    DocMarkRemovedAction,
    DocMarkCurrentAction,
    DocsIndexerService,
    DocsReadService,
    DocsWriteService,
  ],
  exports: [DocsIndexerService, DocsReadService, DocsWriteService],
})
export class DocsModule {}

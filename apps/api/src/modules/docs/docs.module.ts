/**
 * @file Docs: read-only cards mirroring Markdown files. The indexer joins this module in H2-06.
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import { DocCreateAction } from './application/doc-create.action';
import { DocsController } from './presentation/http/docs.controller';

@Module({
  imports: [CardsModule],
  controllers: [DocsController],
  providers: [DocCreateAction],
})
export class DocsModule {}

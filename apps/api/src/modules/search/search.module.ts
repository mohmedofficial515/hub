/**
 * @file Search (H2-06). Semantic search stays deferred (H5-02).
 */
import { Module } from '@nestjs/common';

import { CardsModule } from '@/modules/cards';

import { SearchService } from './application/search.service';
import { SearchController } from './presentation/http/search.controller';

@Module({
  imports: [CardsModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

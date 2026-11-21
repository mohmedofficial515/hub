/**
 * @file `GET /search` and `GET /docs/search` (docs/04 §3.9, §3.15).
 */
import {
  docHitSchema,
  docSearchQuerySchema,
  type MemberActor,
  searchQuerySchema,
  searchResultSchema,
} from '@hub/contracts';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import { RateLimit } from '@/infra/throttler/rate-limit.guard';
import { Actor, Permissions } from '@/shared/http';

import { SearchService } from '../../application/search.service';

class SearchQueryDto extends createZodDto(searchQuerySchema) {}
class SearchResultDto extends createZodDto(searchResultSchema) {}
class DocSearchQueryDto extends createZodDto(docSearchQuerySchema) {}
class DocHitDto extends createZodDto(docHitSchema) {}

@ApiTags('search')
@Controller('workspaces/:ws')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('search')
  @Permissions('card.read')
  @RateLimit('search')
  @ApiOperation({ summary: 'Cards and documents, Arabic and English' })
  @ApiOkResponse({ type: SearchResultDto })
  all(@Actor() actor: MemberActor, @Query() query: SearchQueryDto) {
    return this.search.search(actor, query);
  }

  @Get('docs/search')
  @Permissions('docs.read')
  @RateLimit('search')
  @ApiOperation({ summary: 'Documents only, grouped, with excerpts' })
  @ApiOkResponse({ type: DocHitDto, isArray: true })
  docs(@Actor() actor: MemberActor, @Query() query: DocSearchQueryDto) {
    return this.search.docs(actor, query.q, query.kinds, query.limit);
  }
}

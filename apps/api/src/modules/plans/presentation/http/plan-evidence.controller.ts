/**
 * @file A plan step's evidence (v5-live-plan, batch 3): add a file to a step, remove one, and serve an uploaded attachment's bytes.
 * @description The upload is `multipart/form-data` with one `file` and the fields `kind` and `caption`; multer holds it in memory with a hard limit
 * above the largest clip, and Hub reads the bytes itself. The bytes are served with their own type only, `nosniff`, a CSP that runs nothing and
 * `Content-Disposition: inline`, and a range for a clip so a player can seek.
 */
import { addStepEvidenceSchema, type MemberActor, PLAN_EVIDENCE_LIMITS } from '@hub/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CardQueryService, CardWrittenResponseDto } from '@/modules/cards';
import { AppException } from '@/shared/errors';
import { Actor, Permissions, RawResponse } from '@/shared/http';

import { PlanEvidenceService } from '../../application/plan-evidence.service';

class AddEvidenceDto extends createZodDto(addStepEvidenceSchema) {}
/** `thumb`: a picture's small WebP, for a grid. */
class FileQueryDto extends createZodDto(z.object({ size: z.enum(['full', 'thumb']).optional() })) {}

interface UploadedEvidence {
  originalname: string;
  buffer: Buffer;
  size: number;
}

/** Nothing a served file carries may run or load. */
const FILE_CSP = "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox";
const SERVED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'text/vtt'];

/** `bytes=a-b`, `bytes=a-` or `bytes=-n` against a length; null for anything else, which is answered whole. */
export function rangeOf(
  header: string | undefined,
  length: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '');
  if (!match || (match[1] === '' && match[2] === '')) return null;
  let start: number;
  let end: number;
  if (match[1] === '') {
    start = Math.max(0, length - Number(match[2]));
    end = length - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? length - 1 : Math.min(Number(match[2]), length - 1);
  }
  if (start >= length || start > end) return 'unsatisfiable';
  return { start, end };
}

@ApiTags('plans')
@Controller('workspaces/:ws')
export class PlanEvidenceController {
  constructor(
    private readonly evidence: PlanEvidenceService,
    private readonly query: CardQueryService,
  ) {}

  @Post('plans/:key/steps/:stepId/evidence')
  @HttpCode(200)
  @Permissions('plan.add_evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PLAN_EVIDENCE_LIMITS.videoBytes + 1, files: 1, fields: 4 },
    }),
  )
  @ApiOperation({
    summary:
      "Add a picture (before or after) or a clip (video) to a plan step's evidence. PNG, JPEG or WebP up to 8 MB, kept without metadata; MP4 or WebM up to 40 MB",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'kind'],
      properties: {
        file: { type: 'string', format: 'binary' },
        kind: { type: 'string', enum: ['before', 'after', 'video'] },
        caption: { type: 'string', maxLength: 200 },
      },
    },
  })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  @ApiResponse({ status: 413, description: 'hub.plans.evidence_too_large' })
  @ApiResponse({
    status: 415,
    description: 'hub.plans.evidence_type (SVG, HTML and anything not a picture or clip)',
  })
  @ApiResponse({ status: 422, description: 'hub.plans.evidence_kind · hub.plans.evidence_damaged' })
  @ApiResponse({ status: 409, description: 'hub.plans.evidence_full (10 files on a step)' })
  async add(
    @Actor() actor: MemberActor,
    @Param('ws') ws: string,
    @Param('key') key: string,
    @Param('stepId') stepId: string,
    @Body() body: AddEvidenceDto,
    @UploadedFile() file: UploadedEvidence | undefined,
  ) {
    if (!file) throw new AppException('hub.common.validation', { details: { issues: [{ path: 'file' }] } });
    const result = await this.evidence.add(actor, ws, key, stepId, {
      ...body,
      data: file.buffer,
      name: file.originalname,
      via: 'web',
    });
    return this.query.written(actor, result);
  }

  @Delete('plans/:key/steps/:stepId/evidence/:attachmentId')
  // Anyone may remove what they added; the plan's owner, a pm and its creator anything. The action judges the file.
  @Permissions('plan.remove_own_evidence')
  @ApiOperation({
    summary:
      "Remove a file from a plan step's evidence, and its bytes. The plan's owner, a pm and its creator remove any; anyone what they added",
  })
  @ApiOkResponse({ type: CardWrittenResponseDto })
  async remove(
    @Actor() actor: MemberActor,
    @Param('key') key: string,
    @Param('stepId') stepId: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
  ) {
    return this.query.written(actor, await this.evidence.remove(actor, key, stepId, attachmentId));
  }

  @Get('cards/:key/attachments/:attachmentId/file')
  @Permissions('card.read')
  @RawResponse()
  @ApiOperation({
    summary: "An uploaded attachment's bytes, such as a plan step's evidence. A range for a clip",
  })
  @ApiProduces(...SERVED_TYPES)
  @ApiOkResponse({
    description: 'The bytes, with nosniff, a CSP that runs nothing and an ETag',
    content: Object.fromEntries(
      SERVED_TYPES.map((type) => [type, { schema: { type: 'string', format: 'binary' } }]),
    ),
  })
  @ApiResponse({ status: 206, description: 'The asked range' })
  @ApiResponse({ status: 404, description: 'hub.plans.evidence_not_found' })
  async file(
    @Actor() actor: MemberActor,
    @Param('key') key: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @Query() query: FileQueryDto,
    @Headers('range') range: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.evidence.file(actor, key, attachmentId, query.size ?? 'full');
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.setHeader('ETag', file.etag);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', FILE_CSP);
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', file.mime);
    if (ifNoneMatch === file.etag) {
      response.status(304).end();
      return;
    }
    const asked = rangeOf(range, file.data.length);
    if (asked === 'unsatisfiable') {
      response.setHeader('Content-Range', `bytes */${file.data.length}`);
      response.status(416).end();
      return;
    }
    if (asked) {
      const part = file.data.subarray(asked.start, asked.end + 1);
      response.status(206);
      response.setHeader('Content-Range', `bytes ${asked.start}-${asked.end}/${file.data.length}`);
      response.setHeader('Content-Length', part.length);
      response.end(part);
      return;
    }
    response.status(200);
    response.setHeader('Content-Length', file.data.length);
    response.end(file.data);
  }
}

/**
 * @file What a new device downloads, without signing in (docs/16 §5): the short script, and the bridge's files. Neither holds a secret.
 */
import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { RateLimit } from '@/infra/throttler/rate-limit.guard';
import { Public, RawResponse } from '@/shared/http';

import { ConnectBundleService } from '../../application/connect-bundle.service';
import { bootstrapScript, type ConnectAction } from '../../domain/connect-script';
import { publicApiUrl } from './public-url';

@ApiExcludeController()
@Controller('connect')
export class ConnectController {
  constructor(
    private readonly bundle: ConnectBundleService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('bootstrap')
  @Public()
  @RateLimit('poll')
  @RawResponse()
  bootstrap(
    @Req() request: Request,
    @Res() response: Response,
    @Query('action') action: string | undefined,
  ): void {
    const chosen: ConnectAction = action === 'uninstall' ? 'uninstall' : 'connect';
    response
      .type('text/plain')
      .setHeader('Cache-Control', 'no-store')
      .send(bootstrapScript(publicApiUrl(this.config, request), chosen));
  }

  @Get('bundle')
  @Public()
  @RateLimit('poll')
  @RawResponse()
  files(@Res() response: Response): void {
    response.setHeader('Cache-Control', 'no-store').json({ files: this.bundle.files() });
  }
}

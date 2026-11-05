/**
 * @file HTTP setup shared by main.ts, the OpenAPI export and the e2e harness (docs/12 H0-02).
 */
import { type INestApplication, RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { APP_CONFIG, type AppConfig } from './config/config.module';

export const API_PREFIX = 'api/v1';

export function configureApp(app: INestApplication): void {
  // MCP lives at `/mcp`, the address the team pack writes (docs/05 §2.1).
  app.setGlobalPrefix(API_PREFIX, { exclude: [{ path: 'mcp', method: RequestMethod.ALL }] });
  // A plan's body alone may be 100 000 characters of Arabic (docs/15 §4).
  (app as NestExpressApplication).useBodyParser('json', { limit: '1mb' });
  app.use(helmet());
  app.use(cookieParser());
  // Same origin only (docs/04 §1.6). The custom CSRF header forces a preflight, which only this origin passes.
  app.enableCors({ origin: app.get<AppConfig>(APP_CONFIG).HUB_PUBLIC_URL, credentials: true });
  app.enableShutdownHooks();
}

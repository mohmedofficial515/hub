/**
 * @file HTTP setup shared by main.ts, the OpenAPI export and the e2e harness (docs/12 H0-02).
 */
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { APP_CONFIG, type AppConfig } from './config/config.module';

export const API_PREFIX = 'api/v1';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.use(cookieParser());
  // Same origin only (docs/04 §1.6). The custom CSRF header forces a preflight, which only this origin passes.
  app.enableCors({ origin: app.get<AppConfig>(APP_CONFIG).HUB_PUBLIC_URL, credentials: true });
  app.enableShutdownHooks();
}

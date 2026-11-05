/**
 * @file HTTP setup shared by main.ts, the OpenAPI export and the e2e harness (docs/12 H0-02).
 */
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

export const API_PREFIX = 'api/v1';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.use(cookieParser());
  app.enableShutdownHooks();
}

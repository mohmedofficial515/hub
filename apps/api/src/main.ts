/**
 * @file Entry point. `PROCESS_ROLE` picks HTTP, workers, or both (`all`, for a local run); same image.
 */
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { bindHostOf } from './config/bind-host';
import { loadConfig } from './config/config.module';
import { buildOpenApiDocument } from './swagger';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  if (config.PROCESS_ROLE === 'worker') {
    await app.init();
    return;
  }
  if (config.NODE_ENV !== 'production') {
    const { SwaggerModule } = await import('@nestjs/swagger');
    SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
  }
  const host = bindHostOf(config);
  if (host) await app.listen(config.PORT, host);
  else await app.listen(config.PORT);
}

void bootstrap();

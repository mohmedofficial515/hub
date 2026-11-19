/**
 * @file Entry point. `PROCESS_ROLE` picks HTTP, workers, or both (`all`, for a local run); same image.
 */
import 'reflect-metadata';

import { Logger as NestLogger } from '@nestjs/common';
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

/**
 * The last guard. A promise nobody awaits (a timer's tick, a chain started with `void`) that rejects would otherwise end the whole API: every request,
 * every worker and every device's bridge connection with it. That happened whenever the database stalled for a moment (Postgres logged
 * `canceling authentication due to timeout`, then `Connection terminated unexpectedly` reached no handler, 2026-11-15 and 2026-11-16).
 * The rejection is logged with its stack and the API stays up, as the next query opens a fresh connection. A thrown exception still ends the
 * process, because its state may be broken, and the runner starts it again.
 */
function guardRejections(): void {
  const logger = new NestLogger('Process');
  process.on('unhandledRejection', (reason: unknown) => {
    const detail = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    logger.error(`A failure nobody awaited was caught, and the API stays up: ${detail}`);
  });
}

guardRejections();
// With the guard above, a failed start would no longer end the process by itself, and a runner would wait on an API that never listens.
bootstrap().catch((error: unknown) => {
  process.stderr.write(
    `The API could not start: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});

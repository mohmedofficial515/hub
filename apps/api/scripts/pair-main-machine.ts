/**
 * @file Pairs the main machine for `pnpm start:local` (D42), with no browser step: whoever runs it already holds the database and `.env`.
 * @description It prints one JSON line on stdout for the bridge's `connect`, which takes it on stdin. Nothing else may read this output, and it is never logged.
 */
import 'reflect-metadata';

import { hostname, platform } from 'node:os';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/config.module';
import { PairingService } from '../src/modules/devices';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const config = app.get<AppConfig>(APP_CONFIG);
    if (!config.HUB_OWNER_EMAIL) throw new Error('Set HUB_OWNER_EMAIL first');
    const issued = await app
      .get(PairingService, { strict: false })
      .pairDirect(config.HUB_OWNER_EMAIL, hostname(), platform());
    process.stdout.write(`${JSON.stringify(issued)}\n`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

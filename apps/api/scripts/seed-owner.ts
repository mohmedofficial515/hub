/**
 * @file `pnpm seed:owner`: the first owner from HUB_OWNER_EMAIL and HUB_OWNER_PASSWORD (docs/15 §9).
 * @description Safe to run again. It prints the outcome, never the password.
 */
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/config.module';
import { OwnerSeed } from '../src/modules/identity';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const config = app.get<AppConfig>(APP_CONFIG);
    const result = await app.get(OwnerSeed, { strict: false }).run({
      email: config.HUB_OWNER_EMAIL,
      password: config.HUB_OWNER_PASSWORD,
      name: config.HUB_OWNER_NAME,
    });
    const who = result.createdUser ? 'Created the owner' : 'The owner already exists';
    process.stdout.write(`${who}. Projects: ${result.projects.join(', ')}.\n`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

/**
 * @file Global config module: the validated env under one token.
 */
import { Global, Module } from '@nestjs/common';

import { type Env, envSchema } from './env.schema';
import { loadEnv } from './load-env';

export const APP_CONFIG = Symbol('APP_CONFIG');
export type AppConfig = Env;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  loadEnv();
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment: ${names}`);
  }
  return parsed.data;
}

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}

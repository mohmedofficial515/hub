/**
 * @file Translation catalogues from src/i18n, copied to dist/i18n by nest-cli.
 * @description Adapted from F:/Goteav/backend/src/infra/i18n/i18n.module.ts. Keys are nested, so the code
 * `hub.cards.not_found` is read as `errors.hub.cards.not_found`. Member preference joins with H0-03.
 */
import { join } from 'node:path';

import { Module } from '@nestjs/common';
import { AcceptLanguageResolver, I18nModule } from 'nestjs-i18n';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      fallbacks: { 'en-*': 'en', 'ar-*': 'ar' },
      loaderOptions: { path: join(__dirname, '..', '..', 'i18n'), watch: false },
      resolvers: [new AcceptLanguageResolver({ matchType: 'strict-loose' })],
      logging: false,
      throwOnMissingKey: false,
    }),
  ],
  exports: [I18nModule],
})
export class AppI18nModule {}

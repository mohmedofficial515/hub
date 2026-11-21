/**
 * @file Pino JSON logs with the request id. Credentials are redacted.
 */
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { loadConfig } from '@/config/config.module';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: () => {
        const config = loadConfig();
        return {
          pinoHttp: {
            level: config.LOG_LEVEL,
            redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
            ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
          },
        };
      },
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggerModule {}

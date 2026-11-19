/**
 * @file Prisma client, workspace-scope extension and transaction plugin.
 * @description Adapted from F:/Goteav/backend/src/infra/prisma/. The base client owns the `pg` pool, which
 * connects lazily, so building the module (OpenAPI export) opens no connection. Everything else uses
 * `SCOPED_PRISMA`, or `TransactionHost<PrismaTransactionalAdapter>` to join the active transaction.
 * The assertion runs outside production only (docs/01 §10).
 */
import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ClsPluginTransactional, type TransactionalAdapter } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaPg } from '@prisma/adapter-pg';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { type Prisma, PrismaClient } from '@/generated/prisma/client';

import { assertWorkspaceScope } from './workspace-scope';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({
      // A connection that does not open within the timeout fails and the next query tries a fresh one. Without it, a stalled database held each
      // attempt until Postgres itself gave up a minute later. `keepAlive` lets a dropped connection be found rather than waited on.
      adapter: new PrismaPg({
        connectionString: config.DATABASE_URL,
        connectionTimeoutMillis: 15_000,
        keepAlive: true,
      }),
      log: ['warn', 'error'],
      transactionOptions: { maxWait: 5_000, timeout: 15_000 },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}

/** The client every repository uses. The extension adds no methods, so the plain client type is accurate. */
export type ScopedPrisma = PrismaClient;

export function createScopedPrisma(client: PrismaClient, enforce: boolean): ScopedPrisma {
  return client.$extends({
    name: 'workspace-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (enforce) assertWorkspaceScope(model, operation, args);
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const SCOPED_PRISMA = Symbol('SCOPED_PRISMA');

/** `TransactionHost<PrismaTransactionalAdapter>` in a constructor; `.tx` joins the active transaction. */
export type PrismaTransactionalAdapter = TransactionalAdapter<
  ScopedPrisma,
  Prisma.TransactionClient,
  { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
>;

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: SCOPED_PRISMA,
      inject: [PrismaService, APP_CONFIG],
      useFactory: (client: PrismaService, config: AppConfig): ScopedPrisma =>
        createScopedPrisma(client, config.NODE_ENV !== 'production'),
    },
  ],
  exports: [PrismaService, SCOPED_PRISMA],
})
export class PrismaModule {}

export function prismaTransactionalPlugin(): ClsPluginTransactional {
  return new ClsPluginTransactional({
    imports: [PrismaModule],
    // Cast: the adapter declares an optional property that exactOptionalPropertyTypes rejects.
    adapter: new TransactionalAdapterPrisma<ScopedPrisma>({
      prismaInjectionToken: SCOPED_PRISMA,
      sqlFlavor: 'postgresql',
    }) as never,
  });
}

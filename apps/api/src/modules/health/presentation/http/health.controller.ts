/**
 * @file Liveness and readiness (docs/04 §3.1). Readiness answers 503 with the per-check result.
 */
import { access, constants, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { PrismaService } from '@/infra/prisma/prisma.module';
import { RedisClients } from '@/infra/redis/redis.module';
import { AppException } from '@/shared/errors';
import { Public } from '@/shared/http';

type CheckResult = 'ok' | 'failed';

const CHECK_TIMEOUT_MS = 2_000;

async function check(run: () => Promise<unknown>): Promise<CheckResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([run(), timeout]);
    return 'ok';
  } catch {
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisClients,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'The process is up' })
  live(): { status: 'ok'; uptimeSec: number } {
    return { status: 'ok', uptimeSec: Math.round(process.uptime()) };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Postgres, Redis and the repos folder are usable' })
  async ready(): Promise<{ status: 'ok'; checks: Record<string, CheckResult> }> {
    const reposRoot = resolve(process.cwd(), this.config.REPOS_ROOT);
    const [postgres, redis, reposVolume] = await Promise.all([
      check(() => this.prisma.$queryRaw`SELECT 1`),
      check(() => this.redis.main.ping()),
      check(async () => {
        await mkdir(reposRoot, { recursive: true });
        await access(reposRoot, constants.W_OK);
      }),
    ]);
    const checks = { postgres, redis, reposVolume };
    if (Object.values(checks).includes('failed')) {
      throw new AppException('hub.common.unavailable', { details: { checks } });
    }
    return { status: 'ok', checks };
  }
}

/**
 * @file Settings › Devices › Reaching Hub from other devices (docs/16 §10, D43): the public URL, Secure cookies, where the API listens,
 * and what Tailscale on this machine says. It only reads: `tailscale serve` is the owner's step (`pnpm hub:tailscale serve`).
 * @description The two commands run with no shell and a short timeout, and the answer is kept for 30 seconds, so opening the tab twice
 * does not run them twice. A machine without Tailscale is a normal answer, not an error.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { PublishingDto } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { bindHostOf } from '@/config/bind-host';
import { APP_CONFIG, type AppConfig } from '@/config/config.module';

import {
  matchesPublicUrl,
  NO_TAILSCALE,
  readServe,
  readStatus,
  type TailscaleFacts,
} from '../domain/tailscale';

const RUN_TIMEOUT_MS = 5_000;
const CACHE_MS = 30_000;
/** "Check again" asks past the cache, but two presses within this time share one answer. */
const FRESH_MIN_MS = 3_000;

export interface CommandResult {
  readonly status: number;
  readonly stdout: string;
}

/** Runs a program with no shell. A missing program is status 127, never a throw. */
export type CommandRunner = (command: string, args: readonly string[]) => Promise<CommandResult>;

export const runCommand: CommandRunner = (command, args) =>
  new Promise((done) => {
    let stdout = '';
    let settled = false;
    const finish = (status: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done({ status, stdout });
    };
    const child = spawn(command, args, { shell: false, windowsHide: true });
    const timer = setTimeout(() => {
      child.kill();
      finish(124);
    }, RUN_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.on('error', () => finish(127));
    child.on('close', (code) => finish(code ?? 1));
  });

/** `tailscale` on PATH first, then where the Windows installer puts it. */
export function tailscaleCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  const programFiles = env['ProgramFiles'] ?? 'C:\Program Files';
  const installed = join(programFiles, 'Tailscale', 'tailscale.exe');
  return process.platform === 'win32' && existsSync(installed) ? ['tailscale', installed] : ['tailscale'];
}

/** Everything Tailscale says, through `run`, for a test to fake. */
export async function tailscaleFacts(
  run: CommandRunner,
  candidates: readonly string[],
  publicUrl: string,
  apiPort: number,
): Promise<TailscaleFacts> {
  for (const binary of candidates) {
    const status = await run(binary, ['status', '--json']);
    if (status.status === 127) continue;
    const { running, dnsName } = readStatus(status.stdout);
    if (!running) return { ...NO_TAILSCALE, installed: true, dnsName };
    const serve = await run(binary, ['serve', 'status', '--json']);
    return {
      installed: true,
      running,
      dnsName,
      ...readServe(serve.status === 0 ? serve.stdout : '', dnsName, apiPort),
      matchesPublicUrl: matchesPublicUrl(publicUrl, dnsName),
    };
  }
  return NO_TAILSCALE;
}

@Injectable()
export class PublishingService {
  private cached: { at: number; value: PublishingDto } | null = null;
  run: CommandRunner = runCommand;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** `fresh` is Settings' "Check again", after the owner installed or published something. */
  async status(options: { fresh?: boolean } = {}): Promise<PublishingDto> {
    const age = this.cached ? Date.now() - this.cached.at : Number.POSITIVE_INFINITY;
    if (this.cached && age < (options.fresh ? FRESH_MIN_MS : CACHE_MS)) return this.cached.value;
    const publicUrl = this.config.HUB_PUBLIC_URL;
    const value: PublishingDto = {
      publicUrl,
      apiPublicUrl: this.config.HUB_API_PUBLIC_URL ?? null,
      secureCookies: publicUrl.startsWith('https://'),
      bindHost: bindHostOf(this.config) ?? null,
      tailscale: await tailscaleFacts(this.run, tailscaleCandidates(), publicUrl, this.config.PORT),
    };
    this.cached = { at: Date.now(), value };
    return value;
  }
}

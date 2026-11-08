'use client';

/**
 * @file publishing.tsx
 * @description Settings › Devices › Reaching Hub from other devices (docs/16 §10, D43): Hub's address, Secure cookies, where it listens, and what Tailscale on the
 * main machine says, as the health rows above it do: a word and an icon per fact. Then the owner's steps for a second device. It only reads: publishing is
 * `pnpm hub:tailscale serve`, run by the owner, because installing Tailscale and signing in cannot be done for them.
 */
import { CircleAlert, CircleCheck, Globe } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn, CommandBlock, ErrorState, fill, Ltr, SectionHeader, SkeletonRows, useT } from '@/components/kit';
import { usePublishing } from '@/features/backups/queries';
import type { SettingsMessages } from '@/features/settings/messages';

function Fact({ ok, children }: { ok: boolean; children: ReactNode }) {
  const Icon = ok ? CircleCheck : CircleAlert;
  return (
    <li className="flex items-start gap-3 px-4 py-2.5" data-ok={ok}>
      <Icon
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          ok ? 'text-success-soft-foreground' : 'text-warning-soft-foreground',
        )}
        strokeWidth={1.75}
      />
      <p className="min-w-0 flex-1 text-body-sm font-medium wrap-anywhere text-foreground">{children}</p>
    </li>
  );
}

export function PublishingSection() {
  const t = useT<SettingsMessages>('settings');
  const s = t.devices.publishing;
  const query = usePublishing();
  return (
    <section aria-labelledby="devices-publishing" className="flex flex-col gap-3" data-devices-publishing>
      <SectionHeader id="devices-publishing" icon={Globe} level={3} title={s.title} />
      <p className="max-w-prose text-body-sm text-muted-foreground">{s.intro}</p>
      {query.isPending ? (
        <SkeletonRows count={3} withAction={false} />
      ) : query.isError ? (
        <ErrorState thing={t.errorThing} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            <Fact ok={query.data.secureCookies}>
              {s.address}: <Ltr mono>{query.data.publicUrl}</Ltr>
            </Fact>
            <Fact ok={query.data.secureCookies}>{query.data.secureCookies ? s.secureOn : s.secureOff}</Fact>
            <Fact ok={query.data.bindHost !== null}>
              {query.data.bindHost
                ? fill(s.listenLocal, { host: <Ltr mono>{query.data.bindHost}</Ltr> })
                : s.listenAll}
            </Fact>
            {!query.data.tailscale.installed ? (
              <Fact ok={false}>{s.notInstalled}</Fact>
            ) : !query.data.tailscale.running ? (
              <Fact ok={false}>{s.notRunning}</Fact>
            ) : (
              <>
                <Fact ok>
                  {fill(s.running, { name: <Ltr mono>{query.data.tailscale.dnsName ?? ''}</Ltr> })}
                </Fact>
                <Fact ok={query.data.tailscale.servesWeb}>
                  {query.data.tailscale.servesWeb ? s.servesWeb : s.notServesWeb}
                </Fact>
                <Fact ok={query.data.tailscale.servesApi}>
                  {query.data.tailscale.servesApi ? s.servesApi : s.notServesApi}
                </Fact>
                <Fact ok={query.data.tailscale.matchesPublicUrl}>
                  {query.data.tailscale.matchesPublicUrl ? s.matches : s.notMatches}
                </Fact>
              </>
            )}
          </ul>
          <h4 className="text-body font-semibold text-foreground">{s.stepsTitle}</h4>
          <ol className="flex max-w-prose list-decimal flex-col gap-2 ps-5 text-body-sm text-foreground">
            {s.steps.map((step, index) => (
              <li key={step}>
                {step}
                {index === 1 && (
                  <CommandBlock
                    className="mt-2"
                    value="pnpm hub:tailscale serve"
                    copyLabel={t.devices.copyCommand}
                    label={s.serveLabel}
                  />
                )}
              </li>
            ))}
          </ol>
          <p className="max-w-prose text-body-sm text-muted-foreground">{s.guide}</p>
        </>
      )}
    </section>
  );
}

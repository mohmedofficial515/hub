'use client';

/**
 * @file publishing.tsx
 * @description Settings › Devices › Reaching Hub from other devices (docs/16 §10, D43): Hub's address, Secure cookies, where it listens, and what Tailscale on the
 * main machine says, as the health rows above it do: a word and an icon per fact. A line on top says where the owner is and what comes next, and Check again reads
 * Tailscale past the API's cache. Then the owner's steps, split as docs/13 §14 splits them: the main machine once, then each other device, each step marked done or
 * next from what Hub already knows. It only reads: publishing is `pnpm hub:tailscale serve`, run by the owner, because installing Tailscale and signing in cannot be
 * done for them.
 */
import { CircleAlert, CircleCheck, ExternalLink, Globe, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  Button,
  cn,
  CommandBlock,
  ErrorState,
  fill,
  focusRing,
  Ltr,
  Pill,
  SectionHeader,
  showToast,
  SkeletonRows,
  useMe,
  useT,
} from '@/components/kit';
import {
  MAIN_STEPS,
  OTHER_STEPS,
  publishingProgress,
  type StepState,
} from '@/features/backups/publishing-steps';
import { usePublishing, useRecheckPublishing } from '@/features/backups/queries';
import type { SettingsMessages } from '@/features/settings/messages';
import { isHubError } from '@/lib/api/errors';

const DOWNLOAD_URL = 'https://tailscale.com/download';

type Words = SettingsMessages['devices']['publishing'];

/** One fact: a word and an icon, with the state also said to a screen reader. `ok` undefined is a neutral fact, such as the address. */
function Fact({ ok, words, children }: { ok?: boolean; words: Words; children: ReactNode }) {
  const Icon = ok === undefined ? Globe : ok ? CircleCheck : CircleAlert;
  return (
    <li className="flex items-start gap-3 px-4 py-2.5" data-ok={ok}>
      <Icon
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          ok === undefined
            ? 'text-muted-foreground'
            : ok
              ? 'text-success-soft-foreground'
              : 'text-warning-soft-foreground',
        )}
        strokeWidth={1.75}
      />
      <p className="min-w-0 flex-1 text-body-sm font-medium wrap-anywhere text-foreground">
        {children}
        {ok !== undefined && <span className="sr-only"> ({ok ? words.levels.ok : words.levels.warn})</span>}
      </p>
    </li>
  );
}

function StepMark({ state, words }: { state: StepState; words: Words }) {
  if (state === 'done')
    return (
      <Pill tone="success" icon={CircleCheck} className="ms-2 align-middle">
        {words.state.done}
      </Pill>
    );
  if (state === 'next')
    return (
      <Pill tone="info" className="ms-2 align-middle">
        {words.state.next}
      </Pill>
    );
  return null;
}

function DownloadLink({ words }: { words: Words }) {
  return (
    <a
      href={DOWNLOAD_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'hit-44 mt-1 inline-flex items-center gap-1 rounded-sm text-primary underline-offset-2 hover:underline',
        focusRing,
      )}
    >
      {words.download}
      <Ltr className="text-muted-foreground">({DOWNLOAD_URL.replace('https://', '')})</Ltr>
      <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
    </a>
  );
}

/** "Connect a new device" above: a real link that moves to the section and its heading. */
function ConnectLink({ label }: { label: string }) {
  return (
    <a
      href="#devices-connect"
      className={cn('hit-44 rounded-sm text-primary underline-offset-2 hover:underline', focusRing)}
      onClick={(event) => {
        const heading = document.getElementById('devices-connect');
        if (!heading) return;
        event.preventDefault();
        heading.scrollIntoView({ block: 'start', behavior: 'smooth' });
        heading.focus({ preventScroll: true });
      }}
    >
      {label}
    </a>
  );
}

export function PublishingSection() {
  const t = useT<SettingsMessages>('settings');
  const s = t.devices.publishing;
  const query = usePublishing();
  const recheck = useRecheckPublishing();
  const me = useMe();

  const checkAgain = (
    <Button
      size="sm"
      busy={recheck.isPending || query.isFetching}
      aria-label={s.checkAgainLabel}
      onClick={() =>
        recheck.mutate(undefined, {
          onError: (error) =>
            showToast({ tone: 'error', message: isHubError(error) ? error.message : t.errorThing }),
        })
      }
      data-publishing-recheck
    >
      <RefreshCw aria-hidden className="size-3.5" strokeWidth={1.75} />
      {s.checkAgain}
    </Button>
  );

  return (
    <section aria-labelledby="devices-publishing" className="flex flex-col gap-3" data-devices-publishing>
      <SectionHeader
        id="devices-publishing"
        icon={Globe}
        level={3}
        title={s.title}
        aside={query.isSuccess ? checkAgain : undefined}
      />
      <p className="max-w-prose text-body-sm text-muted-foreground">{s.intro}</p>
      {query.isPending ? (
        <SkeletonRows count={3} withAction={false} />
      ) : query.isError ? (
        <ErrorState thing={t.errorThing} onRetry={() => void query.refetch()} />
      ) : (
        <PublishingBody data={query.data} totpEnabled={me.data?.totpEnabled ?? false} words={s} />
      )}
    </section>
  );
}

function PublishingBody({
  data,
  totpEnabled,
  words: s,
}: {
  data: NonNullable<ReturnType<typeof usePublishing>['data']>;
  totpEnabled: boolean;
  words: Words;
}) {
  const t = useT<SettingsMessages>('settings');
  const progress = publishingProgress(data, totpEnabled);
  const published = progress.summary === 'published';
  const address =
    data.tailscale.matchesPublicUrl || !data.tailscale.dnsName
      ? data.publicUrl
      : `https://${data.tailscale.dnsName}`;
  const knowsAddress = data.tailscale.dnsName !== null;
  const SummaryIcon = published ? CircleCheck : CircleAlert;

  const mainBody: Record<(typeof MAIN_STEPS)[number], ReactNode> = {
    install: <DownloadLink words={s} />,
    https: null,
    serve: (
      <CommandBlock
        className="mt-2"
        value="pnpm hub:tailscale serve"
        copyLabel={t.devices.copyCommand}
        label={s.serveLabel}
      />
    ),
    env: (
      <>
        <CommandBlock
          className="mt-2"
          value="pnpm stop:local; pnpm start:local"
          copyLabel={t.devices.copyCommand}
          label={s.restartLabel}
        />
        <p className="mt-2">{s.main.envService}</p>
        <CommandBlock
          className="mt-2"
          value="pnpm hub:service stop; pnpm hub:service start"
          copyLabel={t.devices.copyCommand}
          label={s.restartServiceLabel}
        />
      </>
    ),
    totp: null,
  };
  const otherText: Record<(typeof OTHER_STEPS)[number], ReactNode> = {
    install: s.other.install,
    open: knowsAddress ? fill(s.other.openAt, { address: <Ltr mono>{address}</Ltr> }) : s.other.open,
    pair: fill(s.other.pair, { link: <ConnectLink label={t.devices.connectTitle} /> }),
  };

  return (
    <>
      <p
        role="status"
        className="flex max-w-prose items-start gap-2 text-body-sm font-medium text-foreground"
        data-publishing-summary={progress.summary}
      >
        <SummaryIcon
          aria-hidden
          className={cn(
            'mt-0.5 size-4 shrink-0',
            published ? 'text-success-soft-foreground' : 'text-warning-soft-foreground',
          )}
          strokeWidth={1.75}
        />
        <span>{s.summary[progress.summary]}</span>
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        <Fact words={s}>
          {s.address}: <Ltr mono>{data.publicUrl}</Ltr>
        </Fact>
        <Fact ok={data.secureCookies} words={s}>
          {data.secureCookies ? s.secureOn : s.secureOff}
        </Fact>
        <Fact ok={data.bindHost !== null} words={s}>
          {data.bindHost ? fill(s.listenLocal, { host: <Ltr mono>{data.bindHost}</Ltr> }) : s.listenAll}
        </Fact>
        {!data.tailscale.installed ? (
          <Fact ok={false} words={s}>
            {s.notInstalled}
          </Fact>
        ) : !data.tailscale.running ? (
          <Fact ok={false} words={s}>
            {s.notRunning}
          </Fact>
        ) : (
          <>
            <Fact ok words={s}>
              {fill(s.running, { name: <Ltr mono>{data.tailscale.dnsName ?? ''}</Ltr> })}
            </Fact>
            <Fact ok={data.tailscale.servesWeb} words={s}>
              {data.tailscale.servesWeb ? s.servesWeb : s.notServesWeb}
            </Fact>
            <Fact ok={data.tailscale.servesApi} words={s}>
              {data.tailscale.servesApi ? s.servesApi : s.notServesApi}
            </Fact>
            <Fact ok={data.tailscale.matchesPublicUrl} words={s}>
              {data.tailscale.matchesPublicUrl ? s.matches : s.notMatches}
            </Fact>
          </>
        )}
      </ul>
      <h4 className="text-body font-semibold text-foreground">{s.mainTitle}</h4>
      <ol className="flex max-w-prose list-decimal flex-col gap-2 ps-5 text-body-sm text-foreground">
        {MAIN_STEPS.map((step) => (
          <li key={step} data-step={`main-${step}`} data-state={progress.main[step]}>
            {s.main[step]}
            <StepMark state={progress.main[step]} words={s} />
            {mainBody[step] && <div>{mainBody[step]}</div>}
          </li>
        ))}
      </ol>
      <h4 className="text-body font-semibold text-foreground">{s.otherTitle}</h4>
      <ol className="flex max-w-prose list-decimal flex-col gap-2 ps-5 text-body-sm text-foreground">
        {OTHER_STEPS.map((step) => (
          <li key={step} data-step={`other-${step}`} data-state={progress.other[step]}>
            {otherText[step]}
            <StepMark state={progress.other[step]} words={s} />
            {step === 'install' && (
              <div>
                <DownloadLink words={s} />
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="max-w-prose text-body-sm text-muted-foreground">{s.guide}</p>
    </>
  );
}

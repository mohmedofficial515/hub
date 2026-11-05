'use client';

/**
 * @file devices.tsx
 * @description Settings › Devices (docs/16 §5): each paired machine, whether it is online, its Claude Code, its health checks with a Fix button, Revoke, and the one command for a new device.
 * Styled from its neighbours, tokens and system: one neutral card per device, the state in a word and an icon. It replaces `hub doctor` for the owner, though that command stays.
 */
import type { DeviceDto, HealthCheck } from '@hub/contracts';
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Laptop,
  MonitorSmartphone,
  RefreshCw,
  TerminalSquare,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  Button,
  cn,
  CommandBlock,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  fill,
  Ltr,
  Pill,
  RelativeTime,
  SectionHeader,
  showToast,
  SkeletonRows,
  useT,
} from '@/components/kit';
import {
  useCheckDevice,
  useConnectCommand,
  useDevices,
  useFixDevice,
  useRevokeDevice,
} from '@/features/devices/queries';
import type { SettingsMessages } from '@/features/settings/messages';
import { isHubError } from '@/lib/api/errors';

const STALE_REPORT_MS = 5 * 60_000;

const LEVEL_ICON = {
  ok: { Icon: CircleCheck, className: 'text-success-soft-foreground' },
  warn: { Icon: CircleAlert, className: 'text-warning-soft-foreground' },
  error: { Icon: CircleX, className: 'text-destructive-soft-foreground' },
} as const;

function useFailureToast() {
  const t = useT<SettingsMessages>('settings');
  return (error: unknown) =>
    showToast({ tone: 'error', message: isHubError(error) ? error.message : t.errorThing });
}

function CheckRow({ device, check }: { device: DeviceDto; check: HealthCheck }) {
  const t = useT<SettingsMessages>('settings');
  const s = t.devices;
  const fix = useFixDevice();
  const failed = useFailureToast();
  const { Icon, className } = LEVEL_ICON[check.level];
  const words = s.checks[check.id];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <Icon aria-hidden className={cn('size-4 shrink-0', className)} strokeWidth={1.75} />
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-body-sm font-medium text-foreground">
          {check.ok ? words.ok : words.bad}
          <span className="sr-only"> ({s.levels[check.level]})</span>
        </p>
        {check.detail && (
          <p className="text-body-sm wrap-anywhere text-muted-foreground">
            <Ltr mono>{check.detail}</Ltr>
          </p>
        )}
        {check.hint && !check.ok && (
          <p className="mt-0.5 text-body-sm text-muted-foreground">
            {fill(s.hint, { hint: <Ltr mono>{check.hint}</Ltr> })}
          </p>
        )}
      </div>
      {check.fix && !check.ok && (
        <Button
          size="sm"
          busy={fix.isPending}
          disabled={!device.online}
          aria-label={`${s.fix}: ${words.bad}`}
          onClick={() =>
            fix.mutate(
              { id: device.id, fix: check.fix! },
              { onSuccess: () => showToast({ message: s.fixed }), onError: failed },
            )
          }
        >
          {s.fix}
        </Button>
      )}
    </li>
  );
}

function DeviceCard({ device, onRevoke }: { device: DeviceDto; onRevoke: () => void }) {
  const t = useT<SettingsMessages>('settings');
  const s = t.devices;
  const check = useCheckDevice();
  const failed = useFailureToast();
  const autoChecked = useRef(false);
  const reportIsOld = !device.healthAt || Date.now() - new Date(device.healthAt).getTime() > STALE_REPORT_MS;

  // Opening the tab shows the truth without a click, once, when the device can answer.
  const { mutate } = check;
  useEffect(() => {
    if (autoChecked.current || !device.online || !reportIsOld) return;
    autoChecked.current = true;
    mutate(device.id);
  }, [device.id, device.online, reportIsOld, mutate]);

  return (
    <li className="overflow-hidden rounded-lg border border-border bg-card" data-row={device.id}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
        <Laptop aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="min-w-0 flex-1 basis-48">
          <p className="flex flex-wrap items-center gap-2 text-body font-medium text-foreground">
            <span dir="auto">{device.name}</span>
            <Pill tone={device.online ? 'success' : 'muted'}>{device.online ? s.online : s.offline}</Pill>
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-body-sm text-muted-foreground">
            <span>{s.platforms[device.platform as keyof typeof s.platforms] ?? device.platform}</span>
            <span>
              {fill(s.claudeVersion, {
                version: device.claudeVersion ? <Ltr mono>{device.claudeVersion}</Ltr> : s.claudeUnknown,
              })}
            </span>
            {!device.online && device.lastSeenAt && (
              <span>{fill(s.lastSeen, { when: <RelativeTime iso={device.lastSeenAt} /> })}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            busy={check.isPending}
            disabled={!device.online}
            onClick={() => check.mutate(device.id, { onError: failed })}
          >
            <RefreshCw aria-hidden className="size-3.5" strokeWidth={1.75} />
            {s.checkNow}
          </Button>
          <Button size="sm" aria-label={`${s.revoke}: ${device.name}`} onClick={onRevoke}>
            {s.revoke}
          </Button>
        </div>
      </div>
      <div className="border-t border-border">
        {device.health.length === 0 ? (
          <p className="px-4 py-3 text-body-sm text-muted-foreground">
            {device.online ? s.checking : s.noReport}
          </p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border">
              {device.health.map((row) => (
                <CheckRow key={row.id} device={device} check={row} />
              ))}
            </ul>
            {!device.online && device.healthAt && (
              <p className="border-t border-border px-4 py-2 text-body-sm text-muted-foreground">
                {fill(s.reportedAt, { when: <RelativeTime iso={device.healthAt} /> })}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function ConnectSection() {
  const t = useT<SettingsMessages>('settings');
  const s = t.devices;
  const command = useConnectCommand();
  return (
    <section aria-labelledby="devices-connect" className="flex flex-col gap-3">
      <SectionHeader id="devices-connect" icon={TerminalSquare} level={3} title={s.connectTitle} />
      <p className="max-w-prose text-body-sm text-muted-foreground">{s.connectBody}</p>
      {command.isPending ? (
        <SkeletonRows count={1} withAction={false} />
      ) : command.isError ? (
        <ErrorState thing={t.errorThing} onRetry={() => void command.refetch()} />
      ) : (
        <>
          <CommandBlock value={command.data.connect} copyLabel={s.copyCommand} label={s.connectLabel} />
          <p className="max-w-prose text-body-sm text-muted-foreground">{s.connectNote}</p>
          <CommandBlock value={command.data.uninstall} copyLabel={s.copyCommand} label={s.uninstallLabel} />
        </>
      )}
    </section>
  );
}

export function DevicesTab() {
  const t = useT<SettingsMessages>('settings');
  const s = t.devices;
  const query = useDevices();
  const revokeDevice = useRevokeDevice();
  const failed = useFailureToast();
  const [revoking, setRevoking] = useState<string | null>(null);
  const devices = query.data ?? [];
  const target = devices.find((device) => device.id === revoking);

  if (query.isPending) return <SkeletonRows count={3} withAction />;
  if (query.isError) {
    const { error } = query;
    return (
      <ErrorState
        thing={t.errorThing}
        code={isHubError(error) ? error.code : undefined}
        requestId={isHubError(error) ? error.requestId : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <>
      <section aria-labelledby="devices-title" className="flex flex-col gap-3">
        <SectionHeader
          id="devices-title"
          icon={MonitorSmartphone}
          title={s.title}
          count={devices.length || undefined}
        />
        <p className="max-w-prose text-body-sm text-muted-foreground">{s.intro}</p>
        {devices.length === 0 ? (
          <EmptyState icon={MonitorSmartphone} title={s.emptyTitle}>
            {s.emptyBody}
          </EmptyState>
        ) : (
          <ul data-hub-list className="flex flex-col gap-3">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} onRevoke={() => setRevoking(device.id)} />
            ))}
          </ul>
        )}
      </section>

      <ConnectSection />

      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={target ? fill(s.revokeTitle, { name: <span dir="auto">{target.name}</span> }) : ''}
        description={s.revokeBody}
        confirmLabel={s.revoke}
        onConfirm={() =>
          target &&
          revokeDevice.mutate(target.id, {
            onSuccess: () => showToast({ message: s.revoked }),
            onError: failed,
          })
        }
      />
    </>
  );
}

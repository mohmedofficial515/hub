'use client';

/**
 * @file notifications.tsx
 * @description In-app is the one real channel in this release (docs/15 §3). Push, Telegram and email say they are not connected and what
 * they need. The design's mode switches, kinds grid and personal quiet hours return with those channels, because nothing stores them yet.
 * It is a section of Settings › Account now (owner's decision, 2026-11-19), and `?tab=notifications` lands there.
 */
import { BellRing, Inbox, type LucideIcon, Mail, MessageCircle, Unplug } from 'lucide-react';
import type { ReactNode } from 'react';

import { Pill, useT } from '@/components/kit';
import type { SettingsMessages } from '@/features/settings/messages';

import { FormSection } from './shared';

function ChannelRow({
  icon: Icon,
  name,
  status,
  control,
}: {
  icon: LucideIcon;
  name: string;
  status: ReactNode;
  control: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
      <div className="flex min-w-0 flex-1 basis-56 items-start gap-3">
        <Icon aria-hidden className="mt-0.5 size-4.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="text-body font-semibold text-foreground">{name}</p>
          <div className="mt-0.5 text-body-sm text-muted-foreground">{status}</div>
        </div>
      </div>
      {control}
    </li>
  );
}

export function NotificationsSection() {
  const s = useT<SettingsMessages>('settings').notifications;
  const notConnected = (
    <Pill tone="muted" icon={Unplug}>
      {s.notConnected}
    </Pill>
  );
  return (
    <FormSection title={s.title} description={s.intro}>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        <ChannelRow
          icon={Inbox}
          name={s.channels.inApp}
          status={s.inAppStatus}
          control={<Pill tone="success">{s.alwaysOn}</Pill>}
        />
        <ChannelRow icon={BellRing} name={s.channels.push} status={s.needs.push} control={notConnected} />
        <ChannelRow
          icon={MessageCircle}
          name={s.channels.telegram}
          status={s.needs.telegram}
          control={notConnected}
        />
        <ChannelRow icon={Mail} name={s.channels.email} status={s.needs.email} control={notConnected} />
      </ul>
    </FormSection>
  );
}

// Field and group markers: changed from default, unsaved, proposed (with proposal id, priority, needs backend),
// legacy, high risk, security / money / two-person controls, read only, new group, owner only.

import { Archive, Coins, Lock, ShieldCheck, Sparkles, TriangleAlert, Users, type LucideIcon } from 'lucide-react';
import type { Field, SettingsGroup } from '@lab/mocks/settings';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { loc } from './format';
import { Badge, InfoBadge } from './ui';

/** "Changed from default": a dot (results) or a dot + word (group page). */
export function ChangedMark({ withText, defaultText }: { withText?: boolean; defaultText: string }) {
  const t = useT(messages);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-12 font-semibold text-muted-foreground" title={t.badges.changedTitle(defaultText)}>
      <span aria-hidden className="size-2 rounded-full bg-primary ring-2 ring-primary/20" />
      {withText ? t.badges.changed : <span className="sr-only">{t.badges.changedTitle(defaultText)}</span>}
    </span>
  );
}

export function UnsavedMark() {
  const t = useT(messages);
  return (
    <Badge tone="warning" icon={<span aria-hidden className="size-1.5 rounded-full bg-warning-strong" />}>
      {t.badges.unsaved}
    </Badge>
  );
}

export function ProposedBadge({ field, compact }: { field: Field; compact?: boolean }) {
  const t = useT(messages);
  if (!field.proposed && !field.proposedOptions?.length) return null;
  const id = field.proposalId ?? '';
  return (
    <InfoBadge tone="violet" icon={<Sparkles aria-hidden />} label={compact || !id ? t.badges.proposed : `${t.badges.proposed} · ${id}`}>
      <p className="font-bold">{t.badges.proposalTitle(id || '—', field.priority ?? '—')}</p>
      <p className="mt-1 text-muted-foreground">
        {field.proposedOptions?.length && !field.proposed
          ? t.badges.proposedOption
          : field.needsBackend === false
            ? t.badges.frontendOnly
            : t.badges.needsBackend}
      </p>
      {field.note && <NoteText note={field.note} />}
    </InfoBadge>
  );
}

function NoteText({ note }: { note: NonNullable<Field['note']> }) {
  const locale = useLocale();
  return <p className="mt-1 text-muted-foreground">{loc(note, locale)}</p>;
}

export function FieldBadges({ field, compact, className }: { field: Field; compact?: boolean; className?: string }) {
  const t = useT(messages);
  const items: { key: string; tone: 'danger' | 'neutral'; icon: LucideIcon; label: string }[] = [];
  if (field.risk === 'high') items.push({ key: 'risk', tone: 'danger', icon: TriangleAlert, label: t.badges.highRisk });
  if (field.control === 'security') items.push({ key: 'sec', tone: 'neutral', icon: ShieldCheck, label: t.badges.security });
  if (field.control === 'money') items.push({ key: 'money', tone: 'neutral', icon: Coins, label: t.badges.money });
  if (field.twoPerson) items.push({ key: 'two', tone: 'neutral', icon: Users, label: t.badges.twoPerson });
  if (field.readOnly) items.push({ key: 'ro', tone: 'neutral', icon: Lock, label: t.badges.readOnly });
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      <ProposedBadge field={field} compact={compact} />
      {field.deprecated && (
        <InfoBadge tone="neutral" icon={<Archive aria-hidden />} label={t.badges.legacy}>
          <p className="font-bold">{t.badges.legacyTitle}</p>
          {field.note && <NoteText note={field.note} />}
        </InfoBadge>
      )}
      {items.map(({ key, tone, icon: Icon, label }) =>
        compact && tone === 'neutral' && key !== 'ro' ? (
          <span key={key} className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground" title={label}>
            <Icon aria-hidden className="size-3.5" />
            <span className="sr-only">{label}</span>
          </span>
        ) : (
          <Badge key={key} tone={tone} icon={<Icon aria-hidden />}>
            {label}
          </Badge>
        ),
      )}
    </span>
  );
}

export function GroupBadges({ group, ownerOnly }: { group: SettingsGroup; ownerOnly?: boolean }) {
  const t = useT(messages);
  return (
    <>
      {!group.inDashboard && (
        <InfoBadge tone="info" icon={<Sparkles aria-hidden />} label={t.badges.newGroup}>
          {t.badges.newGroupHelp}
        </InfoBadge>
      )}
      {group.approval === 'second-approver' && (
        <InfoBadge tone="neutral" icon={<Users aria-hidden />} label={t.badges.secondApprover}>
          {t.badges.secondApproverHelp}
        </InfoBadge>
      )}
      {group.approval === 'controls' && (
        <InfoBadge tone="neutral" icon={<Coins aria-hidden />} label={t.badges.controls}>
          {t.badges.controlsHelp}
        </InfoBadge>
      )}
      {ownerOnly && (
        <Badge tone="neutral" icon={<Lock aria-hidden />}>
          {t.badges.ownerOnly}
        </Badge>
      )}
    </>
  );
}

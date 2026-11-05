'use client';

/**
 * @file decision.tsx
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/sheet-sections/decision.tsx. Contract: apps/web/README.md.
 */
import { Check, ExternalLink, Star } from 'lucide-react';
import { RadioGroup } from 'radix-ui';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { ActorChip } from '@/components/cards/avatar';
import { Pill, RoleBadge } from '@/components/cards/badges';
import { CardChip } from '@/components/cards/card-key';
import { focusRing } from '@/components/cards/meta';
import {
  ActionPanel,
  Fact,
  Facts,
  type SectionProps,
  SubHeading,
} from '@/components/cards/sheet-sections/shared';
import { CopyButton } from '@/components/common/copy-button';
import { RelativeTime } from '@/components/common/relative-time';
import { Bidi, fill, fmt } from '@/components/common/text';
import { openCard } from '@/components/shell/router';
import { useRoute } from '@/components/shell/router';
import { Button } from '@/components/ui/button';
import { detectSecret, Field, SecretFilterError, Textarea } from '@/components/ui/form';
import { writeCard } from '@/features/cards/store';
import type { DecisionCard, DecisionOption } from '@/features/cards/types';
import { useSession } from '@/features/session/session';
import { post } from '@/lib/api/client';
import { absolute, duration, nowMs, num, rel, when } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import { DecisionEditForm } from './decision-edit';
import { EDIT, EditButton } from './edit-bits';

/** Strings only this section needs. The card vocabulary stays in `kit/i18n.ts`. */
const MIN_RATIONALE = 20;

/** "24 h and 2 h before" / "قبل 24 ساعة وقبل ساعتين" (review M15). */
function formatReminders(hours: number[], locale: 'ar' | 'en') {
  if (locale === 'ar')
    return hours.map((h) => rel(new Date(nowMs() - h * 3_600_000).toISOString(), 'ar')).join(' و');
  return `${new Intl.ListFormat('en', { type: 'conjunction' }).format(hours.map((h) => `${h} h`))} before`;
}
const ADR_STEPS = ['drafted', 'pr_opened', 'merged'] as const;

function ProsCons({ title, items, quiet }: { title: string; items: string[]; quiet: boolean }) {
  if (!items.length) return null;
  return (
    <div className="min-w-0">
      <p className="text-caption font-medium text-muted-foreground">{title}</p>
      <ul
        className={cn(
          'mt-1 flex list-disc flex-col gap-0.5 ps-4 text-body-sm',
          quiet ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {items.map((item) => (
          <li key={item}>
            <Bidi>{item}</Bidi>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 08 §5.4: bordered card, two columns of pros and cons, cost line, recommended tag. Radio inside the decide form.
 * The doc dims unchosen options to 70 % opacity, which falls below AA (3.4:1), so they go muted with a dashed border.
 * `stacked` puts pros above cons for a narrow tile; `footer` sits at the tile's bottom edge, however tall its neighbours are.
 */
export function DecisionOptionCard({
  option,
  chosen = false,
  dimmed = false,
  radio = false,
  stacked = false,
  footer,
  className,
}: {
  option: DecisionOption;
  chosen?: boolean | undefined;
  dimmed?: boolean | undefined;
  radio?: boolean | undefined;
  stacked?: boolean | undefined;
  footer?: ReactNode | undefined;
  className?: string | undefined;
}) {
  const t = useT(kitMessages);
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {radio && (
          <span
            aria-hidden
            className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input group-data-[state=checked]:border-primary"
          >
            <span className="size-2 rounded-full bg-primary opacity-0 group-data-[state=checked]:opacity-100" />
          </span>
        )}
        <span
          className={cn('text-body-lg font-semibold', dimmed ? 'text-muted-foreground' : 'text-foreground')}
        >
          <Bidi>{option.title}</Bidi>
        </span>
        {option.recommended && (
          <Pill icon={Star} tone="info">
            {t.sheet.decision.recommended}
          </Pill>
        )}
        {chosen && (
          <Pill icon={Check} tone="success">
            {t.sheet.decision.chosen}
          </Pill>
        )}
      </div>
      <div className={cn('mt-2 grid gap-3', !stacked && 'sm:grid-cols-2')}>
        <ProsCons title={t.sheet.decision.pros} items={option.pros} quiet={dimmed} />
        <ProsCons title={t.sheet.decision.cons} items={option.cons} quiet={dimmed} />
      </div>
      {option.cost && (
        <p className="mt-2 text-body-sm text-muted-foreground">
          {t.sheet.decision.cost}: <Bidi>{option.cost}</Bidi>
        </p>
      )}
      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </>
  );
  if (radio) {
    return (
      <RadioGroup.Item
        value={option.id}
        className={cn(
          'group block w-full cursor-pointer rounded-lg border border-border bg-card p-3 text-start transition-colors duration-120 hover:bg-accent data-[state=checked]:border-primary',
          focusRing,
          className,
        )}
      >
        {body}
      </RadioGroup.Item>
    );
  }
  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border bg-card p-3',
        chosen ? 'border-success' : 'border-border',
        dimmed && 'border-dashed',
        className,
      )}
    >
      {body}
    </div>
  );
}

let preset: { key: string; optionId: string } | null = null;

/** Open the sheet's Decide form with this option picked, and the cursor in the rationale. The Decisions page uses it. */
export function openDecideWith(key: string, optionId: string) {
  preset = { key, optionId };
  openCard(key, { action: 'decide' });
}

function DecideForm({
  card,
  onSave,
  onCancel,
}: {
  card: DecisionCard;
  onSave: SectionProps<'decision'>['perform'];
  onCancel: () => void;
}) {
  const t = useT(kitMessages);
  const m = useT(kitMessages).sections.decision;
  const locale = useLocale();
  const s = t.sheet.decision;
  const d = card.decision;
  const formId = useId();
  const presetOption = preset?.key === card.key ? preset.optionId : '';
  const [option, setOption] = useState(presetOption);
  const [rationale, setRationale] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    preset = null;
    if (presetOption) document.getElementById(`${formId}-why`)?.focus();
    // Once, when the form opens.
  }, []);

  const short = rationale.trim().length < MIN_RATIONALE;
  const secret = detectSecret(rationale);
  const submit = () => {
    setTried(true);
    if (!option || short || secret) return;
    const picked = d.options.find((o) => o.id === option);
    onSave('decide', { optionId: option, optionTitle: picked?.title, rationale: rationale.trim() });
  };

  return (
    <ActionPanel onSubmit={submit} labelledBy={`${formId}-options`}>
      <SubHeading>
        <span id={`${formId}-options`}>{s.pick}</span>
      </SubHeading>
      <RadioGroup.Root
        value={option}
        onValueChange={setOption}
        aria-labelledby={`${formId}-options`}
        aria-invalid={(tried && !option) || undefined}
        className="flex flex-col gap-2"
      >
        {d.options.map((o) => (
          <DecisionOptionCard key={o.id} option={o} radio />
        ))}
      </RadioGroup.Root>
      {tried && !option && (
        <p role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
          {s.needPick}
        </p>
      )}
      <Field
        id={`${formId}-why`}
        label={s.rationale}
        required
        hint={s.rationaleHint}
        error={tried && short ? fmt(m.rationaleShort, { n: num(MIN_RATIONALE, locale) }) : undefined}
      >
        <Textarea
          id={`${formId}-why`}
          dir="auto"
          rows={3}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          aria-invalid={(tried && short) || !!secret || undefined}
        />
      </Field>
      {secret && <SecretFilterError pattern={secret} />}
      <p className="text-body-sm text-muted-foreground">{m.draftAdrHint}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">
          {s.save}
        </Button>
        <Button onClick={onCancel}>{t.cancel}</Button>
      </div>
    </ActionPanel>
  );
}

/** drafted → PR open → merged, in words. A failed PR replaces the chain with a danger pill. */
function AdrBlock({ card }: { card: DecisionCard }) {
  const t = useT(kitMessages);
  const m = useT(kitMessages).sections.decision;
  const { roles } = useSession();
  const s = t.sheet.decision;
  const d = card.decision;

  const { ws } = useRoute();
  const openPr = () =>
    void writeCard({ key: card.key }, () => post(`workspaces/${ws}/decisions/${card.key}/adr/open-pr`));

  if (d.adrStatus === 'none') {
    return (
      <p className="text-body-sm leading-9 text-muted-foreground">
        {s.adrNone}{' '}
        {fill(s.adrHint, {
          cmd: <CopyButton compact text={`/hub:adr ${card.key}`} className="align-middle" />,
        })}
      </p>
    );
  }
  const at = ADR_STEPS.indexOf(d.adrStatus as (typeof ADR_STEPS)[number]);
  return (
    <div className="flex flex-col gap-2 text-body-sm">
      {d.adrStatus === 'failed' ? (
        <Pill tone="danger" className="self-start">
          {s.adrStatus.failed}
        </Pill>
      ) : (
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {ADR_STEPS.map((step, i) => (
            <li key={step} aria-current={i === at ? 'step' : undefined} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="h-px w-3 bg-border" />}
              <span
                aria-hidden
                className={cn(
                  'flex size-4 items-center justify-center rounded-full border',
                  i <= at ? 'border-success bg-success-soft text-success-soft-foreground' : 'border-border',
                )}
              >
                {i <= at && <Check className="size-2.5" strokeWidth={2.5} />}
              </span>
              <span className={i === at ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                {s.adrStatus[step]}
              </span>
            </li>
          ))}
        </ol>
      )}
      {d.adrPath && (
        <code dir="ltr" translate="no" className="key text-start break-all text-foreground">
          {d.adrPath}
        </code>
      )}
      {d.adrPrUrl && (
        <a
          href={d.adrPrUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'hit-44 inline-flex items-center gap-1 self-start rounded-sm font-medium text-primary underline-offset-4 hover:underline',
            focusRing,
          )}
        >
          {m.viewPr}
          <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
        </a>
      )}
      {d.adrStatus === 'drafted' && (roles.includes('owner') || roles.includes('pm')) && (
        <Button size="sm" className="self-start" onClick={openPr}>
          {m.openPr}
        </Button>
      )}
    </div>
  );
}

export function DecisionSection({ card, action, cancelAction, perform }: SectionProps<'decision'>) {
  const t = useT(kitMessages);
  const m = useT(kitMessages).sections.decision;
  const locale = useLocale();
  const d = card.decision;
  const s = t.sheet.decision;
  const late = card.status === 'open' && card.dueAt && Date.parse(card.dueAt) < nowMs();
  const closing = [...card.events].reverse().find((e) => e.data.reason || e.data.byKey)?.data;
  const blocks = card.links.filter((l) => l.kind === 'blocks');
  const editable =
    !card.archivedAt &&
    ['card.edit_content', 'card.edit_routing', 'decision.edit_options'].some((a) =>
      card.allowedActions.includes(a),
    );

  if (action === EDIT && editable) return <DecisionEditForm card={card} />;

  return (
    <div className="flex flex-col gap-5">
      {editable && <EditButton />}
      <div>
        <p className="text-caption text-muted-foreground">{s.question}</p>
        <p className="mt-0.5 text-body-lg text-foreground">
          <Bidi>{d.question}</Bidi>
        </p>
      </div>

      {action === 'decide' && d.options.length > 0 ? (
        <DecideForm card={card} onSave={perform} onCancel={cancelAction} />
      ) : (
        d.options.length > 0 && (
          <div className="flex flex-col gap-2">
            <SubHeading>{s.options}</SubHeading>
            {d.options.map((o) => (
              <DecisionOptionCard
                key={o.id}
                option={o}
                chosen={d.chosenOptionId === o.id}
                dimmed={!!d.chosenOptionId && d.chosenOptionId !== o.id}
              />
            ))}
          </div>
        )
      )}

      <Facts>
        <Fact label={s.decider}>
          <RoleBadge role={d.deciderRole} outline={false} className="text-body-sm text-foreground" />
        </Fact>
        {card.dueAt && (
          <Fact label={t.sheet.fields.due}>
            <span
              title={absolute(card.dueAt, locale)}
              className={cn(late && 'font-medium text-destructive-soft-foreground')}
            >
              {when(card.dueAt, locale)}
              {card.status === 'open' && ' · '}
              {card.status === 'open' &&
                (late
                  ? fmt(t.sheet.fields.overdue, { d: duration(Date.parse(card.dueAt) - nowMs(), locale) })
                  : rel(card.dueAt, locale))}
            </span>
          </Fact>
        )}
        <Fact label={s.reminders}>
          {d.remindersSent.length ? formatReminders(d.remindersSent, locale) : s.noReminders}
        </Fact>
        {d.escalatedAt && d.escalatedToRole && card.status === 'open' && (
          <Fact label={t.status.escalated}>
            <span className="font-medium text-destructive-soft-foreground">
              {fmt(s.escalated, { role: t.roles[d.escalatedToRole], when: when(d.escalatedAt, locale) })}
            </span>
          </Fact>
        )}
        {d.decidedById && (
          <Fact label={s.decidedBy} wide>
            <span className="flex flex-wrap items-center gap-2">
              <ActorChip memberId={d.decidedById} />
              {d.decidedAt && <RelativeTime iso={d.decidedAt} className="text-muted-foreground" />}
            </span>
          </Fact>
        )}
        {d.rationale && (
          <Fact label={s.rationale} wide>
            <Bidi>{d.rationale}</Bidi>
          </Fact>
        )}
        {card.status === 'withdrawn' && typeof closing?.reason === 'string' && (
          <Fact label={m.reason} wide>
            <Bidi>{closing.reason}</Bidi>
          </Fact>
        )}
        {card.status === 'superseded' && typeof closing?.byKey === 'string' && (
          <Fact label={m.replacedBy} wide>
            <CardChip k={closing.byKey} showTitle className="max-w-full" />
          </Fact>
        )}
      </Facts>

      {blocks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{t.sheet.links.kinds.blocks}</SubHeading>
          <div className="flex flex-wrap gap-2">
            {blocks.map((l) => (
              <CardChip key={l.key} k={l.key} showTitle className="max-w-full" />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <SubHeading>{s.adr}</SubHeading>
        <AdrBlock card={card} />
      </div>
    </div>
  );
}

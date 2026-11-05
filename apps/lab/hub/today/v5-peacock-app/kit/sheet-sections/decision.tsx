import { useEffect, useId, useState, type ReactNode } from 'react';
import { Check, ExternalLink, Star } from 'lucide-react';
import { RadioGroup } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { DecisionCard, DecisionOption, L } from '@lab/mocks/hub-app';
import { openCard } from '../../shell/router';
import { Pill, RoleBadge } from '../badges';
import { Button } from '../button';
import { CardChip } from '../card-key';
import { ActorChip } from '../avatar';
import { patchCard } from '../card-store';
import { CopyButton } from '../copy-button';
import { detectSecret, Field, SecretFilterError, Select, Textarea } from '../form';
import { absolute, duration, nowMs, num, rel, when } from '../format';
import { kitMessages } from '../i18n';
import { focusRing } from '../meta';
import { RelativeTime } from '../relative-time';
import { useSession } from '../session';
import { Bidi, fill, fmt } from '../text';
import { ActionPanel, Fact, Facts, SubHeading, type SectionProps } from './shared';

/** Strings only this section needs. The card vocabulary stays in `kit/i18n.ts`. */
const local = {
  ar: {
    rationaleShort: 'اكتب {n} حرفًا على الأقل، ليفهم الفريق لاحقًا لماذا اخترت هذا.',
    draftAdr: 'اكتب مسودة ADR الآن',
    draftAdrHint: 'يمكن لك أو لمدير المشروع تعديلها قبل فتح PR.',
    adrRepo: 'مستودع ADR',
    repos: { backend: 'وثائق الباك إند', dashboard: 'وثائق لوحة التحكم', web: 'وثائق الموقع', hub: 'وثائق Hub' },
    openPr: 'افتح PR لهذا الـ ADR',
    viewPr: 'اعرض PR',
    reason: 'السبب',
    replacedBy: 'حلّ محله',
    related: 'وثائق مرتبطة',
    withdrawnNote: 'سُحب هذا القرار قبل أن يُحسم.',
  },
  en: {
    rationaleShort: 'Write at least {n} characters, so the team can later see why you chose this.',
    draftAdr: 'Draft the ADR now',
    draftAdrHint: 'You or the PM can edit it before opening the PR.',
    adrRepo: 'ADR repo',
    repos: { backend: 'Backend docs', dashboard: 'Dashboard docs', web: 'Web docs', hub: 'Hub docs' },
    openPr: 'Open a PR for this ADR',
    viewPr: 'View PR',
    reason: 'Reason',
    replacedBy: 'Replaced by',
    related: 'Related docs',
    withdrawnNote: 'This decision was withdrawn before it was made.',
  },
};

const MIN_RATIONALE = 20;

/** "24 h and 2 h before" / "قبل 24 ساعة وقبل ساعتين" (review M15). */
function formatReminders(hours: number[], locale: 'ar' | 'en') {
  if (locale === 'ar') return hours.map((h) => rel(new Date(nowMs() - h * 3_600_000).toISOString(), 'ar')).join(' و');
  return `${new Intl.ListFormat('en', { type: 'conjunction' }).format(hours.map((h) => `${h} h`))} before`;
}
const ADR_STEPS = ['drafted', 'pr_opened', 'merged'] as const;

function ProsCons({ title, items, locale, quiet }: { title: string; items: L[]; locale: keyof L; quiet: boolean }) {
  if (!items.length) return null;
  return (
    <div className="min-w-0">
      <p className="text-caption font-medium text-muted-foreground">{title}</p>
      <ul className={cn('mt-1 flex list-disc flex-col gap-0.5 ps-4 text-body-sm', quiet ? 'text-muted-foreground' : 'text-foreground')}>
        {items.map((item) => (
          <li key={item.en}>
            <Bidi>{item[locale]}</Bidi>
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
  chosen?: boolean;
  dimmed?: boolean;
  radio?: boolean;
  stacked?: boolean;
  footer?: ReactNode;
  className?: string;
}) {
  const t = useT(kitMessages);
  const locale = useLocale();
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {radio && (
          <span aria-hidden className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input group-data-[state=checked]:border-primary">
            <span className="size-2 rounded-full bg-primary opacity-0 group-data-[state=checked]:opacity-100" />
          </span>
        )}
        <span className={cn('text-body-lg font-semibold', dimmed ? 'text-muted-foreground' : 'text-foreground')}>
          <Bidi>{option.title[locale]}</Bidi>
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
        <ProsCons title={t.sheet.decision.pros} items={option.pros} locale={locale} quiet={dimmed} />
        <ProsCons title={t.sheet.decision.cons} items={option.cons} locale={locale} quiet={dimmed} />
      </div>
      {option.cost && (
        <p className="mt-2 text-body-sm text-muted-foreground">
          {t.sheet.decision.cost}: <Bidi>{option.cost[locale]}</Bidi>
        </p>
      )}
      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </>
  );
  if (radio) {
    return (
      <RadioGroup.Item
        value={option.id}
        className={cn('group block w-full cursor-pointer rounded-lg border border-border bg-card p-3 text-start transition-colors duration-120 hover:bg-accent data-[state=checked]:border-primary', focusRing, className)}
      >
        {body}
      </RadioGroup.Item>
    );
  }
  return <div className={cn('flex flex-col rounded-lg border bg-card p-3', chosen ? 'border-success' : 'border-border', dimmed && 'border-dashed', className)}>{body}</div>;
}

let preset: { key: string; optionId: string } | null = null;

/** Open the sheet's Decide form with this option picked, and the cursor in the rationale. The Decisions page uses it. */
export function openDecideWith(key: string, optionId: string) {
  preset = { key, optionId };
  openCard(key, { action: 'decide' });
}

function DecideForm({ card, onSave, onCancel }: { card: DecisionCard; onSave: SectionProps<'decision'>['perform']; onCancel: () => void }) {
  const t = useT(kitMessages);
  const m = useT(local);
  const locale = useLocale();
  const s = t.sheet.decision;
  const d = card.decision;
  const formId = useId();
  const presetOption = preset?.key === card.key ? preset.optionId : '';
  const [option, setOption] = useState(presetOption);
  const [rationale, setRationale] = useState('');
  const [draftAdr, setDraftAdr] = useState(true);
  const [repo, setRepo] = useState<keyof typeof m.repos>('backend');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    preset = null;
    if (presetOption) document.getElementById(`${formId}-why`)?.focus();
    // Once, when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const short = rationale.trim().length < MIN_RATIONALE;
  const secret = detectSecret(rationale);
  const submit = () => {
    setTried(true);
    if (!option || short || secret) return;
    const picked = d.options.find((o) => o.id === option);
    onSave('decide', { optionId: option, optionTitle: picked?.title[locale], rationale: rationale.trim(), draftAdr });
  };

  return (
    <ActionPanel onSubmit={submit} labelledBy={`${formId}-options`}>
      <SubHeading>
        <span id={`${formId}-options`}>{s.pick}</span>
      </SubHeading>
      <RadioGroup.Root value={option} onValueChange={setOption} aria-labelledby={`${formId}-options`} aria-invalid={(tried && !option) || undefined} className="flex flex-col gap-2">
        {d.options.map((o) => (
          <DecisionOptionCard key={o.id} option={o} radio />
        ))}
      </RadioGroup.Root>
      {tried && !option && (
        <p role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
          {s.needPick}
        </p>
      )}
      <Field id={`${formId}-why`} label={s.rationale} required hint={s.rationaleHint} error={tried && short ? fmt(m.rationaleShort, { n: num(MIN_RATIONALE, locale) }) : undefined}>
        <Textarea id={`${formId}-why`} dir="auto" rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} aria-invalid={(tried && short) || !!secret || undefined} />
      </Field>
      {secret && <SecretFilterError pattern={secret} />}
      <label className="flex min-h-11 items-start gap-2 text-body-sm text-foreground md:min-h-0">
        <input type="checkbox" checked={draftAdr} onChange={(e) => setDraftAdr(e.target.checked)} className={cn('mt-0.5 size-4 shrink-0 accent-primary', focusRing)} />
        <span>
          <span className="font-medium">{m.draftAdr}</span>
          <span className="block text-muted-foreground">{m.draftAdrHint}</span>
        </span>
      </label>
      {draftAdr && (
        <Field id={`${formId}-repo`} label={m.adrRepo}>
          <Select id={`${formId}-repo`} value={repo} onChange={(e) => setRepo(e.target.value as keyof typeof m.repos)}>
            {(Object.keys(m.repos) as (keyof typeof m.repos)[]).map((key) => (
              <option key={key} value={key}>
                {m.repos[key]}
              </option>
            ))}
          </Select>
        </Field>
      )}
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
  const m = useT(local);
  const { me, roles } = useSession();
  const s = t.sheet.decision;
  const d = card.decision;

  const openPr = () =>
    patchCard(card.key, (c) => {
      if (c.type !== 'decision') return c;
      return {
        ...c,
        decision: { ...c.decision, adrStatus: 'pr_opened', adrPrUrl: 'https://github.com/mohmedofficial515/Goteav-backend/pull/430', adrPath: c.decision.adrPath ?? `docs/adr/0018-${c.key.toLowerCase()}.md` },
        events: [...c.events, { id: `adr-${c.events.length + 1}`, seq: c.events.length + 1, kind: 'field_changed', actorKind: 'user', actorId: me.id, via: 'web', at: new Date(nowMs()).toISOString(), data: { field: 'adrStatus', from: 'drafted', to: 'pr_opened' } }],
      } as DecisionCard;
    });

  if (d.adrStatus === 'none') {
    return (
      <p className="text-body-sm leading-9 text-muted-foreground">
        {s.adrNone} {fill(s.adrHint, { cmd: <CopyButton compact text={`/hub:adr ${card.key}`} className="align-middle" /> })}
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
              <span aria-hidden className={cn('flex size-4 items-center justify-center rounded-full border', i <= at ? 'border-success bg-success-soft text-success-soft-foreground' : 'border-border')}>
                {i <= at && <Check className="size-2.5" strokeWidth={2.5} />}
              </span>
              <span className={i === at ? 'font-medium text-foreground' : 'text-muted-foreground'}>{s.adrStatus[step]}</span>
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
        <a href={d.adrPrUrl} target="_blank" rel="noreferrer" className={cn('hit-44 inline-flex items-center gap-1 self-start rounded-sm font-medium text-primary underline-offset-4 hover:underline', focusRing)}>
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
  const m = useT(local);
  const locale = useLocale();
  const d = card.decision;
  const s = t.sheet.decision;
  const late = card.status === 'open' && card.dueAt && Date.parse(card.dueAt) < nowMs();
  const closing = [...card.events].reverse().find((e) => e.data.reason || e.data.byKey)?.data;
  const blocks = card.links.filter((l) => l.kind === 'blocks');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-caption text-muted-foreground">{s.question}</p>
        <p className="mt-0.5 text-body-lg text-foreground">
          <Bidi>{d.question[locale]}</Bidi>
        </p>
      </div>

      {action === 'decide' && d.options.length > 0 ? (
        <DecideForm card={card} onSave={perform} onCancel={cancelAction} />
      ) : (
        d.options.length > 0 && (
          <div className="flex flex-col gap-2">
            <SubHeading>{s.options}</SubHeading>
            {d.options.map((o) => (
              <DecisionOptionCard key={o.id} option={o} chosen={d.chosenOptionId === o.id} dimmed={!!d.chosenOptionId && d.chosenOptionId !== o.id} />
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
            <span title={absolute(card.dueAt, locale)} className={cn(late && 'font-medium text-destructive-soft-foreground')}>
              {when(card.dueAt, locale)}
              {card.status === 'open' && ' · '}
              {card.status === 'open' && (late ? fmt(t.sheet.fields.overdue, { d: duration(Date.parse(card.dueAt) - nowMs(), locale) }) : rel(card.dueAt, locale))}
            </span>
          </Fact>
        )}
        <Fact label={s.reminders}>
          {d.remindersSent.length ? (
            formatReminders(d.remindersSent, locale)
          ) : (
            s.noReminders
          )}
        </Fact>
        {d.escalatedAt && d.escalatedToRole && card.status === 'open' && (
          <Fact label={t.status.escalated}>
            <span className="font-medium text-destructive-soft-foreground">{fmt(s.escalated, { role: t.roles[d.escalatedToRole], when: when(d.escalatedAt, locale) })}</span>
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
            <Bidi>{d.rationale[locale]}</Bidi>
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

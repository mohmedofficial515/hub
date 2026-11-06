'use client';

/**
 * @file need.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/sheet-sections/need.tsx. Contract: apps/web/README.md.
 */
import { Check, Signpost } from 'lucide-react';
import { useId, useState } from 'react';

import { ActorChip } from '@/components/cards/avatar';
import { Pill, RoleBadge } from '@/components/cards/badges';
import { CardChip } from '@/components/cards/card-key';
import { focusRing } from '@/components/cards/meta';
import {
  ActionPanel,
  Fact,
  Facts,
  NoteActionForm,
  type SectionProps,
  SubHeading,
} from '@/components/cards/sheet-sections/shared';
import { CopyButton } from '@/components/common/copy-button';
import { RelativeTime } from '@/components/common/relative-time';
import { Bidi } from '@/components/common/text';
import { Button } from '@/components/ui/button';
import { detectSecret, Field, SecretFilterError, Textarea, TextInput } from '@/components/ui/form';
import { useSession } from '@/features/session/session';
import { useT } from '@/lib/i18n';
import { kitMessages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Strings only this section needs. The card vocabulary stays in `kit/i18n.ts`. */

const STEPS = ['requested', 'in_progress', 'delivered', 'verified'] as const;

/** Addresses a member can start from. The last part is theirs to finish. */
const EXAMPLES = ['1Password › Goteav › ', 'backend .env on prod, key ', 'docs/finance/'];

/**
 * A long unbroken mix of cases and digits is a value, not an address, even when it matches no known token format. Names
 * of env keys (`PAYTR_SANDBOX_TOKEN`) and paths pass, since they have no lower case with digits, or they have separators.
 */
export function looksLikeRawValue(text: string) {
  return text
    .split(/[\s›,]+/)
    .some(
      (part) =>
        part.length >= 20 &&
        !/[/.]/.test(part) &&
        /[a-z]/.test(part) &&
        /[A-Z]/.test(part) &&
        /\d/.test(part),
    );
}

function PointerPath({ location }: { location: string }) {
  const parts = location.split(' › ');
  return (
    <code
      dir="ltr"
      translate="no"
      className="key block text-start text-body-sm wrap-break-word text-foreground"
    >
      {/* Each part stays whole where it fits, so a narrow column wraps at the separators and not inside a name. */}
      {parts.map((part, i) => (
        <span key={i} className="inline-block max-w-full">
          {i > 0 && <span className="px-1 text-muted-foreground">›</span>}
          <span className={cn(i === parts.length - 1 && parts.length > 1 && 'font-semibold')}>{part}</span>
        </span>
      ))}
    </code>
  );
}

/**
 * A need's delivery location. It reads as a signpost, not a credential: dashed outline (it points elsewhere), a label that
 * says so, and on purpose no dots, no mask and no reveal button, because there is nothing here to reveal. Copy takes the
 * address. Every place that shows a location uses this.
 */
export function LocationPointer({
  location,
  copy = true,
  className,
}: {
  location: string;
  copy?: boolean | undefined;
  className?: string | undefined;
}) {
  const m = useT(kitMessages).sections.need;
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-dashed border-input px-2.5 py-1.5',
        className,
      )}
    >
      <Signpost aria-hidden className="size-4 shrink-0 text-type-need-fg" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-caption text-muted-foreground">{m.pointer}</p>
        <PointerPath location={location} />
      </div>
      {copy && <CopyButton text={location} showText={false} label={m.copy} />}
    </div>
  );
}

/** requested → in progress → delivered → verified. Cancelled is a side state. */
export function NeedStatusStepper({ status }: { status: string }) {
  const t = useT(kitMessages);
  const at = STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm">
      {STEPS.map((step, i) => {
        // The last step is reached, not in progress, so it shows its check.
        const done = i < at || (i === at && step === 'verified');
        const current = i === at;
        return (
          <li key={step} className="flex items-center gap-1.5" aria-current={current ? 'step' : undefined}>
            {i > 0 && <span aria-hidden className="h-px w-3 bg-border" />}
            <span
              aria-hidden
              className={cn(
                'flex size-5 items-center justify-center rounded-full border',
                done && 'border-success bg-success-soft text-success-soft-foreground',
                current && !done && 'border-foreground text-foreground',
                !done && !current && 'border-border text-muted-foreground',
              )}
            >
              {done ? (
                <Check className="size-3" strokeWidth={2.25} />
              ) : (
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    current ? 'bg-foreground' : 'bg-muted-foreground/50',
                  )}
                />
              )}
            </span>
            <span className={cn(current ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {t.sheet.need.steps[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function DeliverForm({
  onSave,
  onCancel,
}: {
  onSave: (location: string, note: string) => void;
  onCancel: () => void;
}) {
  const t = useT(kitMessages);
  const m = useT(kitMessages).sections.need;
  const s = t.sheet.need;
  const id = useId();
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const secret =
    detectSecret(location) ??
    detectSecret(note) ??
    (looksLikeRawValue(location) || looksLikeRawValue(note) ? m.rawValue : null);
  const typed = location.trim();
  const missing = !typed;
  const submit = () => {
    setTried(true);
    if (!missing && !secret) onSave(typed, note.trim());
  };
  return (
    <ActionPanel onSubmit={submit}>
      <div className="flex items-start gap-2">
        <Signpost aria-hidden className="mt-0.5 size-4 shrink-0 text-type-need-fg" strokeWidth={1.75} />
        <p className="text-body-sm text-foreground">{m.rule}</p>
      </div>
      <Field
        id={`${id}-loc`}
        label={s.location}
        hint={s.locationHint}
        required
        error={tried && missing ? t.confirm.reasonRequired : undefined}
      >
        <TextInput
          id={`${id}-loc`}
          dir="ltr"
          className="key text-start"
          placeholder="1Password › Goteav › PayTR"
          autoComplete="off"
          spellCheck={false}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          aria-invalid={!!detectSecret(location) || looksLikeRawValue(location) || undefined}
        />
      </Field>
      <div role="group" aria-label={m.examples} className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setLocation(example);
              document.getElementById(`${id}-loc`)?.focus();
            }}
            className={cn(
              'key inline-flex h-11 items-center rounded-full border border-border bg-card px-2.5 text-caption text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground md:h-7',
              focusRing,
            )}
          >
            <bdi dir="ltr">{example.trim()}</bdi>
          </button>
        ))}
      </div>
      {secret && <SecretFilterError pattern={secret} />}
      {typed && !secret && (
        <div className="flex flex-col gap-1">
          <p className="text-body-sm text-muted-foreground">{m.savedAs}</p>
          <LocationPointer location={typed} copy={false} />
        </div>
      )}
      <Field id={`${id}-note`} label={t.sheet.fields.noteOptional}>
        <Textarea
          id={`${id}-note`}
          dir="auto"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={!!detectSecret(note) || looksLikeRawValue(note) || undefined}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">
          {s.saveDeliver}
        </Button>
        <Button onClick={onCancel}>{t.cancel}</Button>
      </div>
    </ActionPanel>
  );
}

export function NeedSection({ card, action, cancelAction, perform }: SectionProps<'need'>) {
  const t = useT(kitMessages);
  const m = useT(kitMessages).sections.need;
  const n = card.need;
  const s = t.sheet.need;
  const reason =
    card.status === 'cancelled'
      ? [...card.events].reverse().find((e) => e.data.reason)?.data.reason
      : undefined;
  const blocks = card.links.filter((l) => l.kind === 'blocks');
  const { me } = useSession();
  const self = n.deliveredById === me.id;
  return (
    <div className="flex flex-col gap-5">
      {card.status === 'cancelled' ? (
        <Pill tone="danger" className="self-start">
          {m.cancelled}
        </Pill>
      ) : (
        <NeedStatusStepper status={card.status} />
      )}
      {action === 'deliver' && (
        <DeliverForm
          onSave={(location, note) => perform('deliver', { location, note: note || undefined })}
          onCancel={cancelAction}
        />
      )}
      {action === 'verify' && (
        <NoteActionForm
          hint={self ? m.selfHint : m.verifyHint}
          noteLabel={s.verifyNote}
          required={self}
          requiredMessage={m.selfRequired}
          saveLabel={s.saveVerify}
          onSave={(note) => perform('verify', { note: note || undefined, selfVerify: self || undefined })}
          onCancel={cancelAction}
        />
      )}
      {n.location && <LocationPointer location={n.location} />}
      <Facts>
        <Fact label={t.sheet.fields.kind}>{s.kinds[n.kind]}</Fact>
        <Fact label={t.sheet.fields.responsible}>
          <RoleBadge role={n.responsibleRole} outline={false} className="text-body-sm text-foreground" />
        </Fact>
        {n.requesterId && (
          <Fact label={t.sheet.fields.requester}>
            <ActorChip memberId={n.requesterId} />
          </Fact>
        )}
        {!n.location && card.status !== 'cancelled' && action !== 'deliver' && (
          <Fact label={s.location} wide>
            <span className="text-muted-foreground">{s.locationPending}</span>
          </Fact>
        )}
        {typeof reason === 'string' && (
          <Fact label={m.reason} wide>
            <Bidi>{reason}</Bidi>
          </Fact>
        )}
        {n.deliveredById && (
          <Fact label={s.deliveredBy} wide>
            <span className="flex flex-wrap items-center gap-2">
              <ActorChip memberId={n.deliveredById} />
              {n.deliveredAt && <RelativeTime iso={n.deliveredAt} className="text-muted-foreground" />}
            </span>
          </Fact>
        )}
        {n.verifiedById && (
          <Fact label={s.verifiedBy} wide>
            <span className="flex flex-wrap items-center gap-2">
              <ActorChip memberId={n.verifiedById} />
              {n.verifiedAt && <RelativeTime iso={n.verifiedAt} className="text-muted-foreground" />}
              {(n.selfVerified || n.verifiedById === n.deliveredById) && (
                <Pill tone="info">{m.selfVerified}</Pill>
              )}
            </span>
          </Fact>
        )}
        {n.verificationNote && (
          <Fact label={s.verifyNote} wide>
            <Bidi>{n.verificationNote}</Bidi>
          </Fact>
        )}
      </Facts>
      {blocks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SubHeading>{t.sheet.links.kinds.blocks}</SubHeading>
          <div className="flex flex-wrap gap-2">
            {blocks.map((l) => (
              <CardChip key={l.key} k={l.key} showTitle />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

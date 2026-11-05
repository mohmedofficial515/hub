import { ArrowRight, ChevronDown, Clock } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { members } from '@lab/mocks/hub-app';
import { Bidi, CardChip, CardRow, cn, duration, firstName, fmt, focusRing, HandoffDiffList, kitMessages, Pill, plural, rel, RoleBadge, RowAction, StatusBadge, useKeyboardList, useMedia, type HandoffCard } from '../../../kit';
import { CopyPromptButton, handoffAgeMs, isHandoffStale, severityTone } from '../../../kit/sheet-sections/handoff';
import { messages } from '../i18n';

type RowProps = ReturnType<typeof useKeyboardList>['rowProps'];

const nameOf = (id: string | undefined, locale: 'ar' | 'en') => {
  const member = members.find((m) => m.id === id);
  return member ? firstName(member.name[locale]) : '';
};

/**
 * A handoff row. The receiver's first questions are how bad it is, who sent it, and whether it has been received, so those
 * are the meta line. The diff opens in place under the row, because reading it is most of receiving it; the sheet is
 * for acting. `primary` is the page's one filled button.
 */
export function HandoffRow({ card, rowProps, primary, open, onToggle }: { card: HandoffCard; rowProps: RowProps; primary: boolean; open: boolean; onToggle: () => void }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const roomy = useMedia('(min-width: 640px)');
  const h = card.handoff;
  const titleId = `hand-${card.key}`;
  const panelId = `hand-${card.key}-changes`;
  const stale = isHandoffStale(card);
  const changes = h.payload.oasdiff ?? [];
  const files = h.payload.files ?? [];
  const breaking = changes.filter((c) => c.severity === 'breaking').length;
  const hasDetail = changes.length > 0 || files.length > 0 || !!h.prompt;
  const moving = card.status === 'pending' || card.status === 'acknowledged';
  const reason = card.status === 'dismissed' ? [...card.events].reverse().find((e) => e.data.reason)?.data.reason : undefined;

  const actions = moving && (
    <>
      {h.prompt && <CopyPromptButton prompt={h.prompt} size={roomy ? 'md' : 'sm'} aria-describedby={titleId} />}
      <RowAction card={card} action={card.status === 'pending' ? 'acknowledge' : 'apply'} variant={primary ? 'primary' : 'outline'} size={roomy ? 'md' : 'sm'} aria-describedby={titleId} aria-keyshortcuts={card.status === 'pending' ? 'a' : undefined} />
    </>
  );

  return (
    <div>
      <CardRow
        {...rowProps(card.key)}
        cardKey={card.key}
        type="handoff"
        title={card.title[locale]}
        tone={h.severity === 'breaking' && moving ? 'danger' : 'type'}
        lead={primary}
        titleId={titleId}
        className={cn(open && 'rounded-b-none')}
        meta={
          <>
            <Pill tone={severityTone[h.severity]}>{kit.sheet.handoff.severities[h.severity]}</Pill>
            <span title={fmt(t.row.route, { from: kit.roles[h.fromRole], to: kit.roles[h.toRole] })} className="inline-flex items-center gap-1">
              <RoleBadge role={h.fromRole} outline={false} className="text-body-sm" />
              <ArrowRight aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
              <span className="sr-only">{kit.sheet.fields.to}</span>
              <RoleBadge role={h.toRole} outline={false} className="text-body-sm" />
            </span>
            {card.status === 'pending' &&
              (stale ? (
                <Pill tone="warning" icon={Clock}>
                  {fmt(t.row.stale, { d: duration(handoffAgeMs(card), locale) })}
                </Pill>
              ) : (
                <span>{rel(card.createdAt, locale)}</span>
              ))}
            {card.status === 'acknowledged' && h.acknowledgedAt && <span>{fmt(t.row.ackBy, { name: nameOf(h.acknowledgedById, locale), rel: rel(h.acknowledgedAt, locale) })}</span>}
            {card.status === 'applied' && h.appliedAt && <span>{fmt(t.row.appliedBy, { name: nameOf(h.appliedById, locale), rel: rel(h.appliedAt, locale) })}</span>}
            {h.appliedTaskKey && <CardChip k={h.appliedTaskKey} className="relative z-10" />}
            {card.status === 'dismissed' && <StatusBadge status="dismissed" />}
            {typeof reason === 'string' && (
              <span className="basis-full">
                <Bidi>{reason}</Bidi>
              </span>
            )}
            {hasDetail && (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={onToggle}
                className={cn('hit-44 relative z-10 inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline-offset-4 hover:underline', focusRing)}
              >
                <ChevronDown aria-hidden className={cn('size-3.5 transition-transform duration-120 motion-reduce:transition-none', open && 'rotate-180')} strokeWidth={1.75} />
                {open ? t.row.hideChanges : t.row.showChanges}
                {!open && changes.length > 0 && (
                  <span className="font-normal text-muted-foreground">
                    {breaking > 0 ? fmt(t.row.changesWithBreaking, { changes: plural(changes.length, locale, t.row.changeCount), breaking: plural(breaking, locale, t.row.breakingCount) }) : plural(changes.length, locale, t.row.changeCount)}
                  </span>
                )}
                {!open && !changes.length && files.length > 0 && <span className="font-normal text-muted-foreground">{plural(files.length, locale, t.row.fileCount)}</span>}
              </button>
            )}
            {!roomy && actions && <div className="relative z-10 mt-1 flex basis-full flex-wrap gap-2 *:flex-1">{actions}</div>}
          </>
        }
        action={roomy && actions ? actions : undefined}
      />
      {open && hasDetail && (
        <div id={panelId} className={cn('flex flex-col gap-3 -mt-px rounded-b-lg border bg-card p-3 md:p-4', h.severity === 'breaking' && moving ? 'border-destructive/70' : 'border-border')}>
          <HandoffDiffList changes={changes.length ? changes : undefined} schemas={h.payload.schemas} files={files.length ? files : undefined} />
          {h.prompt && (
            <div className="flex flex-col gap-1">
              <p className="text-body-sm text-muted-foreground">{t.row.prompt}</p>
              <pre dir="ltr" className="key rounded-md border border-border bg-muted p-2.5 text-start text-body-sm wrap-break-word whitespace-pre-wrap text-foreground">
                {h.prompt}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

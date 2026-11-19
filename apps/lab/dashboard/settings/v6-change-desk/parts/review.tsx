// Review & apply: changes grouped by group with risk per change, required reason, security confirmation, type-to-confirm
// for high impact, second-approver notice, then a sequential apply (each group gets its own version). Batch apply is a proposal.
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, Clock, LoaderCircle, Ticket, TriangleAlert, Users } from 'lucide-react';
import { cn } from '@dash/lib/utils';
import { getGroup } from '@lab/mocks/settings';
import { needsSecondApprover } from './data';
import { num } from './format';
import { readParam, ticketStats, useDesk, useStaged, type ApplyResult } from './store';
import { ChangeLine, Perforation, TicketStub } from './tray';
import { Badge, Btn, Card, focusRing, Icon } from './ui';

export function Review() {
  const { t, l, role, go, ticketCode, versions, applyGroup, finishTicket, staleGroups, rebase, updated } = useDesk();
  const { items, byGroup } = useStaged();
  const reduce = useReducedMotion();
  const stats = ticketStats(items, role);
  const [reason, setReason] = useState('');
  const [secOk, setSecOk] = useState(false);
  const [typed, setTyped] = useState('');
  const [tried, setTried] = useState(false);
  const [phase, setPhase] = useState<'review' | 'applying' | 'done'>('review');
  const [plan, setPlan] = useState<string[]>([]);
  const [results, setResults] = useState<ApplyResult[]>([]);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const secRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLInputElement>(null);
  const Back = t.dir === 'rtl' ? ArrowRight : ArrowLeft;

  const reasonRequired = stats.high > 0 || stats.security > 0;
  const reasonOk = reasonRequired ? reason.trim().length >= 8 : reason.trim().length === 0 || reason.trim().length >= 3;
  const secNeeded = stats.security > 0;
  const typeNeeded = stats.high > 0;
  const typeOk = typed.trim().toUpperCase() === ticketCode;
  const ready = reasonOk && (!secNeeded || secOk) && (!typeNeeded || typeOk);

  const start = () => {
    setTried(true);
    if (!reasonOk) return reasonRef.current?.focus();
    if (secNeeded && !secOk) return secRef.current?.focus();
    if (typeNeeded && !typeOk) return typeRef.current?.focus();
    const keys = byGroup.map((g) => g.groupKey);
    setPlan(keys);
    setResults(keys.map((groupKey) => ({ groupKey, status: 'pending' })));
    setPhase('applying');
  };

  // Sequential apply, one group after another (the backend saves one group per request).
  useEffect(() => {
    if (phase !== 'applying') return;
    const i = results.findIndex((r) => r.status === 'pending');
    if (i === -1) {
      setPhase('done');
      if (!results.some((r) => r.status === 'failed')) finishTicket();
      return;
    }
    const timer = window.setTimeout(
      () => {
        const fail = readParam('fail') === 'last' && i === plan.length - 1 && plan.length > 1;
        const r = applyGroup(plan[i], reason.trim(), { fail });
        setResults((all) => all.map((x, k) => (k === i ? r : x)));
      },
      reduce ? 60 : 650,
    );
    return () => window.clearTimeout(timer);
  }, [phase, results, plan, applyGroup, reason, reduce, finishTicket]);

  const retry = (groupKey: string) => {
    const r = applyGroup(groupKey, reason.trim(), { force: true });
    setResults((all) => all.map((x) => (x.groupKey === groupKey ? r : x)));
  };

  if (phase !== 'review') {
    const appliedN = results.filter((r) => r.status === 'applied' || r.status === 'waiting').length;
    const failedN = results.filter((r) => r.status === 'failed').length;
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-5">
        <Card className="grid gap-5 p-6" aria-live="polite">
          <div className="flex items-center gap-3">
            {phase === 'applying' ? (
              <LoaderCircle aria-hidden className={cn('size-6 text-[color:var(--primary)]', !reduce && 'animate-spin')} />
            ) : failedN > 0 ? (
              <TriangleAlert aria-hidden className="size-6 text-warning-strong" />
            ) : (
              <CircleCheck aria-hidden className="size-6 text-success" />
            )}
            <h1 className="text-20 font-extrabold">
              {phase === 'applying' ? t.review.applying : failedN > 0 ? t.review.partialTitle(appliedN, results.length) : t.review.doneTitle(appliedN)}
            </h1>
          </div>
          <ol className="grid gap-2">
            {results.map((r) => {
              const g = getGroup(r.groupKey)!;
              return (
                <motion.li
                  key={r.groupKey}
                  layout={!reduce}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                >
                  <Icon name={g.icon} className="size-4 text-[color:var(--primary)]" />
                  <span className="min-w-0 flex-1 text-14 font-bold">{g.title[l]}</span>
                  {r.status === 'pending' && (
                    <span className="inline-flex items-center gap-1.5 text-12 text-muted-foreground">
                      <Clock aria-hidden className="size-3.5" />
                      {t.review.pending}
                    </span>
                  )}
                  {r.status === 'applied' && (
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone="success" icon={<CircleCheck aria-hidden />}>{t.review.applied(r.version!)}</Badge>
                      {phase === 'done' && (
                        <Btn size="sm" variant="ghost" onClick={() => go({ v: 'timeline', g: r.groupKey })}>
                          {t.review.openVersion}
                        </Btn>
                      )}
                    </span>
                  )}
                  {r.status === 'waiting' && <Badge tone="info" icon={<Users aria-hidden />}>{t.review.waiting(r.requestId!)}</Badge>}
                  {r.status === 'failed' && (
                    <div className="grid w-full gap-2 sm:w-auto sm:justify-items-end">
                      <Badge tone="danger" icon={<CircleAlert aria-hidden />}>{t.review.failed}</Badge>
                      <p className="text-13 text-muted-foreground">{t.review.failedBody(r.by ?? updated[r.groupKey]?.by ?? '')}</p>
                      <Btn variant="outline" onClick={() => retry(r.groupKey)}>
                        {t.review.retry}
                      </Btn>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </ol>
          {phase === 'done' && (
            <div className="grid gap-3">
              {results.some((r) => r.status === 'failed') && <p className="text-13 text-muted-foreground">{t.review.partNote}</p>}
              <div className="flex flex-wrap gap-2">
                <Btn variant="primary" onClick={() => go({ v: 'timeline' })}>
                  {t.review.toTimeline}
                </Btn>
                <Btn variant="outline" onClick={() => go({ v: 'overview' })}>
                  {t.review.toOverview}
                </Btn>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Btn variant="ghost" className="-ms-2" onClick={() => (items.length ? go({ v: 'group', g: items[items.length - 1].field.groupKey }) : go({ v: 'overview' }))}>
          <Back aria-hidden />
          {t.review.back}
        </Btn>
      </div>

      <Card className="flex flex-col overflow-hidden sm:flex-row" aria-labelledby="review-title">
        <div className="p-5 sm:w-52 sm:p-6">
          <TicketStub count={items.length} />
        </div>
        <Perforation vertical={false} className="sm:hidden" />
        <Perforation className="hidden sm:block" />
        <div className="grid min-w-0 flex-1 gap-2 p-5 sm:p-6">
          <h1 id="review-title" className="text-22 font-extrabold leading-tight">
            {t.review.title}
          </h1>
          <p className="text-14 text-muted-foreground">{items.length ? t.ticket.summary(items.length, stats.groups) : t.review.empty}</p>
          <p className="flex flex-wrap items-start gap-2 text-12 leading-relaxed text-muted-foreground">
            <Badge tone="info">{t.review.proposal}</Badge>
            <span className="min-w-0 flex-1">{t.review.proposalNote}</span>
          </p>
        </div>
      </Card>

      {items.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="grid min-w-0 gap-4">
            {byGroup.map(({ groupKey, items: list }) => {
              const g = getGroup(groupKey)!;
              const v = versions[groupKey] ?? g.version;
              const second = list.some((i) => needsSecondApprover(i.field));
              return (
                <Card key={groupKey} className="overflow-hidden" aria-labelledby={`rv-${groupKey}`}>
                  <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
                    <Icon name={g.icon} className="size-5 text-[color:var(--primary)]" />
                    <div className="grid min-w-0 flex-1">
                      <h2 id={`rv-${groupKey}`} className="text-16 font-extrabold">
                        {g.title[l]}
                      </h2>
                      <span className="text-12 text-muted-foreground">{t.review.changesIn(list.length)}</span>
                    </div>
                    {second && role === 'staff' ? (
                      <Badge tone="info" icon={<Users aria-hidden />}>
                        {t.review.waitsApprover}
                      </Badge>
                    ) : (
                      <span className="rounded-md bg-muted px-2 py-1 text-12 font-bold tabular-nums">{t.review.groupVersion(v, v + 1)}</span>
                    )}
                  </div>
                  {staleGroups.includes(groupKey) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-warning/10 px-5 py-3 text-13">
                      <span className="flex min-w-0 items-start gap-2">
                        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-strong" />
                        {t.ticket.stale(g.title[l], updated[groupKey]?.by ?? g.updatedBy)}
                      </span>
                      <Btn variant="outline" onClick={() => rebase(groupKey)}>
                        {t.ticket.rebase}
                      </Btn>
                    </div>
                  )}
                  {second && (
                    <p className="flex items-start gap-2 border-b bg-muted/40 px-5 py-2.5 text-12 leading-relaxed text-muted-foreground">
                      <Users aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      {role === 'staff' ? t.review.waitsApproverBody : `${t.review.ownerDirect}. ${t.review.ownerDirectBody}`}
                    </p>
                  )}
                  <ul className="divide-y px-5">
                    {list.map((it) => (
                      <ChangeLine key={it.id} item={it} />
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>

          <Card as="aside" className="grid gap-5 p-5 lg:sticky lg:top-4" aria-labelledby="apply-title">
            <h2 id="apply-title" className="flex items-center gap-2 text-16 font-extrabold">
              <Ticket aria-hidden className="size-4 text-[color:var(--primary)]" />
              {t.review.blockers}
            </h2>

            <div className="grid gap-1.5">
              <label htmlFor="reason" className="text-13 font-bold">
                {t.review.reason} {reasonRequired && <span aria-hidden className="text-destructive-soft-foreground">*</span>}
              </label>
              <textarea
                ref={reasonRef}
                id="reason"
                required={reasonRequired}
                maxLength={500}
                rows={3}
                value={reason}
                placeholder={t.review.reasonPlaceholder}
                aria-invalid={tried && !reasonOk}
                aria-describedby="reason-hint"
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => reason && setTried(true)}
                className="min-h-24 w-full rounded-lg border bg-background p-3 text-14 leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
              />
              <p id="reason-hint" className={cn('flex justify-between gap-2 text-12', tried && !reasonOk ? 'text-destructive-soft-foreground' : 'text-muted-foreground')}>
                <span>{tried && !reasonOk ? t.review.reasonShort : reasonRequired ? t.review.reasonHint : t.review.reasonOptional}</span>
                <span className="tabular-nums">{num(reason.length, l)}/500</span>
              </p>
            </div>

            {secNeeded && (
              <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3', tried && !secOk && 'border-destructive')}>
                <input
                  ref={secRef}
                  type="checkbox"
                  checked={secOk}
                  onChange={(e) => setSecOk(e.target.checked)}
                  className={cn('mt-0.5 size-5 shrink-0 accent-[color:var(--primary)]', focusRing)}
                />
                <span className="text-13 leading-relaxed">{t.review.confirmSecurity(stats.security)}</span>
              </label>
            )}

            {typeNeeded && (
              <div className="grid gap-1.5">
                <label htmlFor="type-code" className="text-13 leading-relaxed">
                  {t.review.typeToConfirm(ticketCode)}
                </label>
                <input
                  ref={typeRef}
                  id="type-code"
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                  value={typed}
                  placeholder={ticketCode}
                  aria-invalid={tried && !typeOk}
                  aria-describedby={tried && !typeOk ? 'type-err' : undefined}
                  onChange={(e) => setTyped(e.target.value)}
                  onBlur={() => typed && setTried(true)}
                  className="h-11 w-full rounded-lg border bg-background px-3 text-15 font-bold tracking-wider text-start outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
                />
                {tried && !typeOk && (
                  <p id="type-err" className="text-12 text-destructive-soft-foreground">
                    {t.review.typeMismatch}
                  </p>
                )}
              </div>
            )}

            <ul id="apply-steps" className="grid gap-1.5 text-13">
              {[
                ...(reasonRequired ? [{ ok: reasonOk, label: t.review.blockerReason }] : []),
                ...(secNeeded ? [{ ok: secOk, label: t.review.blockerSecurity }] : []),
                ...(typeNeeded ? [{ ok: typeOk, label: t.review.blockerType }] : []),
              ].map((b) => (
                <li key={b.label} className={cn('flex items-center gap-2', b.ok ? 'text-foreground' : 'text-muted-foreground')}>
                  {b.ok ? <CircleCheck aria-hidden className="size-4 text-success" /> : <span aria-hidden className="inline-block size-4 rounded-full border-2" />}
                  {b.label}
                </li>
              ))}
            </ul>

            <Btn variant="primary" className="h-12 w-full text-15 sm:h-11" disabled={!ready} aria-describedby="apply-steps apply-hint" onClick={start}>
              {t.review.applyCount(byGroup.length)}
            </Btn>
            {!ready && (
              <p id="apply-hint" className="-mt-3 text-12 text-muted-foreground">
                {t.review.disabledHint}
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

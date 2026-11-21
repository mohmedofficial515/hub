import type { ReactNode } from 'react';
import { ArrowRight, Copy, History, RotateCcw, ShieldCheck, X } from 'lucide-react';
import type { Field, SettingsGroup } from '@lab/mocks/settings';
import { cn } from './cn';
import { dateTime, fieldsOf, findField, num, readable, relative, same, unitText } from './lib';
import { useStore } from './store';
import { Btn, IconBtn, Pill } from './ui';

export function InspectorBody({ group, onClose }: { group: SettingsGroup; onClose?: () => void }) {
  const s = useStore();
  const { t } = s;
  const field = s.focus ? findField(group, s.focus) : undefined;
  const entries = s.history[group.key]?.length ?? 1;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
        <div role="tablist" aria-label={t.inspector.title} className="flex flex-1 gap-1">
          {(['field', 'history'] as const).map((tab) => {
            const on = s.inspectorTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`insp-tab-${tab}`}
                aria-selected={on}
                aria-controls={`insp-panel-${tab}`}
                onClick={() => s.setInspectorTab(tab)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-13 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9',
                  on ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab === 'field' ? t.inspector.tabField : t.inspector.tabHistory}
                {tab === 'history' ? <span className="text-11 tabular-nums text-muted-foreground">{entries}</span> : null}
              </button>
            );
          })}
        </div>
        {onClose ? (
          <IconBtn label={t.editor.closeDetails} onClick={onClose}>
            <X className="size-4" aria-hidden />
          </IconBtn>
        ) : null}
      </div>
      <div role="tabpanel" id={`insp-panel-${s.inspectorTab}`} aria-labelledby={`insp-tab-${s.inspectorTab}`} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {s.inspectorTab === 'history' ? <HistoryTimeline group={group} /> : field ? <FieldDetails group={group} field={field} /> : <GroupInfo group={group} />}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2 text-13">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children}</dd>
    </div>
  );
}

function FieldDetails({ group, field }: { group: SettingsGroup; field: Field }) {
  const s = useStore();
  const { t, locale } = s;
  const saved = s.values[group.key]?.[field.key];
  const draft = s.draftValue(field);
  const edited = !same(saved, draft);
  const changed = !same(draft, field.default);
  const impact =
    field.risk === 'high' ? t.inspector.impactHigh : field.control === 'security' ? t.inspector.impactSecurity : field.control === 'money' ? t.inspector.impactMoney : t.inspector.impactNormal;

  return (
    <div>
      <h3 className="text-16 font-bold leading-snug">{field.label[locale]}</h3>
      <p className="mt-1.5 text-13 leading-relaxed text-muted-foreground">{field.help[locale]}</p>
      {field.note ? <p className="mt-2 text-12 leading-relaxed text-warning-strong dark:text-warning">{field.note[locale]}</p> : null}
      <dl className="mt-4 divide-y divide-border/60 border-y border-border/60">
        <Row label={t.inspector.current}>
          <bdi>{readable(field, saved, t, locale)}</bdi>
        </Row>
        {edited ? (
          <Row label={t.inspector.draft}>
            <span className="text-warning-strong dark:text-warning">
              <bdi>{readable(field, draft, t, locale)}</bdi>
            </span>
          </Row>
        ) : null}
        <Row label={t.inspector.default}>
          <bdi>{readable(field, field.default, t, locale)}</bdi>
        </Row>
        {field.min !== undefined || field.max !== undefined ? (
          <Row label={t.inspector.allowed}>
            <span className="tabular-nums">
              {t.field.range(num(field.min ?? 0), field.max !== undefined ? num(field.max) : '∞')} {unitText(t, field.unit)}
            </span>
          </Row>
        ) : null}
        <Row label={t.inspector.type}>{t.types[field.type]}</Row>
        <Row label={t.inspector.key}>
          <code dir="ltr" className="inline-block max-w-full rounded bg-muted px-1.5 py-0.5 font-mono text-12 [overflow-wrap:anywhere] [word-break:normal]">
            {`${field.storedIn ?? group.key}.${field.key}`.split('.').map((part, i, all) => (
              <span key={i}>
                {part}
                {i < all.length - 1 ? (
                  <>
                    .<wbr />
                  </>
                ) : null}
              </span>
            ))}
          </code>
        </Row>
      </dl>

      <div className="mt-4 rounded-xl bg-muted/60 p-3">
        <p className="flex items-center gap-1.5 text-12 font-bold">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden />
          {t.inspector.impact}
        </p>
        <p className="mt-1 text-12 leading-relaxed text-muted-foreground">{impact}</p>
        {field.twoPerson ? <p className="mt-1 text-12 leading-relaxed text-muted-foreground">{t.inspector.twoPerson}</p> : null}
        {group.approval === 'second-approver' && field.control === 'security' ? (
          <p className="mt-1 text-12 font-semibold">{s.role === 'owner' ? t.review.appliesOwner : t.review.waits}</p>
        ) : null}
      </div>

      {field.proposed || field.proposedOptions?.length ? (
        <div className="mt-3 rounded-xl border border-dashed p-3">
          <p className="flex flex-wrap items-center gap-2 text-12 font-bold">
            <Pill tone="info">{t.field.proposed}</Pill>
            {field.proposalId ? (
              <span dir="ltr" className="font-mono">
                {field.proposalId}
              </span>
            ) : null}
            {field.priority ? (
              <span>
                {t.inspector.priority} {field.priority}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-12 text-muted-foreground">{field.needsBackend ? t.inspector.needsBackend : t.inspector.frontendOnly}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {changed && !field.readOnly && !field.structured ? (
          <Btn onClick={() => s.edit(field, field.default)}>
            <RotateCcw className="size-4" aria-hidden />
            {t.inspector.reset}
          </Btn>
        ) : null}
        <Btn
          variant="ghost"
          onClick={() => {
            const url = location.href;
            navigator.clipboard?.writeText(url).catch(() => undefined);
            s.say(t.inspector.copied);
          }}
        >
          <Copy className="size-4" aria-hidden />
          {t.inspector.copyLink}
        </Btn>
      </div>
    </div>
  );
}

function GroupInfo({ group }: { group: SettingsGroup }) {
  const s = useStore();
  const { t, locale } = s;
  const fields = fieldsOf(group);
  const changed = fields.filter((f) => !same(s.values[group.key]?.[f.key], f.default)).length;
  return (
    <div>
      <p className="text-12 font-semibold text-muted-foreground">{t.inspector.groupInfo}</p>
      <h3 className="mt-1 text-16 font-bold">{group.title[locale]}</h3>
      <p className="mt-1.5 text-13 leading-relaxed text-muted-foreground">{group.summary[locale]}</p>
      <p className="mt-3 text-12 tabular-nums text-muted-foreground">{t.inspector.counts(fields.length, changed)}</p>
      <div className="mt-4 rounded-xl bg-muted/60 p-3">
        <p className="text-12 font-bold">{t.inspector.approval}</p>
        <p className="mt-1 text-12 leading-relaxed text-muted-foreground">
          {group.approval === 'second-approver' ? t.inspector.approvalSecond : group.approval === 'controls' ? t.inspector.approvalControls : t.inspector.approvalNone}
        </p>
      </div>
      <p className="mt-6 rounded-xl border border-dashed p-4 text-13 text-muted-foreground">{t.inspector.pickField}</p>
    </div>
  );
}

export function HistoryTimeline({ group }: { group: SettingsGroup }) {
  const s = useStore();
  const { t, locale } = s;
  const current = s.versions[group.key];
  const list = s.history[group.key]?.length
    ? s.history[group.key]
    : [{ version: current, at: s.meta[group.key].at, by: s.meta[group.key].by, note: null, changes: [] }];
  const oldest = list[list.length - 1]?.version;

  return (
    <div>
      <ol className="relative">
        {list.map((e, i) => {
          const isCurrent = e.version === current;
          return (
            <li key={e.version} className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 pb-5">
              {i < list.length - 1 ? <span aria-hidden className="absolute start-[1.05rem] top-9 bottom-0 w-px bg-border" /> : null}
              <span
                className={cn(
                  'z-[1] inline-flex size-9 items-center justify-center rounded-full text-11 font-bold tabular-nums',
                  isCurrent ? 'bg-primary text-primary-foreground' : 'border bg-card text-muted-foreground',
                )}
              >
                v{e.version}
              </span>
              <div className="min-w-0 pt-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-13 font-bold">{e.by}</span>
                  <time dateTime={e.at} title={dateTime(e.at, locale)} className="text-12 text-muted-foreground">
                    {relative(e.at, locale)}
                  </time>
                  {isCurrent ? <Pill tone="primary">{t.inspector.currentVersion}</Pill> : null}
                </div>
                <p className={cn('mt-0.5 text-13', !e.note && 'italic text-muted-foreground')}>{e.note ? e.note[locale] : t.inspector.noNote}</p>
                {e.requestId ? (
                  <p className="mt-0.5 text-11 text-muted-foreground">
                    <bdi dir="ltr">{t.inspector.request(e.requestId)}</bdi>
                    {e.approvedBy ? ` · ${t.inspector.approvedBy(e.approvedBy)}` : ''}
                  </p>
                ) : null}
                {e.changes.length ? (
                  <ul className="mt-2 grid grid-cols-1 gap-1.5 rounded-lg bg-muted/50 p-2.5">
                    {e.changes.map((c, j) => {
                      const f = findField(group, c.field);
                      return (
                        <li key={j} className="text-12 leading-relaxed">
                          <span className="font-semibold">{f?.label[locale] ?? c.field}</span>
                          <span className="text-muted-foreground">: </span>
                          <span className="text-muted-foreground">
                            <bdi>{readable(f, c.from, t, locale)}</bdi>
                          </span>
                          <ArrowRight className="mx-1 inline size-3 text-muted-foreground rtl:rotate-180" aria-label="→" />
                          <bdi className="font-semibold">{readable(f, c.to, t, locale)}</bdi>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {!isCurrent ? (
                  <button
                    type="button"
                    onClick={() => s.openRestore(e.version)}
                    data-restore={e.version}
                    title={t.inspector.restoreHint(e.version, current + 1)}
                    className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-12 font-semibold text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:min-h-8"
                  >
                    <History className="size-3.5" aria-hidden />
                    {t.inspector.restore(e.version)}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-12 text-muted-foreground">{list.length <= 1 ? t.inspector.historyFirst(oldest) : t.inspector.historyEmpty}</p>
    </div>
  );
}

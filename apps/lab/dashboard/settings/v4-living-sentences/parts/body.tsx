/**
 * A subsection of a group page: heading, the paragraph of living sentences, a tidy "Details" list for what does not read as a
 * sentence (urls, secrets, long lists, structured or leftover fields), engineering fields folded under "Advanced", and the classic
 * rows of the advanced view.
 */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ChevronDown, Lock, RotateCcw, Send } from 'lucide-react';
import type { Field, Subsection } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { useBook } from './store';
import { cleanLabel, fill, formatValue, plural, same, type Doc } from './model';
import { keysIn, subsectionTemplate } from './templates';
import { Sentence, Token, sentenceCls } from './sentence';
import { FieldEditor } from './editors';
import { Badge, Tip, btn } from './ui';

export function SubsectionBlock({ doc, sub, headingLevel = 3 }: { doc: Doc; sub: Subsection; headingLevel?: 2 | 3 }) {
  const book = useBook();
  const { t, locale, advanced } = book;
  const get = (k: string) => book.get(doc.key, k);
  const H = headingLevel === 2 ? 'h2' : 'h3';

  if (!book.canSeeSubsection(doc.key, sub.id)) {
    return (
      <section aria-labelledby={`h-${doc.key}-${sub.id}`}>
        <H id={`h-${doc.key}-${sub.id}`} className="text-18 font-extrabold">
          {sub.title[locale]}
        </H>
        <p className="mt-2 flex items-start gap-2 text-14 text-muted-foreground">
          <Lock className="mt-1 size-4 shrink-0" aria-hidden />
          {t.ui.hiddenSub}
        </p>
      </section>
    );
  }

  const tpl = subsectionTemplate(t, locale, doc.key, sub.id, get);
  const used = new Set(tpl?.lines.flatMap(keysIn) ?? []);
  const rest = sub.fields.filter((f) => !used.has(f.key) && !f.advanced);
  const adv = sub.fields.filter((f) => !used.has(f.key) && f.advanced);
  const resettable = sub.fields.filter((f) => !f.readOnly && !f.structured && !same(get(f.key), f.default));
  const isPrefs = doc.scope === 'prefs';

  return (
    <section aria-labelledby={`h-${doc.key}-${sub.id}`} className="scroll-mt-28">
      {isPrefs ? null : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <H id={`h-${doc.key}-${sub.id}`} className="text-18 font-extrabold leading-snug">
            {sub.title[locale]}
          </H>
          {resettable.length ? (
            <button type="button" className={cn(btn('quiet', 'sm'), '-me-2')} onClick={() => book.resetFields(doc.key, resettable.map((f) => f.key))}>
              <RotateCcw className="size-3.5" aria-hidden />
              {t.ui.resetSection}
              <span className="text-muted-foreground">({plural(resettable.length, 'valueNom', locale, t)})</span>
            </button>
          ) : null}
        </div>
      )}
      {isPrefs ? null : <p className="mt-1 max-w-[62ch] text-14 leading-relaxed text-muted-foreground">{sub.description[locale]}</p>}

      {advanced && !isPrefs ? (
        <AdvancedRows doc={doc} fields={sub.fields} />
      ) : (
        <>
          {tpl ? (
            tpl.list ? (
              <ul className="mt-4 grid list-disc gap-2 ps-5 marker:text-muted-foreground">
                {tpl.lines.map((line, i) => (
                  <li key={i} className={sentenceCls(locale)}>
                    <Sentence docKey={doc.key} line={line} mode="edit" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn('mt-4', sentenceCls(locale))}>
                {tpl.lines.map((line, i) => (
                  <Sentence key={i} docKey={doc.key} line={line} mode="edit" />
                ))}
              </p>
            )
          ) : null}
          {rest.length ? <DetailsList doc={doc} fields={rest} titled={!!tpl} /> : null}
          {adv.length ? <AdvancedFold doc={doc} fields={adv} /> : null}
          {doc.key === 'whatsapp_provider' && sub.id === 'test' ? <WhatsAppTest /> : null}
        </>
      )}
    </section>
  );
}

function DetailsList({ doc, fields, titled }: { doc: Doc; fields: Field[]; titled: boolean }) {
  const { t, locale } = useBook();
  return (
    <div className="mt-5">
      {titled ? <p className="mb-2 text-13 font-bold text-muted-foreground">{t.ui.details}</p> : null}
      <dl className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-card">
        {fields.map((f) => (
          <div key={f.key} className="grid min-h-12 gap-1 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)] sm:items-center sm:gap-6">
            <dt className="text-14 text-muted-foreground">
              <Tip content={<span className="leading-relaxed">{f.help[locale]}</span>}>
                <span tabIndex={0} className="cursor-help rounded underline decoration-border decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {cleanLabel(f.label[locale])}
                </span>
              </Tip>
            </dt>
            <dd className="min-w-0 text-15 leading-[2.1] sm:text-end">
              <Token docKey={doc.key} fieldKey={f.key} mode="edit" />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AdvancedFold({ doc, fields }: { doc: Doc; fields: Field[] }) {
  const { t, focus } = useBook();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (focus && focus.docKey === doc.key && fields.some((f) => f.key === focus.fieldKey)) setOpen(true);
  }, [focus, doc.key, fields]);
  return (
    <div className="mt-4">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cn(btn('quiet', 'sm'), '-ms-2')}>
        <ChevronDown className={cn('size-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
        {fill(t.ui.advancedFold, { n: fields.length })}
      </button>
      {open ? <DetailsList doc={doc} fields={fields} titled={false} /> : null}
    </div>
  );
}

/** The advanced view: every field as a classic row (label, help, default, key on the start side; the control on the end side). */
function AdvancedRows({ doc, fields }: { doc: Doc; fields: Field[] }) {
  return (
    <div className="mt-4 divide-y divide-border/70 border-y border-border/70">
      {fields.map((f) => (
        <AdvancedRow key={f.key} doc={doc} field={f} />
      ))}
    </div>
  );
}

function AdvancedRow({ doc, field }: { doc: Doc; field: Field }) {
  const book = useBook();
  const { t, locale } = book;
  const value = book.get(doc.key, field.key);
  const dirty = book.isDirty(doc.key, field.key);
  const offDefault = !same(value, field.default);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [pulse, setPulse] = useState(false);
  const focused = book.focus?.docKey === doc.key && book.focus.fieldKey === field.key;
  useEffect(() => {
    if (!focused) return;
    ref.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    setPulse(true);
    const id = window.setTimeout(() => setPulse(false), 2800);
    return () => window.clearTimeout(id);
  }, [focused, book.focus?.nonce, reduce]);
  const labelId = `lbl-${doc.key}-${field.key}`.replace(/[^\w-]/g, '_');
  return (
    <div
      ref={ref}
      className={cn(
        'grid gap-3 rounded-xl py-4 transition-colors duration-700 motion-reduce:transition-none sm:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] sm:gap-8',
        pulse && 'bg-primary/8',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span id={labelId} className="text-15 font-bold">
            {cleanLabel(field.label[locale])}
          </span>
          {offDefault ? <span aria-hidden className="size-1.5 rounded-full bg-primary" /> : null}
          {offDefault ? <span className="sr-only">{t.ui.changedFromDefault}</span> : null}
          {dirty ? <Badge tone="warning">{t.ui.unsaved}</Badge> : null}
          {field.proposed ? (
            <Tip content={fill(t.ui.proposedTip, { id: field.proposalId ?? '—', p: field.priority ?? '—' }) + (field.needsBackend ? ` ${t.ui.needsBackend}` : '')}>
              <span tabIndex={0} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Badge tone="violet">{t.ui.proposed}</Badge>
              </span>
            </Tip>
          ) : null}
          {field.deprecated ? <Badge>{t.ui.deprecated}</Badge> : null}
          {field.advanced ? <Badge>{t.ui.advanced}</Badge> : null}
          {field.readOnly ? <Badge>{t.ui.readOnly}</Badge> : null}
          {field.risk === 'high' ? <Badge tone="danger">{t.ui.riskBadge}</Badge> : null}
          {field.control === 'security' ? <Badge tone="info">{t.ui.securityBadge}</Badge> : null}
          {field.control === 'money' ? <Badge tone="warning">{t.ui.moneyBadge}</Badge> : null}
        </div>
        <p className="mt-1 text-13 leading-relaxed text-muted-foreground">{field.help[locale]}</p>
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-12 text-muted-foreground">
          <span>
            {t.ui.default}: <b className="font-semibold text-foreground">{formatValue(field, field.default, locale, t)}</b>
          </span>
          <code dir="ltr" className="text-12">
            {field.key}
          </code>
        </p>
      </div>
      <div className="grid content-start gap-2">
        <FieldEditor docKey={doc.key} field={field} labelledBy={labelId} />
        {offDefault && !field.readOnly && !field.structured ? (
          <button type="button" className={cn(btn('quiet', 'sm'), 'justify-self-start')} onClick={() => book.resetFields(doc.key, [field.key])}>
            <RotateCcw className="size-3.5" aria-hidden />
            {t.ui.resetField}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** WhatsApp provider: the test message is an action, not a saved setting. */
function WhatsAppTest() {
  const book = useBook();
  const { t } = book;
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'missing'>('idle');
  const phone = book.get('whatsapp_provider', 'test.phone');
  const send = () => {
    if (!phone) {
      setState('missing');
      return;
    }
    setState('sending');
    window.setTimeout(() => setState('sent'), 900);
  };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" className={btn('outline')} onClick={send} disabled={state === 'sending'}>
        <Send className="size-4" aria-hidden />
        {state === 'sending' ? t.ui.waSending : t.ui.waSend}
      </button>
      <p role="status" className={cn('text-13', state === 'missing' ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
        {state === 'sent' ? fill(t.ui.waSent, { phone: String(phone) }) : state === 'missing' ? t.ui.waNeedPhone : t.ui.waNote}
      </p>
    </div>
  );
}

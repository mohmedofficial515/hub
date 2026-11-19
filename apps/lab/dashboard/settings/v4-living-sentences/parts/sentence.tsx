/**
 * Living sentences: a template line becomes text plus value tokens. A token is the field's live value in words; pressing it opens
 * a small editor (popover), hovering it shows the field's label, help and default. Tokens mark "changed from default" with a dot
 * and an unsaved draft with a highlighter tint (never a stripe).
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FieldValue } from '@lab/mocks/settings';
import { motion, useReducedMotion } from 'framer-motion';
import { Link2, Lock, RotateCcw } from 'lucide-react';
import { cn } from '@lab/utils';
import { useBook, writeHash } from './store';
import { cleanLabel, docTitle, fieldOf, fill, formatValue, isLtrValue, num, same, type NounKey } from './model';
import { computed, parse, tokenText, type Get } from './templates';
import { FieldEditor } from './editors';
import { Badge, PopClose, PopContent, PopRoot, PopTrigger, TipContent, TipRoot, TipTrigger, btn } from './ui';

/** Arabic one-letter prefixes (و، بـ، لـ، ف) and closing punctuation stay on the token's line. */
const LEAD = /(و|بـ|لـ|ف)$/;
const TRAIL = /^[،.,:;؛)]+/;

export type TokenMode = 'edit' | 'link' | 'static';

export function Token({
  docKey,
  fieldKey,
  noun,
  words,
  mode,
  get,
  mark,
  tight,
  tightEnd,
}: {
  docKey: string;
  fieldKey: string;
  noun?: NounKey;
  words?: [string, string];
  mode: TokenMode;
  get?: Get;
  mark?: 'before' | 'after' | null;
  tight?: boolean;
  tightEnd?: boolean;
}) {
  const book = useBook();
  const { t, locale } = book;
  const field = fieldOf(docKey, fieldKey);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const titleId = useId();
  const focused = mode === 'edit' && book.focus?.docKey === docKey && book.focus.fieldKey === fieldKey;

  useEffect(() => {
    if (!focused) return;
    const el = ref.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }));
    setPulse(true);
    const id = window.setTimeout(() => setPulse(false), 2800);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(id);
    };
  }, [focused, book.focus?.nonce, reduce]);

  if (!field) return <span>{`{${fieldKey}}`}</span>;

  const value = get ? get(fieldKey) : book.get(docKey, fieldKey);
  const text = tokenText(docKey, fieldKey, value, { noun, words }, locale, t);
  const dirty = !get && book.isDirty(docKey, fieldKey);
  const offDefault = !same(value, field.default);
  const ltr = isLtrValue(field) && !words;
  const label = cleanLabel(field.label[locale]);
  const inner = (
    <motion.span key={text} initial={reduce || mode === 'static' ? false : { opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="inline">
      <bdi dir={ltr ? 'ltr' : undefined}>{text}</bdi>
    </motion.span>
  );

  if (mode === 'static') {
    if (mark === 'after')
      return (
        <ins className="ms-0.5 rounded-md bg-warning/35 px-1 font-bold text-foreground no-underline box-decoration-clone dark:bg-warning/25">
          <bdi dir={ltr ? 'ltr' : undefined}>{text}</bdi>
        </ins>
      );
    if (mark === 'before')
      return (
        <del className="ms-0.5 font-bold text-muted-foreground decoration-destructive/70 decoration-2">
          <bdi dir={ltr ? 'ltr' : undefined}>{text}</bdi>
        </del>
      );
    return (
      <b className="font-bold">
        <bdi dir={ltr ? 'ltr' : undefined}>{text}</bdi>
      </b>
    );
  }

  const chip = cn(
    'relative whitespace-normal rounded-lg px-1.5 py-0.5 text-start font-bold box-decoration-clone outline-none transition-[background-color,box-shadow] duration-500 motion-reduce:transition-none',
    // 44px tall on touch widths (inline targets are exempt from 2.5.8, the project still asks for 44px)
    'max-lg:min-h-11 max-lg:px-2 max-lg:py-2 max-lg:leading-7',
    // quiet field-name caption on hover / keyboard focus; pseudo content stays out of the copy text
    'after:pointer-events-none after:absolute after:bottom-full after:start-0 after:z-10 after:mb-1 after:hidden after:max-w-[16rem] after:truncate after:rounded-md after:bg-foreground after:px-2 after:py-0.5 after:text-12 after:font-semibold after:leading-5 after:text-background after:content-[attr(data-caption)] lg:hover:after:block lg:focus-visible:after:block',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    tight ? 'ms-0' : 'ms-0.5',
    tightEnd ? 'me-0' : 'me-0.5',
    dirty
      ? 'bg-warning/40 text-foreground hover:bg-warning/50 dark:bg-warning/25 dark:hover:bg-warning/35'
      : field.readOnly
        ? 'bg-muted text-foreground'
        : 'bg-primary/10 text-[color-mix(in_oklab,var(--primary),black_25%)] hover:bg-primary/18 dark:bg-primary/15 dark:text-primary dark:hover:bg-primary/25',
    field.proposed && 'border border-dashed border-accent-violet/70',
    field.deprecated && 'line-through decoration-1',
    pulse && 'ring-4 ring-primary/35',
  );
  const dot = offDefault && field.type !== 'secret' ? (
    <span aria-hidden className={cn('ms-1 inline-block size-1.5 -translate-y-[0.35em] rounded-full align-middle', dirty ? 'bg-warning-strong' : 'bg-primary')} />
  ) : null;
  const srState = [dirty ? t.ui.unsaved : null, offDefault ? t.ui.changedFromDefault : null, field.proposed ? t.ui.proposed : null, field.deprecated ? t.ui.deprecated : null]
    .filter(Boolean)
    .join(locale === 'ar' ? '، ' : ', ');
  const sep = locale === 'ar' ? '، ' : ', ';
  const tip = <TokenTip docKey={docKey} fieldKey={fieldKey} mode={mode} />;
  const after = (
    <>
      {field.proposed ? (
        <span
          aria-hidden
          data-badge={t.ui.proposed}
          className="ms-1.5 me-1 inline-block select-none rounded-full bg-accent-violet/15 px-2 align-middle text-12 font-bold leading-5 text-accent-violet-on-soft before:content-[attr(data-badge)]"
        />
      ) : null}
      {field.deprecated ? (
        <span
          aria-hidden
          data-badge={t.ui.deprecated}
          className="ms-1.5 me-1 inline-block select-none rounded-full bg-muted px-2 align-middle text-12 font-bold leading-5 text-muted-foreground before:content-[attr(data-badge)]"
        />
      ) : null}
    </>
  );

  if (mode === 'link') {
    return (
      <>
        <TipRoot>
          <TipTrigger asChild>
            <button
              ref={ref}
              type="button"
              className={chip}
              data-caption={label}
              aria-label={`${text}${sep}${label}${srState ? sep + srState : ''}`}
              onClick={() => book.go({ view: 'group', key: docKey }, { docKey, fieldKey })}
            >
              {inner}
              {dot}
            </button>
          </TipTrigger>
          <TipContent>{tip}</TipContent>
        </TipRoot>
        {after}
      </>
    );
  }

  if (field.readOnly) {
    return (
      <>
        <TipRoot>
          <TipTrigger asChild>
            <span tabIndex={0} className={cn(chip, 'cursor-default')} aria-label={`${text}${sep}${label}${sep}${t.ui.readOnly}`}>
              <Lock className="me-1 inline size-3 -translate-y-px opacity-60" aria-hidden />
              {inner}
            </span>
          </TipTrigger>
          <TipContent>{tip}</TipContent>
        </TipRoot>
        {after}
      </>
    );
  }

  return (
    <>
      <PopRoot open={open} onOpenChange={setOpen}>
        <TipRoot open={open ? false : undefined}>
          <TipTrigger asChild>
            <PopTrigger asChild>
              <button
                ref={ref}
                type="button"
                data-field={`${docKey}.${fieldKey}`}
                className={chip}
                data-caption={label}
                aria-haspopup="dialog"
                aria-label={`${text}${sep}${label}${srState ? sep + srState : ''}`}
              >
                {inner}
                {dot}
              </button>
            </PopTrigger>
          </TipTrigger>
          <TipContent>{tip}</TipContent>
        </TipRoot>
        <PopContent side="bottom" align="start" collisionPadding={{ top: 96, bottom: 16, left: 16, right: 16 }} aria-labelledby={titleId} onOpenAutoFocus={(e) => e.preventDefault()}>
          <TokenEditor docKey={docKey} fieldKey={fieldKey} words={field.type === 'boolean' ? words : undefined} titleId={titleId} />
        </PopContent>
      </PopRoot>
      {after}
    </>
  );
}

/** Hover card of a token: label, help, default (and the proposal / control facts). */
function TokenTip({ docKey, fieldKey, mode }: { docKey: string; fieldKey: string; mode: TokenMode }) {
  const { t, locale } = useBook();
  const field = fieldOf(docKey, fieldKey)!;
  return (
    <span className="grid gap-1">
      <span className="text-13 font-bold">{cleanLabel(field.label[locale])}</span>
      <span className="line-clamp-3 text-muted-foreground">{field.help[locale]}</span>
      <span>
        {t.ui.default}: <b className="font-semibold">{formatValue(field, field.default, locale, t)}</b>
      </span>
      {field.proposed ? (
        <span className="text-accent-violet-on-soft">{fill(t.ui.proposedTip, { id: field.proposalId ?? '—', p: field.priority ?? '—' })}</span>
      ) : null}
      {field.readOnly ? <span>{t.ui.readOnlyTip}</span> : null}
      {field.readOnly && mode !== 'link' ? null : (
        <span className="text-12 text-muted-foreground">{mode === 'link' ? fill(t.ui.linkTo, { name: docTitle(docKey, locale) }) : t.ui.pressToEdit}</span>
      )}
    </span>
  );
}

/** Popover body: label, help, the control, default + reset, range, technical key + copy link, control facts. */
export function TokenEditor({ docKey, fieldKey, words, titleId }: { docKey: string; fieldKey: string; words?: [string, string]; titleId: string }) {
  const book = useBook();
  const { t, locale } = book;
  const field = fieldOf(docKey, fieldKey)!;
  const value = book.get(docKey, fieldKey);
  const offDefault = !same(value, field.default);
  const facts: ReactNode[] = [];
  if (field.risk === 'high') facts.push(t.ui.riskHigh);
  if (field.control === 'security') facts.push(t.ui.controlSecurity);
  if (field.control === 'money') facts.push(t.ui.controlMoney);
  if (field.twoPerson) facts.push(t.ui.twoPerson);
  if (field.storedIn) facts.push(fill(t.ui.storedIn, { g: field.storedIn }));
  if (field.templateKey) facts.push(fill(t.ui.templateKey, { k: field.templateKey }));
  if (field.proposed) facts.push(fill(t.ui.proposedTip, { id: field.proposalId ?? '—', p: field.priority ?? '—' }) + (field.needsBackend ? ` ${t.ui.needsBackend}` : ''));
  if (field.deprecated) facts.push(t.ui.deprecatedTip);
  const copy = () => {
    writeHash({ g: docKey.startsWith('prefs:') ? null : docKey, f: fieldKey, view: docKey.startsWith('prefs:') ? 'prefs' : null });
    void navigator.clipboard?.writeText(location.href).catch(() => undefined);
    book.notify(t.ui.copied);
  };
  return (
    <div className="grid gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <p id={titleId} className="text-15 font-extrabold leading-snug">
            {cleanLabel(field.label[locale])}
          </p>
          {field.proposed ? <Badge tone="violet">{t.ui.proposed}</Badge> : null}
          {field.deprecated ? <Badge>{t.ui.deprecated}</Badge> : null}
          {field.risk === 'high' ? <Badge tone="danger">{t.ui.riskBadge}</Badge> : null}
          {field.control === 'security' ? <Badge tone="info">{t.ui.securityBadge}</Badge> : null}
          {field.control === 'money' ? <Badge tone="warning">{t.ui.moneyBadge}</Badge> : null}
        </div>
        <p className="mt-1 text-13 leading-relaxed text-muted-foreground">{field.help[locale]}</p>
        {field.note ? <p className="mt-1 text-12 leading-relaxed">{field.note[locale]}</p> : null}
      </div>
      <FieldEditor docKey={docKey} field={field} boolWords={words} labelledBy={titleId} />
      <div className="grid gap-2 border-t border-border pt-3 text-13 text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {t.ui.default}: <b className="font-semibold text-foreground">{formatValue(field, field.default, locale, t)}</b>
          </span>
          {offDefault && !field.readOnly && !field.structured ? (
            <button type="button" className={cn(btn('outline', 'sm'), 'px-3')} onClick={() => book.resetFields(docKey, [fieldKey])}>
              <RotateCcw className="size-3.5" aria-hidden />
              {t.ui.resetField}
            </button>
          ) : (
            <span>{t.ui.isDefault}</span>
          )}
        </div>
        {facts.map((f, i) => (
          <p key={i} className="leading-relaxed">
            {f}
          </p>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 truncate">
            {t.ui.technicalKey}:{' '}
            <code dir="ltr" className="rounded bg-muted px-1 text-12 text-foreground">
              {docKey}.{fieldKey}
            </code>
          </span>
          <button type="button" className={cn(btn('quiet', 'sm'), 'px-2')} onClick={copy}>
            <Link2 className="size-3.5" aria-hidden />
            {t.ui.copyLink}
          </button>
        </div>
      </div>
      <div className="flex justify-end">
        <PopClose asChild>
          <button type="button" className={cn(btn('primary'), 'min-w-24')}>
            {t.ui.done}
          </button>
        </PopClose>
      </div>
    </div>
  );
}

/**
 * One (expanded) template line rendered with tokens. A one-letter Arabic prefix before a token and the punctuation after it are
 * bound to the token with a no-break wrapper, so «و»، «،» and «.» never sit alone on a line. `get` + `changed` render a frozen review copy.
 */
export function Sentence({
  docKey,
  line,
  mode,
  get,
  changed,
  side,
}: {
  docKey: string;
  line: string;
  mode: TokenMode;
  get?: Get;
  changed?: Set<string>;
  side?: 'before' | 'after';
}) {
  const book = useBook();
  const parts = useMemo(() => parse(line), [line]);
  const getter: Get = get ?? ((k) => book.get(docKey, k));
  // texts are trimmed of the lead / trail they hand to a neighbouring token
  const texts = parts.map((p) => (p.k === 'text' ? p.s : ''));
  const leads: string[] = parts.map(() => '');
  const trails: string[] = parts.map(() => '');
  parts.forEach((p, i) => {
    if (p.k !== 'field' || !fieldOf(docKey, p.key)) return;
    const prev = parts[i - 1];
    if (prev?.k === 'text' && !prev.bold) {
      const m = texts[i - 1].match(LEAD);
      if (m) {
        leads[i] = m[1];
        texts[i - 1] = texts[i - 1].slice(0, -m[1].length);
      }
    }
    const next = parts[i + 1];
    if (next?.k === 'text' && !next.bold) {
      const m = texts[i + 1].match(TRAIL);
      if (m) {
        trails[i] = m[0];
        texts[i + 1] = texts[i + 1].slice(m[0].length);
      }
    }
  });
  return (
    <>
      {parts.map((p, i) => {
        if (p.k === 'text') {
          if (!texts[i]) return null;
          return p.bold ? (
            <b key={i} className="font-extrabold">
              {texts[i]}
            </b>
          ) : (
            <span key={i}>{texts[i]}</span>
          );
        }
        if (p.k === 'calc')
          return (
            <b key={i} className="font-bold">
              {computed(p.name, docKey, getter, book.locale, book.t)}
            </b>
          );
        if (!fieldOf(docKey, p.key)) return <span key={i}>{p.key}</span>;
        const token = (
          <Token
            docKey={docKey}
            fieldKey={p.key}
            noun={p.noun}
            words={p.words}
            mode={mode}
            get={get}
            tight={!!leads[i]}
            tightEnd={!!trails[i]}
            mark={changed ? (changed.has(p.key) ? side : null) : undefined}
          />
        );
        if (!leads[i] && !trails[i]) return <span key={i}>{token}</span>;
        return (
          <span key={i} className="whitespace-nowrap">
            {leads[i]}
            {token}
            {trails[i]}
          </span>
        );
      })}
    </>
  );
}

export function sentenceCls(locale: 'ar' | 'en', size: 'lg' | 'md' = 'lg') {
  return cn(
    'text-pretty text-foreground',
    size === 'lg'
      ? locale === 'ar'
        ? 'text-17 leading-[2.75] lg:text-18 lg:leading-[2.3]'
        : 'text-17 leading-[2.6] lg:text-18 lg:leading-[2.1]'
      : locale === 'ar'
        ? 'text-15 leading-[2.9] lg:text-16 lg:leading-[2.2]'
        : 'text-15 leading-[2.8] lg:text-16 lg:leading-[2]',
  );
}

export const numText = num;

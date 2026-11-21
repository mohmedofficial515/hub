/**
 * Review before Save as before / after sentences (old struck, new highlighted), confirmations in proportion to risk, and the
 * history as a sentence timeline with forward-only restore.
 */
import { useId, useState } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';
import { cn } from '@lab/utils';
import { useBook } from './store';
import { cleanLabel, docOf, fieldOf, fill, formatValue, relative } from './model';
import { keysIn, subsectionTemplate, type Get } from './templates';
import { Sentence, sentenceCls } from './sentence';
import { inputCls } from './editors';
import { Badge, Sheet, btn } from './ui';

export function ReviewSheet() {
  const book = useBook();
  const docKey = book.reviewOf;
  return (
    <Sheet
      open={!!docKey}
      onOpenChange={(o) => !o && book.openReview(null)}
      title={book.t.ui.reviewTitle}
      description={docKey ? `«${docOf(docKey)?.title[book.locale]}». ${book.t.ui.reviewLede}` : ''}
      closeLabel={book.t.ui.backToEdit}
      wide
    >
      {docKey ? <ReviewBody docKey={docKey} /> : null}
    </Sheet>
  );
}

function ReviewBody({ docKey }: { docKey: string }) {
  const book = useBook();
  const { t, locale } = book;
  const doc = docOf(docKey)!;
  const group = doc.group;
  const draft = book.draftOf(docKey);
  const changed = new Set(Object.keys(draft));
  const before: Get = (k) => book.savedValue(docKey, k);
  const after: Get = (k) => book.get(docKey, k);
  const fields = [...changed].map((k) => fieldOf(docKey, k)).filter((f): f is NonNullable<typeof f> => !!f);
  const high = fields.some((f) => f.risk === 'high');
  const security = fields.some((f) => f.control === 'security');
  const money = fields.some((f) => f.control === 'money');
  const approval = group?.approval === 'second-approver';
  const word = doc.title[locale];
  const [typed, setTyped] = useState('');
  const [ack, setAck] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState(false);
  const typedId = useId();
  const restoring = book.restoring(docKey);
  const next = book.version(docKey) + 1;
  const okTyped = [doc.title.ar, doc.title.en, docKey].some((w) => w.trim().toLowerCase() === typed.trim().toLowerCase());
  const ready = (!high || okTyped) && (high || !security || ack);

  const submit = () => {
    if (!ready) {
      setError(true);
      document.getElementById(typedId)?.focus();
      return;
    }
    if (approval) {
      book.submitForApproval(docKey, note);
      book.notify(t.ui.sent);
    } else {
      const v = book.commit(docKey, note);
      book.notify(fill(t.ui.saved, { group: word, v }));
    }
    book.openReview(null);
  };

  const blocks = doc.subsections
    .filter((s) => s.fields.some((f) => changed.has(f.key)))
    .map((s) => {
      const tb = subsectionTemplate(t, locale, docKey, s.id, before);
      const ta = subsectionTemplate(t, locale, docKey, s.id, after);
      const inSentence = new Set([...(tb?.lines ?? []), ...(ta?.lines ?? [])].flatMap(keysIn));
      const pairs: { b?: string; a?: string }[] = [];
      if (tb && ta) {
        if (tb.list && ta.list) {
          tb.lines.forEach((line, i) => {
            if (keysIn(line).some((k) => changed.has(k))) pairs.push({ b: line, a: ta.lines[i] });
          });
        } else if ([...inSentence].some((k) => changed.has(k))) pairs.push({ b: tb.lines.join(' '), a: ta.lines.join(' ') });
      }
      const loose = s.fields.filter((f) => changed.has(f.key) && !inSentence.has(f.key));
      return { s, pairs, loose };
    });

  return (
    <div className="grid gap-7">
      {restoring ? <p className="rounded-2xl bg-muted p-4 text-14 leading-relaxed">{fill(t.ui.restoreNote, { from: restoring, to: next })}</p> : null}
      {blocks.map(({ s, pairs, loose }) => (
        <section key={s.id} aria-label={s.title[locale]}>
          <h3 className="text-16 font-extrabold">{s.title[locale]}</h3>
          {pairs.map((p, i) => (
            <div key={i} className="mt-3 grid gap-2">
              <p className="text-12 font-bold text-muted-foreground">{t.ui.before}</p>
              <p className={cn(sentenceCls(locale, 'md'), 'text-muted-foreground')}>
                <Sentence docKey={docKey} line={p.b ?? ''} mode="static" get={before} changed={changed} side="before" />
              </p>
              <p className="mt-1 text-12 font-bold text-muted-foreground">{t.ui.after}</p>
              <p className={sentenceCls(locale, 'md')}>
                <Sentence docKey={docKey} line={p.a ?? ''} mode="static" get={after} changed={changed} side="after" />
              </p>
            </div>
          ))}
          {loose.length ? (
            <ul className="mt-3 grid gap-1.5 text-15 leading-relaxed">
              {loose.map((f) => (
                <li key={f.key}>
                  {fill(t.ui.changeLine, { label: cleanLabel(f.label[locale]), from: formatValue(f, before(f.key), locale, t), to: formatValue(f, after(f.key), locale, t) })}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.fields
              .filter((f) => changed.has(f.key))
              .flatMap((f) => [
                f.risk === 'high' ? <Badge key={f.key + 'r'} tone="danger">{cleanLabel(f.label[locale])}: {t.ui.riskBadge}</Badge> : null,
                f.control === 'security' ? <Badge key={f.key + 's'} tone="info">{t.ui.securityBadge}</Badge> : null,
                f.control === 'money' ? <Badge key={f.key + 'm'} tone="warning">{t.ui.moneyBadge}</Badge> : null,
              ])}
          </div>
        </section>
      ))}

      {approval ? (
        <p className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-14 leading-relaxed">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          {t.ui.approvalNote}
        </p>
      ) : null}
      {money && !approval ? <p className="text-13 text-muted-foreground">{t.ui.controlMoney}</p> : null}

      {high ? (
        <div className="grid gap-2">
          <label htmlFor={typedId} className="text-14 font-bold">
            {fill(t.ui.typeConfirm, { word })}
          </label>
          <input
            id={typedId}
            className={cn(inputCls, error && !okTyped && 'border-destructive')}
            value={typed}
            autoComplete="off"
            aria-invalid={error && !okTyped ? true : undefined}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={word}
          />
        </div>
      ) : security ? (
        <label className={cn('flex min-h-11 items-center gap-3 text-14 font-semibold', error && !ack && 'text-destructive')}>
          <input id={typedId} type="checkbox" className="size-5 accent-[var(--primary)]" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          {t.ui.securityConfirm}
        </label>
      ) : null}

      <div className="grid gap-1.5">
        <label htmlFor={`${typedId}-r`} className="text-14 font-bold">
          {t.ui.reason}
        </label>
        <textarea id={`${typedId}-r`} rows={2} maxLength={500} className={cn(inputCls, 'py-2.5')} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-12 text-muted-foreground">{fill(t.ui.reasonHelp, { n: note.length })}</p>
      </div>
      {error && !ready ? (
        <p role="alert" className="text-13 font-semibold text-destructive">
          {high ? fill(t.ui.typeConfirm, { word }) : t.ui.securityConfirm}
        </p>
      ) : null}
      <div className="sticky -bottom-5 -mx-5 flex flex-wrap justify-end gap-2 border-t border-border bg-background px-5 py-4 sm:-mx-7 sm:px-7">
        <button type="button" className={btn('outline')} onClick={() => book.openReview(null)}>
          {t.ui.backToEdit}
        </button>
        <button type="button" className={btn('primary')} onClick={submit}>
          {approval ? t.ui.sendApproval : fill(t.ui.saveAs, { v: next })}
        </button>
      </div>
    </div>
  );
}

export function HistorySheet() {
  const book = useBook();
  const { t, locale } = book;
  const docKey = book.historyOf;
  const doc = docKey ? docOf(docKey) : null;
  const entries = docKey ? book.history(docKey) : [];
  const current = docKey ? book.version(docKey) : 0;
  return (
    <Sheet
      open={!!docKey}
      onOpenChange={(o) => !o && book.openHistory(null)}
      title={doc ? fill(t.ui.historyTitle, { group: doc.title[locale] }) : ''}
      description={t.ui.historyLede}
      closeLabel={t.ui.back}
    >
      {docKey && !entries.length ? <p className="text-15 leading-relaxed text-muted-foreground">{fill(t.ui.historyEmpty, { v: current })}</p> : null}
      <ol className="grid gap-7">
        {entries.map((e, i) => (
          <li key={e.version} className="relative ps-8">
            <span className={cn('absolute start-0 top-1.5 size-3 rounded-full', i === 0 ? 'bg-primary' : 'bg-muted-foreground/40')} aria-hidden />
            {i < entries.length - 1 ? <span className="absolute -bottom-7 start-[5px] top-5 w-px bg-border" aria-hidden /> : null}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-16 font-extrabold">{fill(t.ui.versionN, { v: e.version })}</h3>
              {e.version === current ? <Badge tone="success">{t.ui.current}</Badge> : null}
            </div>
            <p className="text-13 text-muted-foreground">
              <bdi>{fill(t.ui.entryBy, { by: e.by, when: relative(e.at, locale) })}</bdi>
            </p>
            {e.note ? <p className="mt-2 text-15 leading-relaxed">«{e.note[locale]}»</p> : null}
            <ul className="mt-2 grid gap-1 text-14 leading-relaxed text-foreground">
              {e.changes.map((c) => {
                const f = fieldOf(docKey!, c.field);
                return (
                  <li key={c.field}>
                    {fill(t.ui.historyChange, {
                      label: f ? cleanLabel(f.label[locale]) : c.field,
                      to: f ? formatValue(f, c.to, locale, t) : String(c.to),
                      from: f ? formatValue(f, c.from, locale, t) : String(c.from),
                    })}
                  </li>
                );
              })}
            </ul>
            {e.requestId ? <p className="mt-1 text-12 text-muted-foreground">{fill(t.ui.viaRequest, { id: e.requestId, by: e.approvedBy ?? '' })}</p> : null}
            {e.version !== current ? (
              <button
                type="button"
                className={cn(btn('outline', 'sm'), 'mt-3')}
                onClick={() => {
                  if (!book.stageRestore(docKey!, e.version)) {
                    book.notify(t.ui.restoreSame);
                    return;
                  }
                  book.openHistory(null);
                  book.notify(fill(t.ui.restoreStaged, { v: e.version }));
                }}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                {t.ui.restore}
                <span className="font-normal text-muted-foreground">({fill(t.ui.restoreHint, { v: current + 1 })})</span>
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

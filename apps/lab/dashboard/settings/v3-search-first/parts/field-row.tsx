// One field on the group page (and on the preferences page): label, markers, help, the control sized to its type,
// reset to default, unsaved before → after with undo, and a menu (pin, copy link, copy key). A deep-linked field is
// scrolled to, focused and briefly lit (tinted background + ring, no stripe).

import { useEffect, useRef, useState } from 'react';
import { Copy, Link2, MoreHorizontal, RotateCcw, Star, Undo2 } from 'lucide-react';
import type { Field, FieldValue } from '@lab/mocks/settings';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { ChangedMark, FieldBadges, UnsavedMark } from './badges';
import { FieldControl, useFieldIds } from './controls';
import { formatValue, loc, validate } from './format';
import { same } from './model';
import { fieldLink, type Route } from './route';
import { useStore } from './store';
import { Btn, Highlight, Menu } from './ui';

export function FieldRow({
  field,
  value,
  saved,
  onChange,
  pinId,
  route,
  highlight,
  tokens,
  instant,
  canSeeSecrets,
}: {
  field: Field;
  value: FieldValue;
  saved: FieldValue;
  onChange: (v: FieldValue) => void;
  pinId: string;
  route: Route;
  highlight: boolean;
  tokens: string[];
  instant?: boolean;
  canSeeSecrets: boolean;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();
  const ids = useFieldIds('f');
  const ref = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(false);
  const label = loc(field.label, locale);
  const dirty = !instant && !same(value, saved);
  const changed = !same(value, field.default);
  const error = dirty ? validate(field, value, t, locale) : null;
  const pinned = store.pinned.includes(pinId);

  useEffect(() => {
    if (!highlight || !ref.current) return;
    const el = ref.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => {
      el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      el.focus({ preventScroll: true });
      setLit(true);
    }, 60);
    const off = window.setTimeout(() => setLit(false), 2800);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(off);
    };
  }, [highlight]);

  const copy = (text: string, done: string) => {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    store.toast(done, 'info');
  };

  return (
    <div
      ref={ref}
      id={`field-${field.key}`}
      tabIndex={-1}
      aria-label={highlight ? t.row.foundHere(label) : undefined}
      className={cn(
        'grid scroll-mt-[calc(var(--settings-sticky-top,0px)+10rem)] gap-x-8 gap-y-3 px-4 py-4 outline-none transition-[background-color,box-shadow] duration-700 motion-reduce:transition-none sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]',
        lit && 'bg-primary/10 shadow-[inset_0_0_0_2px_color-mix(in_oklch,var(--primary)_55%,transparent)] dark:bg-primary/15',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <label htmlFor={ids.control} className="text-15 font-semibold leading-snug">
            <Highlight text={label} tokens={tokens} />
          </label>
          {changed && !dirty && <ChangedMark withText defaultText={formatValue(field, field.default, locale, t)} />}
          {dirty && <UnsavedMark />}
          <FieldBadges field={field} />
        </div>
        <p id={ids.help} className="mt-1 max-w-prose text-13 leading-relaxed text-muted-foreground">
          <Highlight text={loc(field.help, locale)} tokens={tokens} />
        </p>
        {field.note && !field.proposed && !field.deprecated && <p className="mt-1 max-w-prose text-12 leading-relaxed text-muted-foreground">{loc(field.note, locale)}</p>}
        {dirty && (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-12 text-muted-foreground">
            <span>
              {t.row.was} <bdi className="font-semibold text-foreground">{formatValue(field, saved, locale, t)}</bdi>
            </span>
            <button
              type="button"
              onClick={() => onChange(saved)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-1.5 xl:min-h-10 font-semibold text-primary hover:bg-muted dark:text-foreground"
            >
              <Undo2 aria-hidden className="size-3.5" />
              {t.row.undo}
            </button>
          </p>
        )}
        {error && (
          <p id={ids.error} role="alert" className="mt-1.5 text-13 font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-2">
        <FieldControl
          field={field}
          value={value}
          onChange={onChange}
          mode="full"
          label={label}
          id={ids.control}
          describedBy={error ? `${ids.help} ${ids.error}` : ids.help}
          invalid={!!error}
          canSeeSecrets={canSeeSecrets}
          onStructured={() => store.toast(t.toasts.dedicatedEditor(label), 'info')}
        />
        <div className="flex flex-wrap items-center gap-1">
          {changed && !field.readOnly && !field.structured && (
            <Btn variant="quiet" size="sm" onClick={() => onChange(field.default)}>
              <RotateCcw aria-hidden className="size-3.5" />
              {t.row.reset}
              <span className="font-normal text-muted-foreground">
                (<bdi>{formatValue(field, field.default, locale, t, 2)}</bdi>)
              </span>
            </Btn>
          )}
          <Menu
            label={<code dir="ltr" className="text-12">{field.key}</code>}
            trigger={
              <Btn variant="quiet" size="icon" aria-label={t.row.more(label)}>
                <MoreHorizontal aria-hidden className="size-5" />
              </Btn>
            }
            items={[
              { label: pinned ? t.row.unpin : t.row.pin, icon: <Star />, onSelect: () => store.togglePin(pinId) },
              { label: t.row.copyLink, icon: <Link2 />, onSelect: () => copy(fieldLink(route), t.toasts.linkCopied) },
              { label: t.row.copyKey, icon: <Copy />, onSelect: () => copy(field.key, t.toasts.keyCopied) },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

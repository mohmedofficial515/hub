import Handlebars from 'handlebars';

/**
 * Lab copy of the backend e-mail pipeline (`TemplateRenderer` in
 * backend/src/modules/notifications/application/rendering/template-renderer.ts):
 * body template -> `{{{body}}}` of the layout, `{{t 'emails.…'}}` strings, same helpers.
 * Versions therefore hold real `.hbs` files that can move to the backend unchanged.
 *
 * Marked NEW below: helpers / context values the current backend does not have yet; each must be
 * added to `TemplateRenderer` when a version is ported.
 */
export type Dict = Record<string, unknown>;
export type EmailLang = 'ar' | 'en';

export interface EmailSource {
  layout: string;
  body: string;
  subject: string;
  partials: Record<string, string>;
  strings: Dict;
}

const lookup = (dict: Dict, key: string): string => {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return key;
    node = (node as Dict)[part];
  }
  return typeof node === 'string' ? node : key;
};

const asText = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

export function renderEmail(source: EmailSource, lang: EmailLang, payload: Dict) {
  const env = Handlebars.create();
  const rtl = lang === 'ar';

  const translate = (key: string, args: Dict) =>
    lookup(source.strings, key).replace(/\{(\w+)\}/g, (_, name: string) => asText(args[name]));

  env.registerHelper('t', function (key: unknown, options: Handlebars.HelperOptions) {
    const root = (options.data as { root?: Dict }).root ?? {};
    return translate(String(key), { ...root, ...(options.hash as Dict) });
  });
  env.registerHelper('url', (value: unknown) => {
    const raw = asText(value);
    return /^https?:\/\//i.test(raw) ? raw : '';
  });
  env.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  env.registerHelper('default', (value: unknown, fallback: unknown) =>
    value === undefined || value === null || value === '' ? fallback : value,
  );
  env.registerHelper('localTime', (value: unknown) => {
    const m = WALL_CLOCK.exec(asText(value));
    return m ? `${m[1]} ${m[2]}` : '';
  });

  // NEW helper: `{{clock departingAt}}` -> `10:30`, the airport's wall clock.
  env.registerHelper('clock', (value: unknown) => WALL_CLOCK.exec(asText(value))?.[2] ?? '');
  // NEW helper: `{{day departingAt}}` -> `Sat, Dec 5` / `السبت، 5 ديسمبر`, Latin digits, no zone shift.
  env.registerHelper('day', (value: unknown, options: Handlebars.HelperOptions) => {
    const m = WALL_CLOCK.exec(asText(value));
    if (!m) return '';
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      // `year=true` for headlines: a trip can be booked across the new year.
      ...((options.hash as Dict).year ? { year: 'numeric' as const } : {}),
      timeZone: 'UTC',
    }).format(new Date(`${m[1]}T00:00:00Z`));
  });
  // NEW helper: `{{duration 335}}` -> `5h 35m` / `5س 35د`.
  env.registerHelper('duration', (value: unknown) => {
    const total = Number(value);
    if (!Number.isFinite(total) || total <= 0) return '';
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    const [h, m] = rtl ? ['س', 'د'] : ['h', 'm'];
    return [hours ? `${hours}${h}` : '', minutes ? `${minutes}${m}` : ''].filter(Boolean).join(' ');
  });
  // NEW helper: builds a dynamic string key, `{{t (concat 'emails.design.pax_' type)}}`.
  env.registerHelper('concat', (...args: unknown[]) => args.slice(0, -1).map((a) => (typeof a === 'boolean' ? String(a) : asText(a))).join(''));
  // NEW helpers: labels that need more than one string.
  env.registerHelper('stopsLabel', (value: unknown) => {
    const count = Number(value) || 0;
    return count === 0
      ? translate('emails.design.stops_0', {})
      : translate('emails.design.stops_n', { count });
  });
  env.registerHelper('cabinLabel', (cabin: unknown, brand: unknown) => {
    const label = translate(`emails.design.cabin_${asText(cabin)}`, {});
    return asText(brand) ? `${label} (${asText(brand)})` : label;
  });
  // NEW helper: `{{#each (chars pnr)}}` -> one item per character, for split-flap tiles.
  env.registerHelper('chars', (value: unknown) => Array.from(asText(value)));

  for (const [name, raw] of Object.entries(source.partials)) env.registerPartial(name, raw);

  const context: Dict = {
    ...payload,
    lang,
    dir: rtl ? 'rtl' : 'ltr',
    // NEW context: Outlook ignores `text-align:start`, so templates need the physical sides.
    textStart: rtl ? 'right' : 'left',
    textEnd: rtl ? 'left' : 'right',
    year: 2026,
  };
  const render = (raw: string, extra: Dict = {}, noEscape = false) =>
    env.compile(raw, { noEscape })({ ...context, ...extra });

  const subject = render(source.subject, {}, true).trim();
  const body = render(source.body);
  const html = render(source.layout, { subject, body });
  return { subject, html };
}

/** Display helpers. Amounts stay decimal strings; nothing is parsed to a float. */

export function groupDigits(amount: string) {
  const neg = amount.startsWith('-');
  const [int = '0', frac] = amount.replace('-', '').split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '−' : ''}${grouped}${frac !== undefined ? `.${frac}` : ''}`;
}

/** "SAR 2,586.00": the code first in both languages, inside an LTR isolate where it is rendered. */
export function money(amount: string, currency: string) {
  return `${currency} ${groupDigits(amount)}`;
}

export const isZero = (amount: string) => /^-?0+(\.0+)?$/.test(amount);

const intlLocale = (lang: 'ar' | 'en') => (lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB');

/** "Wed 16 Dec" from a local wall-clock ISO string, without time-zone shifts. */
export function shortDate(iso: string, lang: 'ar' | 'en') {
  const [d] = iso.split('T');
  const [y, m, day] = d.split('-').map(Number);
  return new Intl.DateTimeFormat(intlLocale(lang), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, day)));
}

export function longDateTime(iso: string, lang: 'ar' | 'en') {
  const [d, t = '00:00'] = iso.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return new Intl.DateTimeFormat(intlLocale(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, day, hh, mm)));
}

export const clock = (iso: string) => iso.split('T')[1]?.slice(0, 5) ?? '';

export function duration(min: number, lang: 'ar' | 'en') {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return lang === 'ar' ? `${h}س ${m}د` : `${h}h ${m}m`;
}

export function mmss(seconds: number) {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

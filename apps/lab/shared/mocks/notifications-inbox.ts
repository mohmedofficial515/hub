// Customer inbox fixtures shaped like web/src/apiEndpoint/generated/v1/types.gen.ts
// (InboxEntryDto, InboxTripDto). Used by web/notification-tabs versions: the three views
// "all", "unread" and "trips" of the account notifications page.
//
// Text is given per locale so every version shows the same story in Arabic and English.
// `minutesAgo` replaces `createdAt` for display; `createdAt` is derived from a fixed NOW so
// screenshots do not change between runs.

import type { Locale } from '@lab/i18n';

export type InboxView = 'all' | 'unread' | 'trips';
export const INBOX_VIEWS: InboxView[] = ['all', 'unread', 'trips'];

/** Matches notification-links.ts kinds in the real page. */
export type InboxKind = 'bookings' | 'flights' | 'payments' | 'wallet' | 'security' | 'loyalty' | 'support';

export interface InboxEntry {
  id: string;
  type: string;
  kind: InboxKind;
  title: string;
  body: string;
  bookingId: string | null;
  createdAt: string;
  minutesAgo: number;
  readAt: string | null;
  data: Record<string, string>;
}

export interface InboxTrip {
  bookingId: string;
  reference: string;
  route: { from: string; to: string; fromCode: string; toCode: string };
  departs: string; // already formatted for the locale
  total: number;
  unread: number;
  latest: InboxEntry;
}

const NOW = Date.parse('2026-11-22T12:00:00Z');
const iso = (min: number) => new Date(NOW - min * 60_000).toISOString();

type Raw = {
  id: string;
  type: string;
  kind: InboxKind;
  minutesAgo: number;
  read: boolean;
  bookingId: string | null;
  ar: [string, string];
  en: [string, string];
};

const RAW: Raw[] = [
  {
    id: 'n1', type: 'flight.schedule_changed', kind: 'flights', minutesAgo: 6, read: false, bookingId: 'b-ist',
    ar: ['تغيّر موعد رحلتك إلى إسطنبول', 'أصبحت المغادرة 10:40 بدل 09:15 يوم 12 ديسمبر. لا يلزمك أي إجراء.'],
    en: ['Your Istanbul flight time changed', 'Departure is now 10:40 instead of 09:15 on 12 December. No action needed.'],
  },
  {
    id: 'n2', type: 'booking.ticketed', kind: 'bookings', minutesAgo: 42, read: false, bookingId: 'b-ist',
    ar: ['تذكرتك جاهزة: القاهرة ← إسطنبول', 'أرسلنا التذكرة الإلكترونية إلى بريدك. رقم الحجز GTV-7Q4K2.'],
    en: ['Your ticket is ready: Cairo → Istanbul', 'We e-mailed your e-ticket. Booking reference GTV-7Q4K2.'],
  },
  {
    id: 'n3', type: 'wallet.refund_credited', kind: 'wallet', minutesAgo: 180, read: false, bookingId: null,
    ar: ['أُضيف 145.00 دولار إلى محفظتك', 'استرداد حجز دبي الملغى. الرصيد متاح الآن لحجزك القادم.'],
    en: ['$145.00 added to your wallet', 'Refund for the cancelled Dubai booking. Ready for your next trip.'],
  },
  {
    id: 'n4', type: 'security.new_sign_in', kind: 'security', minutesAgo: 60 * 20, read: true, bookingId: null,
    ar: ['تسجيل دخول جديد إلى حسابك', 'Chrome على Windows من القاهرة. إن لم تكن أنت، غيّر كلمة المرور.'],
    en: ['New sign-in to your account', 'Chrome on Windows from Cairo. If this was not you, change your password.'],
  },
  {
    id: 'n5', type: 'flight.checkin_open', kind: 'flights', minutesAgo: 60 * 26, read: false, bookingId: 'b-jed',
    ar: ['فُتح تسجيل الوصول لرحلة جدة', 'سجّل الآن واختر مقعدك قبل الإقلاع بـ 24 ساعة.'],
    en: ['Check-in is open for your Jeddah flight', 'Check in now and choose your seat, 24 hours before take-off.'],
  },
  {
    id: 'n6', type: 'payment.succeeded', kind: 'payments', minutesAgo: 60 * 27, read: true, bookingId: 'b-jed',
    ar: ['تم الدفع بنجاح', 'دفعت 312.40 دولار لحجز الرياض ← جدة بالبطاقة المنتهية بـ 4417.'],
    en: ['Payment received', 'You paid $312.40 for Riyadh → Jeddah with the card ending 4417.'],
  },
  {
    id: 'n7', type: 'loyalty.points_earned', kind: 'loyalty', minutesAgo: 60 * 50, read: true, bookingId: null,
    ar: ['ربحت 320 نقطة', 'أُضيفت نقاط رحلة جدة إلى رصيدك. أنت على بعد 180 نقطة من المستوى الفضي.'],
    en: ['You earned 320 points', 'Points from your Jeddah trip are in. 180 points to Silver.'],
  },
  {
    id: 'n8', type: 'support.reply', kind: 'support', minutesAgo: 60 * 75, read: true, bookingId: 'b-dxb',
    ar: ['ردّ فريق الدعم على طلبك', 'بخصوص إلغاء رحلة دبي: تمت الموافقة على الاسترداد الكامل إلى محفظتك.'],
    en: ['Support replied to your request', 'About the Dubai cancellation: a full refund to your wallet is approved.'],
  },
  {
    id: 'n9', type: 'booking.cancelled', kind: 'bookings', minutesAgo: 60 * 98, read: true, bookingId: 'b-dxb',
    ar: ['أُلغي حجزك إلى دبي', 'ألغينا الحجز GTV-2M8PX بناءً على طلبك.'],
    en: ['Your Dubai booking was cancelled', 'We cancelled booking GTV-2M8PX as you asked.'],
  },
];

function toEntry(r: Raw, locale: Locale): InboxEntry {
  const [title, body] = r[locale];
  return {
    id: r.id,
    type: r.type,
    kind: r.kind,
    title,
    body,
    bookingId: r.bookingId,
    createdAt: iso(r.minutesAgo),
    minutesAgo: r.minutesAgo,
    readAt: r.read ? iso(r.minutesAgo - 1) : null,
    data: {},
  };
}

/** Every entry, newest first. */
export function inboxEntries(locale: Locale): InboxEntry[] {
  return RAW.map((r) => toEntry(r, locale));
}

const TRIPS: Record<string, { reference: string; ar: InboxTrip['route'] & { departs: string }; en: InboxTrip['route'] & { departs: string } }> = {
  'b-ist': {
    reference: 'GTV-7Q4K2',
    ar: { from: 'القاهرة', to: 'إسطنبول', fromCode: 'CAI', toCode: 'IST', departs: '12 ديسمبر · 10:40' },
    en: { from: 'Cairo', to: 'Istanbul', fromCode: 'CAI', toCode: 'IST', departs: '12 Dec · 10:40' },
  },
  'b-jed': {
    reference: 'GTV-5R1JD',
    ar: { from: 'الرياض', to: 'جدة', fromCode: 'RUH', toCode: 'JED', departs: '24 نوفمبر · 07:05' },
    en: { from: 'Riyadh', to: 'Jeddah', fromCode: 'RUH', toCode: 'JED', departs: '24 Nov · 07:05' },
  },
  'b-dxb': {
    reference: 'GTV-2M8PX',
    ar: { from: 'عمّان', to: 'دبي', fromCode: 'AMM', toCode: 'DXB', departs: 'ملغاة' },
    en: { from: 'Amman', to: 'Dubai', fromCode: 'AMM', toCode: 'DXB', departs: 'Cancelled' },
  },
};

/** One row per booking that has updates, newest update first. `entries` lets a version recompute unread. */
export function inboxTrips(locale: Locale, entries: InboxEntry[] = inboxEntries(locale)): InboxTrip[] {
  const out: InboxTrip[] = [];
  for (const [bookingId, t] of Object.entries(TRIPS)) {
    const own = entries.filter((e) => e.bookingId === bookingId);
    if (!own.length) continue;
    const { departs, ...route } = t[locale];
    out.push({
      bookingId,
      reference: t.reference,
      route,
      departs,
      total: own.length,
      unread: own.filter((e) => !e.readAt).length,
      latest: own[0],
    });
  }
  return out;
}

/** "6 min" / "منذ 6 دقائق" style label, simple and stable for screenshots. */
export function timeAgo(minutes: number, locale: Locale): string {
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto', style: 'short' });
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  if (minutes < 60 * 24) return rtf.format(-Math.round(minutes / 60), 'hour');
  return rtf.format(-Math.round(minutes / (60 * 24)), 'day');
}

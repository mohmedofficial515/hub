/**
 * Strings of v5-luggage-tags. Wording follows the real page (web messages/<locale>/domains/account.json →
 * notifications). The bag-tag codes on the tags (ALL / NEW / TRP) are printed in Latin in both locales, like the
 * IATA codes on a real baggage tag; screen readers hear the `count` sentence instead.
 */

type Forms = { zero?: string; one: string; two: string; few: string; many: string; other: string };

/** Arabic plural forms (CLDR: zero, one, two, few 3–10, many 11–99, other). `#` is the number. */
function arPlural(n: number, f: Forms): string {
  const put = (s: string) => s.replace('#', String(n));
  if (n === 0 && f.zero) return f.zero;
  if (n === 1) return f.one;
  if (n === 2) return f.two;
  const m = n % 100;
  if (m >= 3 && m <= 10) return put(f.few);
  if (m >= 11) return put(f.many);
  return put(f.other);
}

const enPlural = (n: number, one: string, other: string) => (n === 1 ? one : other).replace('#', String(n));

export const messages = {
  ar: {
    title: 'إشعاراتي',
    summary: (n: number) =>
      arPlural(n, {
        zero: 'قرأت كل إشعاراتك',
        one: 'إشعار واحد غير مقروء',
        two: 'إشعاران غير مقروءين',
        few: '# إشعارات غير مقروءة',
        many: '# إشعارًا غير مقروء',
        other: '# إشعار غير مقروء',
      }),
    markAll: 'تعليم الكل كمقروء',
    tabsLabel: 'طرق عرض الإشعارات',
    views: { all: 'الكل', unread: 'غير المقروءة', trips: 'الرحلات' },
    codes: { all: 'ALL', unread: 'NEW', trips: 'TRP' },
    count: {
      all: (n: number) =>
        arPlural(n, { one: 'إشعار واحد', two: 'إشعاران', few: '# إشعارات', many: '# إشعارًا', other: '# إشعار' }),
      unread: (n: number) => `${n} غير مقروءة`,
      trips: (n: number) =>
        arPlural(n, { one: 'رحلة واحدة', two: 'رحلتان', few: '# رحلات', many: '# رحلة', other: '# رحلة' }),
    },
    unread: 'غير مقروء',
    loading: 'جارٍ التحميل…',
    loadError: 'تعذّر تحميل إشعاراتك. حاول مرة أخرى.',
    retry: 'إعادة المحاولة',
    empty: {
      allTitle: 'لا توجد إشعارات بعد',
      allText: 'عندما يطرأ جديد على حجوزاتك أو طلباتك أو حسابك، سنخبرك به هنا.',
      unreadTitle: 'لا توجد إشعارات غير مقروءة',
      unreadText: 'لقد قرأت جميع إشعاراتك.',
      tripsTitle: 'لا توجد مستجدات للرحلات بعد',
      tripsText: 'نجمع هنا مستجدات كل حجز من حجوزاتك حسب الرحلة.',
      threadTitle: 'لا توجد مستجدات لهذه الرحلة',
      threadText: 'ستظهر هنا مستجدات هذا الحجز.',
    },
    trips: {
      booking: (reference: string) => `الحجز ${reference}`,
      unread: (n: number) => `${n} غير مقروءة`,
      total: (n: number) =>
        arPlural(n, { one: 'تحديث واحد', two: 'تحديثان', few: '# تحديثات', many: '# تحديثًا', other: '# تحديث' }),
      route: (from: string, to: string) => `من ${from} إلى ${to}`,
      back: 'كل الرحلات',
      threadSubtitle: 'كل مستجدات هذا الحجز، الأحدث أولًا.',
    },
  },
  en: {
    title: 'My notifications',
    summary: (n: number) => (n === 0 ? 'Everything is read' : enPlural(n, '# unread notification', '# unread notifications')),
    markAll: 'Mark all as read',
    tabsLabel: 'Notification views',
    views: { all: 'All', unread: 'Unread', trips: 'Trips' },
    codes: { all: 'ALL', unread: 'NEW', trips: 'TRP' },
    count: {
      all: (n: number) => enPlural(n, '# notification', '# notifications'),
      unread: (n: number) => `${n} unread`,
      trips: (n: number) => enPlural(n, '# trip', '# trips'),
    },
    unread: 'Unread',
    loading: 'Loading…',
    loadError: 'We could not load your notifications. Please try again.',
    retry: 'Try again',
    empty: {
      allTitle: 'No notifications yet',
      allText: 'When something happens with your bookings, requests or account, we will let you know here.',
      unreadTitle: 'No unread notifications',
      unreadText: 'You have read all your notifications.',
      tripsTitle: 'No trip updates yet',
      tripsText: 'Updates about each of your bookings are grouped here by trip.',
      threadTitle: 'No updates for this trip',
      threadText: 'Updates about this booking will appear here.',
    },
    trips: {
      booking: (reference: string) => `Booking ${reference}`,
      unread: (n: number) => `${n} unread`,
      total: (n: number) => enPlural(n, '# update', '# updates'),
      route: (from: string, to: string) => `${from} to ${to}`,
      back: 'All trips',
      threadSubtitle: 'Every update about this booking, newest first.',
    },
  },
};

export type Messages = (typeof messages)['ar'];

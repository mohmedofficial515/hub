/**
 * Strings of v4-plane-windows. Copy follows web/messages/<locale>/domains/account.json → notifications
 * (views, empty, trips, markAll, page); plurals are written out here because the lab has no ICU formatter.
 */

function arCount(n: number, one: string, two: string, few: (n: number) => string, many: (n: number) => string, other: (n: number) => string) {
  if (n === 1) return one;
  if (n === 2) return two;
  const m = n % 100;
  if (m >= 3 && m <= 10) return few(n);
  if (m >= 11 && m <= 99) return many(n);
  return other(n);
}

export const messages = {
  ar: {
    title: 'إشعاراتي',
    subtitle: 'مستجدات حجوزاتك وطلبات الدعم وحسابك، الأحدث أولًا.',
    cardTitle: 'الإشعارات',
    summary: (n: number) =>
      n === 0
        ? 'قرأت كل إشعاراتك'
        : arCount(n, 'إشعار واحد غير مقروء', 'إشعاران غير مقروءين', (c) => `${c} إشعارات غير مقروءة`, (c) => `${c} إشعارًا غير مقروء`, (c) => `${c} إشعار غير مقروء`),
    markAll: 'تعليم الكل كمقروء',
    unread: 'غير مقروء',
    loading: 'جارٍ التحميل…',
    views: { label: 'طرق عرض الإشعارات', all: 'الكل', unread: 'غير المقروءة', trips: 'الرحلات' },
    badge: (n: number) => `${n} غير مقروءة`,
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
      booking: (ref: string) => `الحجز ${ref}`,
      unread: (n: number) => `${n} غير مقروءة`,
      total: (n: number) => arCount(n, 'تحديث واحد', 'تحديثان', (c) => `${c} تحديثات`, (c) => `${c} تحديثًا`, (c) => `${c} تحديث`),
      back: 'كل الرحلات',
      threadSubtitle: 'كل مستجدات هذا الحجز، الأحدث أولًا.',
      departs: 'المغادرة',
    },
  },
  en: {
    title: 'My notifications',
    subtitle: 'Updates about your bookings, support requests and account, newest first.',
    cardTitle: 'Notifications',
    summary: (n: number) =>
      n === 0 ? 'Everything is read' : n === 1 ? '1 unread notification' : `${n} unread notifications`,
    markAll: 'Mark all as read',
    unread: 'Unread',
    loading: 'Loading…',
    views: { label: 'Notification views', all: 'All', unread: 'Unread', trips: 'Trips' },
    badge: (n: number) => `${n} unread`,
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
      booking: (ref: string) => `Booking ${ref}`,
      unread: (n: number) => `${n} unread`,
      total: (n: number) => (n === 1 ? '1 update' : `${n} updates`),
      back: 'All trips',
      threadSubtitle: 'Every update about this booking, newest first.',
      departs: 'Departs',
    },
  },
};

export type Messages = (typeof messages)['ar'];

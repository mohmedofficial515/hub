/**
 * Strings of v2-flight-path. View names, empty states and trip strings follow
 * web/messages/<locale>/domains/account.json → `notifications` so a port keeps the same copy.
 */

const arPlural = (count: number, forms: { zero: string; one: string; two: string; few: string; many: string; other: string }) => {
  if (count === 0) return forms.zero;
  if (count === 1) return forms.one;
  if (count === 2) return forms.two;
  const mod = count % 100;
  if (mod >= 3 && mod <= 10) return forms.few.replace('#', String(count));
  if (mod >= 11 && mod <= 99) return forms.many.replace('#', String(count));
  return forms.other.replace('#', String(count));
};

export const messages = {
  ar: {
    title: 'إشعاراتي',
    summary: (count: number) =>
      arPlural(count, {
        zero: 'قرأت كل إشعاراتك',
        one: 'إشعار واحد غير مقروء',
        two: 'إشعاران غير مقروءين',
        few: '# إشعارات غير مقروءة',
        many: '# إشعارًا غير مقروء',
        other: '# إشعار غير مقروء',
      }),
    markAll: 'تعليم الكل كمقروء',
    views: { label: 'طرق عرض الإشعارات', all: 'الكل', unread: 'غير المقروءة', trips: 'الرحلات' },
    unreadBadge: (count: number) => `${count} غير مقروءة`,
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
      unread: (count: number) => `${count} غير مقروءة`,
      total: (count: number) =>
        arPlural(count, {
          zero: 'لا تحديثات',
          one: 'تحديث واحد',
          two: 'تحديثان',
          few: '# تحديثات',
          many: '# تحديثًا',
          other: '# تحديث',
        }),
      departs: 'المغادرة',
      back: 'كل الرحلات',
      threadSubtitle: 'كل مستجدات هذا الحجز، الأحدث أولًا.',
      routeAria: (from: string, to: string) => `من ${from} إلى ${to}`,
    },
  },
  en: {
    title: 'My notifications',
    summary: (count: number) =>
      count === 0 ? 'You have read every notification' : count === 1 ? '1 unread notification' : `${count} unread notifications`,
    markAll: 'Mark all as read',
    views: { label: 'Notification views', all: 'All', unread: 'Unread', trips: 'Trips' },
    unreadBadge: (count: number) => `${count} unread`,
    unread: 'Unread',
    loading: 'Loading…',
    loadError: 'We could not load your notifications. Try again.',
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
      unread: (count: number) => `${count} unread`,
      total: (count: number) => (count === 1 ? '1 update' : `${count} updates`),
      departs: 'Departs',
      back: 'All trips',
      threadSubtitle: 'Every update about this booking, newest first.',
      routeAria: (from: string, to: string) => `From ${from} to ${to}`,
    },
  },
};

export type Messages = (typeof messages)['ar'];

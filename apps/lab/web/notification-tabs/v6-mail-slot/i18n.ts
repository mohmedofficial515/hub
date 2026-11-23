/**
 * Strings of v6-mail-slot. Taken from web `messages/<locale>/domains/account.json` → `notifications` where the real
 * page already has them (views, empty, trips, markAll, summary); the rest is new for this version and marked "new".
 * ICU plurals of the real file are written as small functions here.
 */

function arUnread(count: number): string {
  if (count === 0) return 'قرأت كل إشعاراتك';
  if (count === 1) return 'إشعار واحد غير مقروء';
  if (count === 2) return 'إشعاران غير مقروءين';
  const mod = count % 100;
  if (mod >= 3 && mod <= 10) return `${count} إشعارات غير مقروءة`;
  if (mod >= 11) return `${count} إشعارًا غير مقروء`;
  return `${count} إشعار غير مقروء`;
}

function arUpdates(count: number): string {
  if (count === 1) return 'تحديث واحد';
  if (count === 2) return 'تحديثان';
  const mod = count % 100;
  if (mod >= 3 && mod <= 10) return `${count} تحديثات`;
  if (mod >= 11) return `${count} تحديثًا`;
  return `${count} تحديث`;
}

export const messages = {
  ar: {
    title: 'إشعاراتي', // new: the page heading of this version
    summary: arUnread,
    markAll: 'تعليم الكل كمقروء',
    views: { label: 'طرق عرض الإشعارات', all: 'الكل', unread: 'غير المقروءة', trips: 'الرحلات' },
    unread: 'غير مقروء',
    read: 'مقروء', // new
    stampLabel: (count: number) => `، ${count} غير مقروءة`, // new: screen-reader text for the stamp
    openHint: 'افتح الإشعار لتعليمه كمقروء', // new
    loading: 'جارٍ التحميل…',
    loadError: 'تعذّر تحميل إشعاراتك. حاول مرة أخرى.',
    retry: 'إعادة المحاولة', // new
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
      total: arUpdates,
      back: 'كل الرحلات',
      threadSubtitle: 'كل مستجدات هذا الحجز، الأحدث أولًا.',
      departs: 'المغادرة', // new
    },
  },
  en: {
    title: 'My notifications',
    summary: (count: number) =>
      count === 0 ? 'Everything is read' : count === 1 ? '1 unread notification' : `${count} unread notifications`,
    markAll: 'Mark all as read',
    views: { label: 'Notification views', all: 'All', unread: 'Unread', trips: 'Trips' },
    unread: 'Unread',
    read: 'Read',
    stampLabel: (count: number) => `, ${count} unread`,
    openHint: 'Open a notification to mark it read',
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
      unread: (count: number) => `${count} unread`,
      total: (count: number) => (count === 1 ? '1 update' : `${count} updates`),
      back: 'All trips',
      threadSubtitle: 'Every update about this booking, newest first.',
      departs: 'Departs',
    },
  },
};

export type Messages = (typeof messages)['ar'];

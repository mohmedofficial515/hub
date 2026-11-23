/**
 * Strings of v3-split-flap. Copy follows the real page (web messages/<locale>/domains/account.json → notifications);
 * the Arabic plurals are written out as the ICU messages there say.
 */

function arUnreadSummary(n: number): string {
  if (n === 0) return 'قرأت كل إشعاراتك';
  if (n === 1) return 'إشعار واحد غير مقروء';
  if (n === 2) return 'إشعاران غير مقروءين';
  if (n % 100 >= 3 && n % 100 <= 10) return `${n} إشعارات غير مقروءة`;
  if (n % 100 >= 11) return `${n} إشعارًا غير مقروء`;
  return `${n} إشعار غير مقروء`;
}

function arTotal(n: number): string {
  if (n === 1) return 'تحديث واحد';
  if (n === 2) return 'تحديثان';
  if (n % 100 >= 3 && n % 100 <= 10) return `${n} تحديثات`;
  if (n % 100 >= 11) return `${n} تحديثًا`;
  return `${n} تحديث`;
}

export const messages = {
  ar: {
    title: 'إشعاراتي',
    subtitle: 'مستجدات حجوزاتك وطلبات الدعم وحسابك، الأحدث أولًا.',
    summary: arUnreadSummary,
    markAll: 'تعليم الكل كمقروء',
    viewsLabel: 'طرق عرض الإشعارات',
    views: { all: 'الكل', unread: 'غير المقروءة', trips: 'الرحلات' },
    unreadCount: (n: number) => `${n} غير مقروءة`,
    status: { new: 'جديد', read: 'مقروء' },
    statusLabel: 'الحالة',
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
      unreadWord: 'غير مقروءة',
      total: arTotal,
      back: 'كل الرحلات',
      departs: 'المغادرة',
      threadSubtitle: 'كل مستجدات هذا الحجز، الأحدث أولًا.',
      open: (reference: string) => `فتح مستجدات الحجز ${reference}`,
    },
    /** Whole words the Arabic flaps pass through before they settle: printed flaps, like a real board's city names. */
    deck: ['دبي', 'جدة', 'أبها', 'مسقط', 'عمّان', 'تونس', 'بيروت', 'الدوحة', 'الرياض', 'الكويت', 'القاهرة', 'إسطنبول', 'المنامة', 'الإسكندرية'],
  },
  en: {
    title: 'My notifications',
    subtitle: 'Updates about your bookings, support requests and account, newest first.',
    summary: (n: number) =>
      n === 0 ? 'Everything is read' : n === 1 ? '1 unread notification' : `${n} unread notifications`,
    markAll: 'Mark all as read',
    viewsLabel: 'Notification views',
    views: { all: 'All', unread: 'Unread', trips: 'Trips' },
    unreadCount: (n: number) => `${n} unread`,
    status: { new: 'NEW', read: 'READ' },
    statusLabel: 'Status',
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
      unreadWord: 'unread',
      total: (n: number) => (n === 1 ? '1 update' : `${n} updates`),
      back: 'All trips',
      departs: 'Departs',
      threadSubtitle: 'Every update about this booking, newest first.',
      open: (reference: string) => `Open updates for booking ${reference}`,
    },
    deck: [] as string[],
  },
};

export type Messages = (typeof messages)['ar'];

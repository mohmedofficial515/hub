import type { PluralForms } from '../../kit';

export type KindFamily = 'routed' | 'mention' | 'watch' | 'reminder' | 'brief' | 'system';

interface Dict {
  title: string;
  errorThing: string;
  summary: { unread: PluralForms };
  waitingLine: PluralForms;
  allRead: string;
  markAll: string;
  markedAll: PluralForms;
  filters: { show: string; unread: string; all: string; showAll: string; kind: string; anyKind: string; kinds: Record<KindFamily, string>; clear: string };
  rest: { unread: string; all: string; earlier: string; today: string; yesterday: string };
  row: {
    unread: string;
    more: PluralForms;
    markRead: string;
    markUnread: string;
    archive: string;
    restore: string;
    openToday: string;
    openSettings: string;
    archived: string;
    restored: string;
    swipe: string;
    readNow: string;
    unreadNow: string;
  };
  archive: { show: string; hide: string; title: string; empty: string };
  empty: {
    allTitle: string;
    allBody: string;
    unreadTitle: string;
    unreadBody: string;
    needsTitle: string;
    needsBody: string;
    kindTitle: string;
    kindBody: string;
  };
}

const ar: Dict = {
  title: 'الوارد',
  errorThing: 'الوارد',
  summary: {
    unread: { zero: 'لا شيء غير مقروء', one: 'إشعار واحد غير مقروء', two: 'إشعاران غير مقروءين', few: '# إشعارات غير مقروءة', many: '# إشعارًا غير مقروء', other: '# إشعار غير مقروء' },
  },
  waitingLine: { one: 'بطاقة واحدة تنتظرك في يومي', two: 'بطاقتان تنتظرانك في يومي', few: '# بطاقات تنتظرك في يومي', many: '# بطاقة تنتظرك في يومي', other: '# بطاقة تنتظرك في يومي' },
  allRead: 'قُرئ كل شيء',
  markAll: 'علّم الكل مقروءًا',
  markedAll: { one: 'عُلّم إشعار واحد مقروءًا', two: 'عُلّم إشعاران مقروءين', few: 'عُلّمت # إشعارات مقروءة', many: 'عُلّم # إشعارًا مقروءًا', other: 'عُلّم # إشعار مقروءًا' },
  filters: {
    show: 'عرض',
    unread: 'غير المقروء',
    all: 'الكل',
    showAll: 'اعرض كل الإشعارات',
    kind: 'نوع الإشعار',
    anyKind: 'كل الأنواع',
    kinds: { routed: 'موجّه إليّ', mention: 'إشارات', watch: 'ما أتابعه', reminder: 'تذكيرات', brief: 'موجزات', system: 'النظام' },
    clear: 'امسح الفلاتر',
  },
  rest: { unread: 'غير المقروء', all: 'كل الإشعارات', earlier: 'أقدم', today: 'اليوم', yesterday: 'أمس' },
  row: {
    unread: 'غير مقروء',
    more: { one: '+1 على هذه البطاقة', two: '+2 على هذه البطاقة', few: '+# على هذه البطاقة', many: '+# على هذه البطاقة', other: '+# على هذه البطاقة' },
    markRead: 'علّمه مقروءًا',
    markUnread: 'علّمه غير مقروء',
    archive: 'أرشفه',
    restore: 'استعده',
    openToday: 'افتح يومي',
    openSettings: 'افتح المصادر',
    archived: 'أُرشف الإشعار',
    restored: 'استُعيد الإشعار',
    swipe: 'أرشفة',
    readNow: 'صار مقروءًا',
    unreadNow: 'صار غير مقروء',
  },
  archive: { show: 'اعرض المؤرشف ({n})', hide: 'ارجع إلى الوارد', title: 'المؤرشف', empty: 'لا إشعارات مؤرشفة.' },
  empty: {
    allTitle: 'لا إشعارات بعد',
    allBody: 'تصلك الإشعارات هنا حين تُوجَّه بطاقة إلى أدوارك، أو يشير إليك أحد، أو تتغير بطاقة تتابعها.',
    unreadTitle: 'قرأت كل شيء',
    unreadBody: 'يصلك الجديد هنا فور وصوله.',
    needsTitle: 'لا شيء ينتظرك',
    needsBody: 'حين تُوجَّه إليك بطاقة تظهر هنا مع إجرائها.',
    kindTitle: 'لا إشعارات من هذا النوع',
    kindBody: 'جرّب نوعًا آخر أو امسح الفلاتر.',
  },
};

const en: Dict = {
  title: 'Inbox',
  errorThing: 'your inbox',
  summary: {
    unread: { zero: 'Nothing unread', one: '1 unread', other: '# unread' },
  },
  waitingLine: { one: '1 card waits for you in Today', other: '# cards wait for you in Today' },
  allRead: 'All read',
  markAll: 'Mark all read',
  markedAll: { one: 'Marked 1 notification read', other: 'Marked # notifications read' },
  filters: {
    show: 'Show',
    unread: 'Unread',
    all: 'All',
    showAll: 'Show all notifications',
    kind: 'Notification kind',
    anyKind: 'All kinds',
    kinds: { routed: 'Routed to me', mention: 'Mentions', watch: 'Watching', reminder: 'Reminders', brief: 'Briefs', system: 'System' },
    clear: 'Clear filters',
  },
  rest: { unread: 'Unread', all: 'All notifications', earlier: 'Earlier', today: 'Today', yesterday: 'Yesterday' },
  row: {
    unread: 'Unread',
    more: { one: '+1 on this card', other: '+# on this card' },
    markRead: 'Mark read',
    markUnread: 'Mark unread',
    archive: 'Archive',
    restore: 'Restore',
    openToday: 'Open Today',
    openSettings: 'Open sources',
    archived: 'Notification archived',
    restored: 'Notification restored',
    swipe: 'Archive',
    readNow: 'Marked read',
    unreadNow: 'Marked unread',
  },
  archive: { show: 'Show archived ({n})', hide: 'Back to the inbox', title: 'Archived', empty: 'No archived notifications.' },
  empty: {
    allTitle: 'No notifications yet',
    allBody: 'Notifications appear here when something is routed to your roles, you are mentioned, or a card you watch changes.',
    unreadTitle: 'You’re all caught up',
    unreadBody: 'New notifications land here as they arrive.',
    needsTitle: 'Nothing waits for you',
    needsBody: 'When a card is routed to you, it shows here with its action.',
    kindTitle: 'No notifications of this kind',
    kindBody: 'Try another kind, or clear the filters.',
  },
};

export const messages = { ar, en };

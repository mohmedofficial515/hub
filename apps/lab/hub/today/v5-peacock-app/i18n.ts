import type { PluralForms } from './kit/format';
import type { ViewId } from './shell/router';

/** Shell strings only. Pages keep their own in `pages/<view>/i18n.ts`, the card vocabulary is in `kit/i18n.ts`. */
export type NavGroup = 'work' | 'knowledge' | 'workspace';

interface Dict {
  nav: Record<ViewId, string>;
  groups: Record<NavGroup, string>;
  /** Counter badges in words (08 §6: `aria-label="3 unread"`), `#` is the number. */
  counts: Record<'inbox' | 'timeline' | 'tasks' | 'decisions' | 'decisionsOverdue' | 'needs' | 'handoffs' | 'redesign' | 'onboarding' | 'members' | 'settings', PluralForms>;
  sidebar: {
    label: string;
    collapse: string;
    expand: string;
    workspace: string;
    switchTo: string;
    allWorkspaces: string;
    language: string;
    toEnglish: string;
    toArabic: string;
    themeToDark: string;
    themeToLight: string;
    me: string;
    profile: string;
    tokens: string;
    shortcuts: string;
    signOut: string;
    shortcutsOn: string;
    openMenu: string;
    closeMenu: string;
  };
  header: {
    breadcrumb: string;
    search: string;
    newCard: string;
    live: string;
    reconnecting: string;
    me: string;
  };
  skip: string;
  palette: {
    label: string;
    placeholder: string;
    empty: string;
    recent: string;
    pages: string;
    cards: string;
    actions: string;
    jump: string;
    hint: string;
    act: {
      newTask: string;
      newDecision: string;
      newNeed: string;
      newHandoff: string;
      toggleTheme: string;
      toggleLanguage: string;
      switchWorkspace: string;
      copyMcp: string;
      showShortcuts: string;
    };
    mcpCopied: string;
    switched: string;
  };
  shortcuts: {
    title: string;
    disable: string;
    disableHint: string;
    groups: { nav: string; go: string; lists: string; cards: string };
    items: Record<string, string>;
  };
  newCard: {
    title: string;
    types: string;
    titleLabel: string;
    titleHint: string;
    role: string;
    priority: string;
    body: string;
    create: string;
    createOpen: string;
    created: string;
    required: string;
  };
  notFound: { title: string; body: string };
  viewError: string;
}

const ar: Dict = {
  nav: {
    today: 'يومي',
    inbox: 'الوارد',
    timeline: 'الخط الزمني',
    tasks: 'المهام',
    decisions: 'القرارات',
    needs: 'الاحتياجات',
    handoffs: 'الإحالات',
    redesign: 'إعادة التصميم',
    releases: 'الإصدارات',
    docs: 'الوثائق',
    ask: 'اسأل',
    onboarding: 'البداية',
    members: 'الأعضاء',
    settings: 'الإعدادات',
  },
  groups: { work: 'العمل', knowledge: 'المعرفة', workspace: 'مساحة العمل' },
  counts: {
    inbox: { one: 'رسالة واحدة غير مقروءة', two: 'رسالتان غير مقروءتين', few: '# رسائل غير مقروءة', many: '# رسالة غير مقروءة', other: '# رسالة غير مقروءة' },
    timeline: { other: 'أحداث منذ زيارتك الأخيرة: #' },
    tasks: { other: 'مهام جاهزة لك: #' },
    decisions: { other: 'قرارات موجّهة إليك: #' },
    decisionsOverdue: { other: 'قرارات موجّهة إليك: #، ومنها متأخر' },
    needs: { other: 'احتياجات موجّهة إليك: #' },
    handoffs: { other: 'إحالات بانتظارك: #' },
    redesign: { other: 'نسخ قيد المراجعة: #' },
    onboarding: { other: 'خطوات متبقية: #' },
    members: { other: 'دعوات معلّقة: #' },
    settings: { other: 'مصادر فيها مشكلة: #' },
  },
  sidebar: {
    label: 'التنقل الرئيسي',
    collapse: 'اطوِ الشريط الجانبي',
    expand: 'وسّع الشريط الجانبي',
    workspace: 'مساحة العمل',
    switchTo: 'بدّل مساحة العمل',
    allWorkspaces: 'كل مساحات العمل',
    language: 'اللغة',
    toEnglish: 'English',
    toArabic: 'العربية',
    themeToDark: 'الوضع الداكن',
    themeToLight: 'الوضع الفاتح',
    me: 'حسابي',
    profile: 'ملفي',
    tokens: 'توكنات الوصول',
    shortcuts: 'اختصارات لوحة المفاتيح',
    signOut: 'تسجيل الخروج',
    shortcutsOn: 'اختصارات الحرف الواحد مفعّلة',
    openMenu: 'افتح القائمة',
    closeMenu: 'أغلق القائمة',
  },
  header: {
    breadcrumb: 'مسار الصفحة',
    search: 'ابحث في البطاقات والصفحات',
    newCard: 'بطاقة جديدة',
    live: 'مباشر',
    reconnecting: 'يعيد الاتصال…',
    me: 'حسابي',
  },
  skip: 'انتقل إلى المحتوى',
  palette: {
    label: 'لوحة الأوامر',
    placeholder: 'ابحث عن بطاقة أو صفحة أو أمر…',
    empty: 'لا نتائج. جرّب مفتاح بطاقة مثل GTV-231.',
    recent: 'الأخيرة',
    pages: 'الصفحات',
    cards: 'البطاقات',
    actions: 'الأوامر',
    jump: 'افتح {key}',
    hint: 'الأسهم للتنقل، Enter للفتح، Esc للإغلاق',
    act: {
      newTask: 'مهمة جديدة',
      newDecision: 'قرار جديد',
      newNeed: 'احتياج جديد',
      newHandoff: 'إحالة جديدة',
      toggleTheme: 'بدّل الوضع الفاتح والداكن',
      toggleLanguage: 'بدّل اللغة',
      switchWorkspace: 'بدّل مساحة العمل',
      copyMcp: 'انسخ إعداد MCP الخاص بي',
      showShortcuts: 'اعرض الاختصارات',
    },
    mcpCopied: 'نُسخ إعداد MCP',
    switched: 'مساحة تجريبية: العدادات تُحدَّث عند التبديل في Hub الحقيقي.',
  },
  shortcuts: {
    title: 'اختصارات لوحة المفاتيح',
    disable: 'اختصارات الحرف الواحد',
    disableHint: 'أوقفها إذا كانت تتعارض مع قارئ الشاشة أو الإدخال الصوتي. يبقى Ctrl+K وEsc يعملان.',
    groups: { nav: 'التنقل', go: 'انتقل إلى', lists: 'القوائم', cards: 'البطاقات' },
    items: {
      palette: 'لوحة الأوامر',
      help: 'هذه القائمة',
      sidebar: 'اطوِ الشريط الجانبي أو وسّعه',
      newTask: 'مهمة جديدة',
      newDecision: 'قرار جديد',
      newNeed: 'احتياج جديد',
      newHandoff: 'إحالة جديدة',
      move: 'الصف التالي أو السابق',
      open: 'افتح الصف',
      undo: 'تراجع عن آخر إجراء',
      refresh: 'حدّث الصفحة',
      timelineFilters: 'الخط الزمني: انتقل إلى الفلاتر',
      inboxRead: 'الوارد: علّم الصف مقروءًا أو غير مقروء',
      inboxReadAll: 'الوارد: علّم الكل مقروءًا',
      tasksView: 'المهام: بدّل بين اللوحة والقائمة',
      redesignPick: 'إعادة التصميم: أضف النسخة إلى المقارنة',
      claim: 'احجز المهمة',
      decide: 'قرّر',
      acknowledge: 'استلم الإحالة',
      watch: 'تابع البطاقة',
      copyKey: 'انسخ مفتاح البطاقة',
      close: 'أغلق البطاقة أو النافذة',
    },
  },
  newCard: {
    title: 'بطاقة جديدة',
    types: 'نوع البطاقة',
    titleLabel: 'العنوان',
    titleHint: 'جملة قصيرة تصف المطلوب.',
    role: 'الدور المسؤول',
    priority: 'الأولوية',
    body: 'التفاصيل (اختيارية)',
    create: 'أنشئ',
    createOpen: 'أنشئ وافتح',
    created: 'أُنشئت {key}',
    required: 'اكتب عنوانًا لتكمل.',
  },
  notFound: { title: 'هذه الصفحة غير موجودة', body: 'اختر صفحة من الشريط الجانبي.' },
  viewError: 'هذه الصفحة',
};

const en: Dict = {
  nav: {
    today: 'Today',
    inbox: 'Inbox',
    timeline: 'Timeline',
    tasks: 'Tasks',
    decisions: 'Decisions',
    needs: 'Needs',
    handoffs: 'Handoffs',
    redesign: 'Redesign',
    releases: 'Releases',
    docs: 'Docs',
    ask: 'Ask',
    onboarding: 'Onboarding',
    members: 'Members',
    settings: 'Settings',
  },
  groups: { work: 'Work', knowledge: 'Knowledge', workspace: 'Workspace' },
  counts: {
    inbox: { one: '1 unread', other: '# unread' },
    timeline: { one: '1 event since your last visit', other: '# events since your last visit' },
    tasks: { one: '1 task ready for you', other: '# tasks ready for you' },
    decisions: { one: '1 decision routed to you', other: '# decisions routed to you' },
    decisionsOverdue: { one: '1 decision routed to you, overdue', other: '# decisions routed to you, some overdue' },
    needs: { one: '1 need routed to you', other: '# needs routed to you' },
    handoffs: { one: '1 handoff waiting for you', other: '# handoffs waiting for you' },
    redesign: { one: '1 version in review', other: '# versions in review' },
    onboarding: { one: '1 step left', other: '# steps left' },
    members: { one: '1 pending invite', other: '# pending invites' },
    settings: { one: '1 source with a problem', other: '# sources with problems' },
  },
  sidebar: {
    label: 'Main navigation',
    collapse: 'Collapse sidebar',
    expand: 'Expand sidebar',
    workspace: 'Workspace',
    switchTo: 'Switch workspace',
    allWorkspaces: 'All workspaces',
    language: 'Language',
    toEnglish: 'English',
    toArabic: 'العربية',
    themeToDark: 'Dark theme',
    themeToLight: 'Light theme',
    me: 'My account',
    profile: 'Profile',
    tokens: 'Access tokens',
    shortcuts: 'Keyboard shortcuts',
    signOut: 'Sign out',
    shortcutsOn: 'Single-key shortcuts are on',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },
  header: {
    breadcrumb: 'Breadcrumb',
    search: 'Search cards and pages',
    newCard: 'New card',
    live: 'Live',
    reconnecting: 'Reconnecting…',
    me: 'My account',
  },
  skip: 'Skip to content',
  palette: {
    label: 'Command palette',
    placeholder: 'Search for a card, page or command…',
    empty: 'No results. Try a card key like GTV-231.',
    recent: 'Recent',
    pages: 'Pages',
    cards: 'Cards',
    actions: 'Commands',
    jump: 'Open {key}',
    hint: 'Arrows move, Enter opens, Esc closes',
    act: {
      newTask: 'New task',
      newDecision: 'New decision',
      newNeed: 'New need',
      newHandoff: 'New handoff',
      toggleTheme: 'Toggle light and dark',
      toggleLanguage: 'Switch language',
      switchWorkspace: 'Switch workspace',
      copyMcp: 'Copy my MCP setup',
      showShortcuts: 'Show shortcuts',
    },
    mcpCopied: 'Copied the MCP setup',
    switched: 'Sandbox workspace: counters reload here in the real Hub.',
  },
  shortcuts: {
    title: 'Keyboard shortcuts',
    disable: 'Single-key shortcuts',
    disableHint: 'Turn them off if they clash with a screen reader or voice input. Ctrl+K and Esc keep working.',
    groups: { nav: 'Navigation', go: 'Go to', lists: 'Lists', cards: 'Cards' },
    items: {
      palette: 'Command palette',
      help: 'This list',
      sidebar: 'Collapse or expand the sidebar',
      newTask: 'New task',
      newDecision: 'New decision',
      newNeed: 'New need',
      newHandoff: 'New handoff',
      move: 'Next or previous row',
      open: 'Open the row',
      undo: 'Undo the last action',
      refresh: 'Refresh the page',
      timelineFilters: 'Timeline: jump to the filters',
      inboxRead: 'Inbox: mark the row read or unread',
      inboxReadAll: 'Inbox: mark all read',
      tasksView: 'Tasks: switch between board and list',
      redesignPick: 'Redesign: add the version to compare',
      claim: 'Claim the task',
      decide: 'Decide',
      acknowledge: 'Acknowledge the handoff',
      watch: 'Watch the card',
      copyKey: 'Copy the card key',
      close: 'Close the card or dialog',
    },
  },
  newCard: {
    title: 'New card',
    types: 'Card type',
    titleLabel: 'Title',
    titleHint: 'One short line that says what is needed.',
    role: 'Responsible role',
    priority: 'Priority',
    body: 'Details (optional)',
    create: 'Create',
    createOpen: 'Create and open',
    created: 'Created {key}',
    required: 'Write a title to continue.',
  },
  notFound: { title: 'This page does not exist', body: 'Pick a page from the sidebar.' },
  viewError: 'this page',
};

export const messages = { ar, en };
export type ShellMessages = Dict;

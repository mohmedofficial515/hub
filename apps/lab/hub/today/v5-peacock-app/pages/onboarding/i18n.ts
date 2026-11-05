import type { PluralForms } from '../../kit';

interface Dict {
  title: string;
  progress: string;
  progressLabel: string;
  roles: string;
  phases: { read: string; setup: string; work: string };
  next: string;
  minutes: PluralForms;
  open: { doc: string; card: string; url: string; action: string; tasks: string; settings: string };
  markDone: string;
  undoDone: string;
  markedDone: string;
  autoNote: string;
  auto: string;
  doneAuto: string;
  step: string;
  doneWord: string;
  todoWord: string;
  doneTitle: string;
  doneBody: string;
  goToday: string;
  sidebarNote: string;
  preview: { label: string; banner: string; mine: string; none: string; settings: string };
  emptyTitle: string;
  emptyBody: string;
  emptyAction: string;
  emptyTitleManager: string;
  emptyBodyManager: string;
  emptyActionManager: string;
  errorThing: string;
  loading: string;
}

export const messages: { ar: Dict; en: Dict } = {
  ar: {
    title: 'أهلًا بك في جوتيف، {name}',
    progress: '{done} من {total} خطوات',
    progressLabel: 'تقدّمك في المسار',
    roles: 'أدوارك',
    phases: { read: 'اقرأ أولًا', setup: 'جهّز أدواتك', work: 'ابدأ العمل' },
    next: 'خطوتك التالية',
    minutes: { one: 'نحو دقيقة', two: 'نحو دقيقتين', few: 'نحو # دقائق', many: 'نحو # دقيقة', other: 'نحو # دقيقة' },
    open: { doc: 'اقرأها', card: 'افتحها', url: 'افتحها', action: 'افتحها', tasks: 'افتح المهام', settings: 'افتح الإعدادات' },
    markDone: 'علّمها منجزة',
    undoDone: 'أعدها غير منجزة',
    markedDone: 'أنجزت: {title}',
    autoNote: 'يعلّمها Hub بنفسه.',
    auto: 'تلقائية',
    doneAuto: 'علّمها Hub',
    step: 'الخطوة {n}',
    doneWord: 'منجزة',
    todoWord: 'لم تُنجز',
    doneTitle: 'لم يبقَ شيء في مسارك',
    doneBody: 'يمكنك الرجوع إلى هذه الصفحة في أي وقت من قائمة حسابك.',
    goToday: 'اذهب إلى اليوم',
    sidebarNote: 'اختفى العدّاد من الشريط الجانبي، وتبقى الصفحة متاحة.',
    preview: { label: 'معاينة مسار دور', banner: 'هذا ما يراه عضو جديد بدور {role}. لا شيء هنا يُحفظ.', mine: 'مساري', none: '', settings: 'عدّل المسارات من الإعدادات' },
    emptyTitle: 'لم يحدد المالك مسار قراءة لدور {role} بعد',
    emptyBody: 'ابدأ بالوثائق.',
    emptyAction: 'افتح الوثائق',
    emptyTitleManager: 'لم تحدد بعد مسار قراءة',
    emptyBodyManager: 'اختر ما يقرؤه العضو الجديد لكل دور من الإعدادات.',
    emptyActionManager: 'افتح الإعدادات',
    errorThing: 'مسارك',
    loading: 'جارٍ تحميل مسارك',
  },
  en: {
    title: 'Welcome to Goteav, {name}',
    progress: '{done} of {total} steps',
    progressLabel: 'Your progress on the path',
    roles: 'Your roles',
    phases: { read: 'Read first', setup: 'Set up your tools', work: 'Start working' },
    next: 'Your next step',
    minutes: { one: 'About 1 minute', other: 'About # minutes' },
    open: { doc: 'Read it', card: 'Open it', url: 'Open it', action: 'Open it', tasks: 'Open Tasks', settings: 'Open Settings' },
    markDone: 'Mark done',
    undoDone: 'Mark not done',
    markedDone: 'Done: {title}',
    autoNote: 'Hub ticks this itself.',
    auto: 'Automatic',
    doneAuto: 'Ticked by Hub',
    step: 'Step {n}',
    doneWord: 'done',
    todoWord: 'not done',
    doneTitle: 'Nothing is left on your path',
    doneBody: 'You can come back to this page at any time from your account menu.',
    goToday: 'Go to Today',
    sidebarNote: 'The sidebar count is gone, and this page stays available.',
    preview: { label: 'Preview a role’s path', banner: 'This is what a new member with the {role} role sees. Nothing here is saved.', mine: 'My path', none: '', settings: 'Edit the paths in Settings' },
    emptyTitle: 'The owner has not set a reading path for {role} yet',
    emptyBody: 'Start with the docs.',
    emptyAction: 'Open the docs',
    emptyTitleManager: 'You have not set a reading path yet',
    emptyBodyManager: 'Choose what a new member reads for each role in Settings.',
    emptyActionManager: 'Open Settings',
    errorThing: 'your path',
    loading: 'Loading your path',
  },
};

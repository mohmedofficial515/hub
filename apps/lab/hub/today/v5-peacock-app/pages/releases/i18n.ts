import type { PluralForms } from '../../kit';

interface Dict {
  title: string;
  meta: { manager: PluralForms; other: PluralForms };
  newRelease: string;
  pmOnly: string;
  filters: { repo: string; status: string };
  next: { title: string; none: string; noneBody: string; lastOf: string };
  shipped: string;
  included: PluralForms;
  includedTitle: string;
  notes: string;
  wroteBy: string;
  polish: string;
  regenerate: string;
  regenerated: string;
  copyNote: string;
  groups: { decision: string; task: string; handoff: string; redesign: string; change: string; need: string; doc: string; release: string };
  waiting: { title: PluralForms; body: string };
  dialog: {
    title: string;
    description: string;
    version: string;
    versionHint: string;
    repo: string;
    tag: string;
    tagHint: string;
    name: string;
    nameHint: string;
    include: string;
    includeHint: string;
    includeNone: string;
    create: string;
    created: string;
    needVersion: string;
    needName: string;
    needInclude: string;
    secret: string;
  };
  empty: { title: string; body: string };
  noMatch: { title: string; body: string; clear: string };
  errorThing: string;
  loading: string;
  tagged: string;
  untagged: string;
}

export const messages: { ar: Dict; en: Dict } = {
  ar: {
    title: 'الإصدارات',
    meta: {
      manager: { zero: 'لا إصدار قيد التحضير.', one: 'إصدار واحد قيد التحضير.', two: 'إصداران قيد التحضير.', few: '# إصدارات قيد التحضير.', many: '# إصدارًا قيد التحضير.', other: '# إصدار قيد التحضير.' },
      other: { zero: 'لا إصدار قيد التحضير.', one: 'إصدار واحد قيد التحضير.', two: 'إصداران قيد التحضير.', few: '# إصدارات قيد التحضير.', many: '# إصدارًا قيد التحضير.', other: '# إصدار قيد التحضير.' },
    },
    newRelease: 'إصدار جديد',
    pmOnly: 'يحتاج دور المالك أو مدير المشروع.',
    filters: { repo: 'المستودع', status: 'الحالة' },
    next: { title: 'القادم', none: 'لا إصدار قيد التحضير', noneBody: 'أنشئ إصدارًا عندما تكون الدفعة جاهزة للإنتاج.', lastOf: 'مبني على {key}' },
    shipped: 'ما صدر',
    included: { zero: 'لا بطاقات', one: 'بطاقة واحدة', two: 'بطاقتان', few: '# بطاقات', many: '# بطاقة', other: '# بطاقة' },
    includedTitle: 'ما يشمله',
    notes: 'الملاحظات لكل جمهور',
    wroteBy: 'الكاتب:',
    polish: 'مسودة من قالب Hub. تعدّلها يدويًا، أو يصقلها Claude Code عبر hub.update_card.',
    regenerate: 'أعد توليد المسودة',
    regenerated: 'أُعيد توليد ملاحظات {key} من البطاقات المشمولة',
    copyNote: 'انسخ ملاحظات {name}',
    groups: { decision: 'القرارات', task: 'المهام', handoff: 'الإحالات', redesign: 'التصميمات', change: 'التغييرات', need: 'الاحتياجات', doc: 'الوثائق', release: 'الإصدارات' },
    waiting: { title: { zero: 'لا بطاقات منجزة خارج إصدار', one: 'بطاقة منجزة خارج أي إصدار', two: 'بطاقتان منجزتان خارج أي إصدار', few: '# بطاقات منجزة خارج أي إصدار', many: '# بطاقة منجزة خارج أي إصدار', other: '# بطاقة منجزة خارج أي إصدار' }, body: 'تدخل في الإصدار التالي عندما تختارها.' },
    dialog: {
      title: 'إصدار جديد',
      description: 'يبني Hub الملاحظات من البطاقات التي تختارها، مجمّعة حسب النوع لكل جمهور.',
      version: 'الإصدار',
      versionHint: 'تاريخ الإصدار، مثل 2026-11-10',
      repo: 'المستودع',
      tag: 'الوسم',
      tagHint: 'اختياري، ويمكن إضافته عند الإصدار.',
      name: 'الاسم',
      nameHint: 'كلمات قليلة تصف الدفعة.',
      include: 'يشمل',
      includeHint: 'مهام منجزة، إحالات مطبّقة، قرارات محسومة، وتصميمات منقولة منذ آخر إصدار.',
      includeNone: 'لا بطاقات منجزة منذ آخر إصدار. يمكنك الإنشاء الآن والإضافة لاحقًا.',
      create: 'أنشئ الإصدار',
      created: 'أُنشئ {key}',
      needVersion: 'اكتب الإصدار.',
      needName: 'اكتب اسمًا للدفعة.',
      needInclude: 'اختر بطاقة واحدة على الأقل.',
      secret: 'يبدو أن هذا النص يحتوي على سر. احذفه.',
    },
    empty: { title: 'لا إصدارات بعد', body: 'أنشئ إصدارًا عندما تذهب دفعة إلى الإنتاج.' },
    noMatch: { title: 'لا إصدارات بهذه الفلاتر', body: 'جرّب مستودعًا آخر، أو اعرض كل الإصدارات.', clear: 'أزل الفلاتر' },
    errorThing: 'الإصدارات',
    loading: 'جارٍ تحميل الإصدارات',
    tagged: 'وسم {tag}',
    untagged: 'بلا وسم بعد',
  },
  en: {
    title: 'Releases',
    meta: {
      manager: { zero: 'Nothing is being prepared.', one: 'One release is being prepared.', other: '# releases are being prepared.' },
      other: { zero: 'Nothing is being prepared.', one: 'One release is being prepared.', other: '# releases are being prepared.' },
    },
    newRelease: 'New release',
    pmOnly: 'Needs the owner or PM role.',
    filters: { repo: 'Repo', status: 'Status' },
    next: { title: 'Next up', none: 'Nothing is being prepared', noneBody: 'Create a release when a batch is ready for production.', lastOf: 'Built on {key}' },
    shipped: 'Shipped',
    included: { zero: 'No cards', one: '1 card', other: '# cards' },
    includedTitle: 'What it includes',
    notes: 'Notes per audience',
    wroteBy: 'Written by',
    polish: 'A skeleton from Hub’s template. Edit it by hand, or let Claude Code polish it through hub.update_card.',
    regenerate: 'Rebuild skeleton',
    regenerated: 'Rebuilt the notes of {key} from its included cards',
    copyNote: 'Copy the {name} notes',
    groups: { decision: 'Decisions', task: 'Tasks', handoff: 'Handoffs', redesign: 'Redesigns', change: 'Changes', need: 'Needs', doc: 'Docs', release: 'Releases' },
    waiting: { title: { zero: 'No finished cards outside a release', one: '1 finished card is outside any release', other: '# finished cards are outside any release' }, body: 'They join the next release when you pick them.' },
    dialog: {
      title: 'New release',
      description: 'Hub builds the notes from the cards you pick, grouped by type for each audience.',
      version: 'Version',
      versionHint: 'A release date, such as 2026-11-10',
      repo: 'Repo',
      tag: 'Tag',
      tagHint: 'Optional. You can add it when releasing.',
      name: 'Name',
      nameHint: 'A few words for the batch.',
      include: 'Includes',
      includeHint: 'Done tasks, applied handoffs, decided decisions and ported redesigns since the last release.',
      includeNone: 'No finished cards since the last release. You can create it now and add them later.',
      create: 'Create release',
      created: 'Created {key}',
      needVersion: 'Write the version.',
      needName: 'Write a name for the batch.',
      needInclude: 'Pick at least one card.',
      secret: 'This text looks like it contains a secret. Remove it.',
    },
    empty: { title: 'No releases yet', body: 'Create one when a batch goes to production.' },
    noMatch: { title: 'No releases match these filters', body: 'Try another repo, or show every release.', clear: 'Clear filters' },
    errorThing: 'the releases',
    loading: 'Loading the releases',
    tagged: 'Tag {tag}',
    untagged: 'No tag yet',
  },
};

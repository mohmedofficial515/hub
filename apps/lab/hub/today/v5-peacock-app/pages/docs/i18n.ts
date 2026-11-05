import type { PluralForms } from '../../kit';

interface Dict {
  title: string;
  meta: string;
  search: string;
  searchLabel: string;
  treeLabel: string;
  sourceCount: PluralForms;
  expand: string;
  collapse: string;
  recentTitle: string;
  recentBody: string;
  back: string;
  stale: string;
  staleHint: string;
  updated: string;
  words: PluralForms;
  commit: string;
  copyPath: string;
  openGithub: string;
  twin: string;
  twinNames: { ar: string; en: string };
  outline: string;
  referencedBy: string;
  notReferenced: string;
  sectionLink: string;
  copyCode: string;
  card: string;
  excerptNote: string;
  emptyTitle: string;
  emptyBody: string;
  emptyAction: string;
  errorThing: string;
  loading: string;
  notFound: string;
  notFoundBody: string;
}

export const messages: { ar: Dict; en: Dict } = {
  ar: {
    title: 'الوثائق',
    meta: 'توثيق المشروع كما هو في Git، للقراءة من مكان واحد.',
    search: 'ابحث في الوثائق…',
    searchLabel: 'ابحث في الوثائق عبر صفحة اسأل',
    treeLabel: 'شجرة الوثائق',
    sourceCount: { one: 'وثيقة واحدة', two: 'وثيقتان', few: '# وثائق', many: '# وثيقة', other: '# وثيقة' },
    expand: 'افتح {name}',
    collapse: 'أغلق {name}',
    recentTitle: 'حُدّثت مؤخرًا',
    recentBody: 'اختر وثيقة من الشجرة، أو ابدأ بما تغيّر.',
    back: 'كل الوثائق',
    stale: 'قديمة',
    staleHint: 'تغيّر المصدر ولم تُفهرس بعد. قد يختلف النص عمّا في Git.',
    updated: 'حُدّثت {when}',
    words: { one: 'كلمة واحدة', two: 'كلمتان', few: '# كلمات', many: '# كلمة', other: '# كلمة' },
    commit: 'commit',
    copyPath: 'انسخ المسار {path}',
    openGithub: 'افتح في GitHub',
    twin: 'لغة الوثيقة',
    twinNames: { ar: 'العربية', en: 'English' },
    outline: 'في هذه الوثيقة',
    referencedBy: 'مذكورة في',
    notReferenced: 'لا بطاقة تذكر هذه الوثيقة بعد.',
    sectionLink: 'رابط قسم {name}',
    copyCode: 'انسخ الكود',
    card: 'بطاقة الوثيقة',
    excerptNote: 'نموذج المختبر: نص مختصر للعرض، والملف الحقيقي في Git.',
    emptyTitle: 'لا وثائق مفهرسة',
    emptyBody: 'أضف مصدرًا لمجلد وثائق من الإعدادات.',
    emptyAction: 'افتح المصادر',
    errorThing: 'الوثائق',
    loading: 'جارٍ تحميل الوثائق',
    notFound: 'لا توجد هذه الوثيقة',
    notFoundBody: 'ربما نُقلت أو حُذف ملفها. اختر وثيقة من الشجرة.',
  },
  en: {
    title: 'Docs',
    meta: 'The project’s documentation as it is in Git, in one place to read.',
    search: 'Search docs…',
    searchLabel: 'Search the docs through the Ask page',
    treeLabel: 'Docs tree',
    sourceCount: { one: '1 doc', other: '# docs' },
    expand: 'Open {name}',
    collapse: 'Close {name}',
    recentTitle: 'Recently updated',
    recentBody: 'Pick a doc from the tree, or start with what changed.',
    back: 'All docs',
    stale: 'Stale',
    staleHint: 'The source moved and indexing has not run yet. The text may differ from Git.',
    updated: 'Updated {when}',
    words: { one: '1 word', other: '# words' },
    commit: 'commit',
    copyPath: 'Copy the path {path}',
    openGithub: 'Open in GitHub',
    twin: 'Doc language',
    twinNames: { ar: 'العربية', en: 'English' },
    outline: 'In this doc',
    referencedBy: 'Referenced by',
    notReferenced: 'No card references this doc yet.',
    sectionLink: 'Link to the section {name}',
    copyCode: 'Copy code',
    card: 'Doc card',
    excerptNote: 'Lab mock: shortened sample text. The real file is in Git.',
    emptyTitle: 'No docs indexed',
    emptyBody: 'Add a docs folder source in Settings.',
    emptyAction: 'Open sources',
    errorThing: 'the docs',
    loading: 'Loading the docs',
    notFound: 'This doc does not exist',
    notFoundBody: 'Its file may have moved or been removed. Pick a doc from the tree.',
  },
};

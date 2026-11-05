import type { PluralForms } from '../../kit';

interface Dict {
  title: string;
  metaOwner: PluralForms;
  metaOther: string;
  openLab: string;
  filters: { app: string; status: string };
  apps: Record<'web' | 'dashboard' | 'hub', string>;
  brief: Record<'brief' | 'researching' | 'designing' | 'decided' | 'ported', string>;
  briefLabel: string;
  live: string;
  versions: PluralForms;
  hidden: PluralForms;
  showAllPages: string;
  onlyThisPage: string;
  railLabel: string;
  score: string;
  scoreOf: string;
  basedOn: string;
  noShot: string;
  enlarge: string;
  shotAlt: string;
  compareWithBase: string;
  addToCompare: string;
  removeFromCompare: string;
  ownerDecides: string;
  components: PluralForms;
  noComponents: string;
  bar: { pickOne: string; pickAnother: string; ready: string; open: string; clear: string; label: string };
  emptyTitle: string;
  emptyBody: string;
  emptyCmd: string;
  noMatchTitle: string;
  noMatchBody: string;
  clearFilters: string;
  errorThing: string;
  loading: string;
  compare: {
    title: string;
    description: string;
    versionA: string;
    versionB: string;
    swap: string;
    device: string;
    fill: string;
    lang: string;
    theme: string;
    light: string;
    dark: string;
    arabic: string;
    english: string;
    mode: string;
    split: string;
    curtain: string;
    showing: string;
    sync: string;
    notes: string;
    closest: string;
    noShot: string;
    noShotBody: string;
    openInLab: string;
    curtainLabel: string;
    close: string;
    a: string;
    b: string;
    noScore: string;
  };
  sheet: {
    enlarge: string;
    markPortedRef: string;
    markPortedHint: string;
    refRequired: string;
    savePorted: string;
    reviewTitle: string;
    copyCode: string;
    closeReview: string;
    noShots: string;
  };
}

export const messages: { ar: Dict; en: Dict } = {
  ar: {
    title: 'إعادة التصميم',
    metaOwner: { zero: 'لا نسخ بانتظار رأيك.', one: 'نسخة واحدة بانتظار رأيك.', two: 'نسختان بانتظار رأيك.', few: '# نسخ بانتظار رأيك.', many: '# نسخة بانتظار رأيك.', other: '# نسخة بانتظار رأيك.' },
    metaOther: 'صفحات المختبر ونسخها. القرار للمالك، والمقارنة للجميع.',
    openLab: 'افتح المختبر',
    filters: { app: 'التطبيق', status: 'الحالة' },
    apps: { web: 'الموقع', dashboard: 'لوحة التحكم', hub: 'Hub' },
    brief: { brief: 'موجز', researching: 'بحث', designing: 'تصميم', decided: 'حُسم', ported: 'نُقل' },
    briefLabel: 'مرحلة الصفحة',
    live: 'الصفحة الحية',
    versions: { one: 'نسخة واحدة', two: 'نسختان', few: '# نسخ', many: '# نسخة', other: '# نسخة' },
    hidden: { one: 'صفحة أخرى بلا نسخ بهذه الحالة', two: 'صفحتان أخريان بلا نسخ بهذه الحالة', few: '# صفحات أخرى بلا نسخ بهذه الحالة', many: '# صفحة أخرى بلا نسخ بهذه الحالة', other: '# صفحة أخرى بلا نسخ بهذه الحالة' },
    showAllPages: 'اعرض كل الصفحات',
    onlyThisPage: 'اعرض هذه الصفحة وحدها',
    railLabel: 'نسخ {page} من الأقدم إلى الأحدث',
    score: 'تقييم المراجعة',
    scoreOf: 'تقييم المراجعة {score} من 100',
    basedOn: 'مبنية على {base}',
    noShot: 'لا لقطات لهذه النسخة بعد',
    enlarge: 'كبّر لقطة {version}',
    shotAlt: 'لقطة من {version}',
    compareWithBase: 'قارن مع الأساس',
    addToCompare: 'أضف {version} إلى المقارنة',
    removeFromCompare: 'أزل {version} من المقارنة',
    ownerDecides: 'القرار للمالك',
    components: { zero: 'لا تمس مكونات مشتركة', one: 'تمس مكونًا واحدًا', two: 'تمس مكونين', few: 'تمس # مكونات', many: 'تمس # مكونًا', other: 'تمس # مكون' },
    noComponents: 'لا تمس مكونات مشتركة',
    bar: { pickOne: 'اختر نسختين لتقارن بينهما.', pickAnother: 'اختر نسخة ثانية من {page}.', ready: '{a} مع {b}', open: 'قارن', clear: 'ألغِ الاختيار', label: 'اختيار المقارنة' },
    emptyTitle: 'لا صفحات في المختبر بعد',
    emptyBody: 'أنشئ موجز صفحة في apps/lab، كما يشرح redesign-workflow.',
    emptyCmd: 'apps/lab',
    noMatchTitle: 'لا نسخ بهذه الفلاتر',
    noMatchBody: 'جرّب حالة أخرى، أو اعرض كل النسخ.',
    clearFilters: 'أزل الفلاتر',
    errorThing: 'صفحات المختبر',
    loading: 'جارٍ تحميل صفحات المختبر',
    compare: {
      title: 'قارن نسختين',
      description: 'المقاس واللغة والمظهر تسري على النسختين معًا.',
      versionA: 'النسخة الأولى',
      versionB: 'النسخة الثانية',
      swap: 'بدّل بين النسختين',
      device: 'المقاس',
      fill: 'كامل',
      lang: 'اللغة',
      theme: 'المظهر',
      light: 'فاتح',
      dark: 'داكن',
      arabic: 'عربي',
      english: 'إنجليزي',
      mode: 'طريقة العرض',
      split: 'جنبًا إلى جنب',
      curtain: 'ستارة',
      showing: 'النسخة المعروضة',
      sync: 'تمرير متزامن',
      notes: 'الملاحظات',
      closest: 'لا لقطة بهذه الإعدادات، والأقرب {name}',
      noShot: 'لا لقطات لهذه النسخة',
      noShotBody: 'افتحها في المختبر لتراها بالحجم الحقيقي.',
      openInLab: 'افتح في المختبر',
      curtainLabel: 'موضع الستارة بين النسختين',
      close: 'إغلاق المقارنة',
      a: 'أ',
      b: 'ب',
      noScore: 'لا مراجعة بعد',
    },
    sheet: {
      enlarge: 'كبّر {name}',
      markPortedRef: 'مرجع النقل',
      markPortedHint: 'بالصيغة: branch@sha (repo)',
      refRequired: 'اكتب مرجع النقل.',
      savePorted: 'سجّل النقل',
      reviewTitle: 'مراجعة {version}',
      copyCode: 'انسخ الكود',
      closeReview: 'إغلاق',
      noShots: 'لا لقطات لهذه النسخة بعد.',
    },
  },
  en: {
    title: 'Redesign',
    metaOwner: { zero: 'No versions wait for your verdict.', one: 'One version waits for your verdict.', other: '# versions wait for your verdict.' },
    metaOther: 'Lab pages and their versions. The owner decides, and anyone can compare.',
    openLab: 'Open lab',
    filters: { app: 'App', status: 'Status' },
    apps: { web: 'Web', dashboard: 'Dashboard', hub: 'Hub' },
    brief: { brief: 'Brief', researching: 'Researching', designing: 'Designing', decided: 'Decided', ported: 'Ported' },
    briefLabel: 'Page stage',
    live: 'Live page',
    versions: { one: '1 version', other: '# versions' },
    hidden: { one: '1 more page has no version in this status', other: '# more pages have no version in this status' },
    showAllPages: 'Show all pages',
    onlyThisPage: 'Show only this page',
    railLabel: 'Versions of {page}, oldest to newest',
    score: 'Review score',
    scoreOf: 'Review score {score} out of 100',
    basedOn: 'Based on {base}',
    noShot: 'No screenshots for this version yet',
    enlarge: 'Enlarge the {version} screenshot',
    shotAlt: 'Screenshot of {version}',
    compareWithBase: 'Compare with base',
    addToCompare: 'Add {version} to compare',
    removeFromCompare: 'Remove {version} from compare',
    ownerDecides: 'Owner decides',
    components: { zero: 'Touches no shared components', one: 'Touches 1 component', other: 'Touches # components' },
    noComponents: 'Touches no shared components',
    bar: { pickOne: 'Pick two versions to compare.', pickAnother: 'Pick a second version of {page}.', ready: '{a} with {b}', open: 'Compare', clear: 'Clear selection', label: 'Compare selection' },
    emptyTitle: 'No lab pages yet',
    emptyBody: 'Create a page brief in apps/lab, as the redesign-workflow skill explains.',
    emptyCmd: 'apps/lab',
    noMatchTitle: 'No versions match these filters',
    noMatchBody: 'Try another status, or show every version.',
    clearFilters: 'Clear filters',
    errorThing: 'lab pages',
    loading: 'Loading lab pages',
    compare: {
      title: 'Compare two versions',
      description: 'Size, language and theme apply to both versions.',
      versionA: 'First version',
      versionB: 'Second version',
      swap: 'Swap the two versions',
      device: 'Size',
      fill: 'Fill',
      lang: 'Language',
      theme: 'Theme',
      light: 'Light',
      dark: 'Dark',
      arabic: 'Arabic',
      english: 'English',
      mode: 'View',
      split: 'Side by side',
      curtain: 'Curtain',
      showing: 'Showing',
      sync: 'Sync scroll',
      notes: 'Notes',
      closest: 'No shot with these settings. Closest: {name}',
      noShot: 'No screenshots for this version',
      noShotBody: 'Open it in the lab to see it at real size.',
      openInLab: 'Open in lab',
      curtainLabel: 'Curtain position between the two versions',
      close: 'Close compare',
      a: 'A',
      b: 'B',
      noScore: 'Not reviewed yet',
    },
    sheet: {
      enlarge: 'Enlarge {name}',
      markPortedRef: 'Port reference',
      markPortedHint: 'In the form: branch@sha (repo)',
      refRequired: 'Write the port reference.',
      savePorted: 'Record the port',
      reviewTitle: 'Review of {version}',
      copyCode: 'Copy code',
      closeReview: 'Close',
      noShots: 'No screenshots for this version yet.',
    },
  },
};

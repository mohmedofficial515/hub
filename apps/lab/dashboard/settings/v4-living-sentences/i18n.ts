/**
 * All visible text of v4 "Living sentences". `en` has exactly the shape of `ar` (the compiler checks it).
 *
 * Sentence templates (`book`) use a tiny syntax, parsed by parts/sentence.tsx:
 *   {field.key}            the field's live value as an editable token
 *   {field.key:noun}       a number with the noun forms of `nouns[noun]` (Arabic: one, two, few, many, other)
 *   {field.key?yes|no}     a boolean (or set / not set) as a phrase
 *   {=name}                a computed, read-only phrase (parts/templates.ts COMPUTED)
 *   {@.suffix} / {#title}  in the gateway template: the subsection's key prefix / its title
 * A `book` entry is a string, a list of strings (one sentence per line) or an object of variants picked by
 * parts/templates.ts VARIANTS. Arabic nouns that follow a preposition use the genitive dual (يومين، ساعتين).
 */

type Noun = { one: string; two: string; few: string; many: string; other: string };
type Rel = { to: string; why: string };
type Phrases = Record<string, Record<string, Record<string, string>>>;

const ar = {
  ui: {
    skip: 'تخطَّ إلى المحتوى',
    bookTitle: 'كتاب السياسات',
    bookLede:
      'كل قاعدة تحكم المنصة، مكتوبة كما تعمل الآن. القيم المظلّلة حيّة: اضغط أي قيمة لتفتح موضعها وتعدّلها.',
    bookState: '{groups} في {chapters}. {attention} منها تحتاج انتباهك، و{changed} تختلف عن الافتراضي.',
    contents: 'الفهرس',
    openContents: 'افتح الفهرس',
    closeContents: 'أغلق الفهرس',
    chapters: [
      'الفصل الأول',
      'الفصل الثاني',
      'الفصل الثالث',
      'الفصل الرابع',
      'الفصل الخامس',
      'الفصل السادس',
      'الفصل السابع',
      'الفصل الثامن',
    ],
    prefs: 'تفضيلاتي',
    prefsSub: 'هذا المتصفح فقط',
    outsideBook: 'خارج الكتاب',
    searchLabel: 'ابحث في الإعدادات',
    searchPlaceholder: 'ابحث في الكتاب: قاعدة، قيمة، مفتاح…',
    searchKey: '/',
    clearSearch: 'امسح البحث',
    filtersLabel: 'صفِّ النتائج',
    filters: {
      all: 'الكل',
      changed: 'تختلف عن الافتراضي',
      unsaved: 'لم تُحفظ',
      proposed: 'مقترحة',
      risky: 'حساسة',
    },
    resultsTitle: 'نتائج البحث',
    resultsCount: '{fields} في {groups}.',
    noResultsTitle: 'لا شيء يطابق «{q}»',
    noResultsHelp: 'جرّب كلمة أقصر، أو الكلمة بالإنجليزية، أو جزءًا من المفتاح التقني مثل lockout أو refund.',
    noResultsFilter: 'لا حقول بهذا الوصف الآن.',
    tryThese: 'جرّب:',
    suggestions: ['القفل', 'المحفظة', 'الهامش', 'CAPTCHA', 'واتساب'],
    open: 'افتح',
    openGroup: 'افتح «{name}»',
    byline: 'النسخة {v}، عدّلها {by} {when}.',
    bylineSpecial: 'صفحة خاصة، آخر تعديل {when} بواسطة {by}.',
    bylineDiff: 'تختلف عن الافتراضي في {n}.',
    bylineSame: 'كل قيمها على الافتراضي.',
    newBadge: 'جديد',
    newNote: 'غير موجودة في لوحة التحكم بعد',
    ownerOnly: 'للمالك فقط',
    draftBadge: 'مسودة ({n})',
    pendingBadge: 'بانتظار موافقة ثانية',
    seeAlso: 'انظر أيضًا',
    note: 'ملاحظة',
    attention: 'يحتاج انتباهك',
    history: 'سجل التعديلات',
    advanced: 'عرض متقدم',
    advancedOn: 'العرض المتقدم مفعّل: كل حقل في صف مستقل',
    details: 'تفاصيل',
    advancedFold: 'إعدادات متقدمة ({n})',
    resetSection: 'أعِد القسم للافتراضي',
    resetField: 'أعِد للافتراضي',
    default: 'الافتراضي',
    isDefault: 'على الافتراضي',
    changedFromDefault: 'يختلف عن الافتراضي',
    unsaved: 'تعديل لم يُحفظ',
    proposed: 'مقترح',
    proposedTip: 'حقل مقترح ({id}، أولوية {p}): ليس في الواجهة البرمجية بعد.',
    needsBackend: 'يحتاج عملًا في الخادم، لا حقلًا جديدًا فقط.',
    deprecated: 'قديم',
    deprecatedTip: 'مقترح إيقافه: يبقى للعرض حتى يُحذف من الخادم.',
    readOnly: 'للعرض فقط',
    readOnlyTip: 'تحدّده المنصة أو الخادم، ولا يُعدَّل من هنا.',
    structured: 'يُحرَّر في محرّر مخصّص',
    openEditor: 'افتح المحرّر',
    editorStub: 'محرّر القواعد صفحة مستقلة في لوحة التحكم، ولا يحاكيه المختبر.',
    itemsCount: '{n} عنصر',
    controlMoney: 'ضابط مالي: يحتاج صلاحية settings.write_controls.',
    controlSecurity: 'ضابط أمني: يطبّقه المالك، أو ينتظر موافقة مسؤول ثانٍ.',
    twoPerson: 'يمرّ بمسار الشخصين.',
    riskHigh: 'تغيير حساس: يطلب تأكيدًا مكتوبًا قبل الحفظ.',
    storedIn: 'يُحفظ في مجموعة {g}.',
    templateKey: 'قالب الرسالة: {k}',
    technicalKey: 'المفتاح التقني',
    copyLink: 'انسخ رابط الحقل',
    copied: 'نسخنا رابط الحقل.',
    done: 'تم',
    range: 'بين {min} و{max}',
    rangeMin: 'من {min} فأكثر',
    rangeMax: 'حتى {max}',
    leaveEmpty: 'بلا قيمة',
    setValue: 'حدّد قيمة',
    decrease: 'أنقص',
    increase: 'زِد',
    add: 'أضف',
    addPlaceholder: 'اكتب ثم اضغط Enter',
    remove: 'احذف {x}',
    moveUp: 'انقل {x} للأعلى',
    moveDown: 'انقل {x} للأسفل',
    emptyList: 'القائمة فارغة.',
    secretSaved: 'لا يظهر السر المحفوظ مرة أخرى أبدًا، بل آخر أربعة أحرف منه فقط.',
    secretReplace: 'مفتاح جديد',
    secretReplacePh: 'الصق المفتاح الجديد',
    reveal: 'أظهر ما تكتبه',
    hide: 'أخفِ ما تكتبه',
    revealOwnerOnly: 'إظهار المفتاح للمالك فقط.',
    urlInvalid: 'رابط غير صالح: يجب أن يبدأ بـ https://',
    openUrl: 'افتح الرابط',
    copyValue: 'انسخ القيمة',
    valueCopied: 'نسخنا القيمة.',
    on: 'مفعّل',
    off: 'معطّل',
    saveBar: '{n} بانتظار الحفظ في «{group}»',
    saveBarRestore: 'استعادة النسخة {v} بانتظار الحفظ',
    discard: 'تجاهل',
    review: 'راجِع واحفظ',
    reviewApproval: 'راجِع وأرسل للموافقة',
    discarded: 'تجاهلنا التغييرات غير المحفوظة في «{group}».',
    undo: 'تراجع',
    reviewTitle: 'راجع قبل الحفظ',
    reviewLede: 'هكذا تُقرأ القاعدة الآن، وهكذا ستُقرأ بعد الحفظ.',
    before: 'الآن',
    after: 'بعد الحفظ',
    changeLine: '«{label}» من {from} إلى {to}.',
    restoreNote: 'استعادة النسخة {from}: تُحفظ كنسخة جديدة {to}، ولا يُحذف شيء من السجل.',
    approvalNote: 'هذه المجموعة تحتاج موافقة ثانية: سينتظر التغيير مسؤولًا ثانيًا قبل أن يُطبَّق.',
    securityConfirm: 'أفهم أن هذا يغيّر ضابطًا أمنيًا.',
    typeConfirm: 'تغيير حساس. اكتب «{word}» للتأكيد.',
    typeConfirmLabel: 'اكتب للتأكيد',
    reason: 'سبب التغيير (اختياري)',
    reasonHelp: 'يظهر في السجل. {n} من 500 حرف.',
    saveAs: 'احفظ كنسخة {v}',
    sendApproval: 'أرسل للموافقة',
    backToEdit: 'رجوع للتعديل',
    saved: 'حفظنا «{group}» كنسخة {v}.',
    sent: 'أرسلنا التغيير للموافقة الثانية.',
    riskBadge: 'حساس',
    securityBadge: 'ضابط أمني',
    moneyBadge: 'ضابط مالي',
    pendingTitle: 'طلب تغيير ينتظر موافقة مسؤول ثانٍ',
    pendingBody: 'أُرسل {when}. القيم أدناه هي المعمول بها حتى يوافق أحد.',
    withdraw: 'اسحب الطلب',
    withdrawn: 'سحبنا طلب التغيير.',
    historyTitle: 'سجل «{group}»',
    historyLede: 'كل نسخة محفوظة، من الأحدث. الاستعادة تنشئ نسخة جديدة ولا تمحو شيئًا.',
    versionN: 'النسخة {v}',
    current: 'الحالية',
    restore: 'استعد هذه النسخة',
    restoreHint: 'تُنشئ النسخة {v}',
    entryBy: '{by}، {when}',
    viaRequest: 'طُبّقت عبر الطلب {id} بموافقة {by}.',
    historyChange: '«{label}» صار {to} بعد أن كان {from}.',
    historyEmpty: 'لا سجل محفوظًا لهذه المجموعة في البيانات التجريبية. النسخة الحالية {v}، وأول حفظ من هنا يبدأ السجل.',
    restoreSame: 'هذه النسخة مطابقة للحالية: لا شيء للاستعادة.',
    restoreStaged: 'جهّزنا النسخة {v} كمسودة. راجعها ثم احفظها.',
    you: 'أنت',
    prefsTitle: 'تفضيلاتي',
    prefsLede: 'تخص هذا المتصفح وحده وتُطبَّق لحظة تغييرها، بلا زر حفظ.',
    applied: 'طُبّق الآن',
    resetPara: 'أعِد الفقرة للافتراضي',
    frameNote: 'يظهر أثر النمط والتخطيط ولون الشريط الجانبي في إطار اللوحة، لا في هذه الصفحة.',
    loading: 'نحمّل كتاب السياسات…',
    emptyTitle: 'لا توجد إعدادات لتعرضها',
    emptyBody:
      'حسابك يقرأ الإعدادات، لكن الخادم لم يُرجع أي مجموعة. اطلب من المالك صلاحية settings.read على المجموعات التي تحتاجها.',
    errorTitle: 'تعذّر تحميل كتاب السياسات',
    errorBody: 'لم يرد الخادم خلال 10 ثوانٍ. تحقّق من الاتصال ثم أعد المحاولة؛ لا يضيع أي تعديل محفوظ.',
    retry: 'أعد المحاولة',
    forbiddenTitle: 'هذه الصفحة للمالك فقط',
    backToBook: 'عُد إلى الكتاب',
    hiddenPages: 'مخفي عنك لأنه يحتاج صلاحية المالك: {names}.',
    hiddenSub: 'هذا القسم مخفي عنك: يحتاج صلاحية المالك (settings.provider_credentials).',
    labTitle: 'معاينة المختبر',
    labNote: 'للمختبر فقط، لا يظهر في اللوحة.',
    labViewer: 'من يقرأ',
    labOwner: 'المالك',
    labStaff: 'موظف بلا صلاحيات المالك',
    labState: 'حالة التحميل',
    labReady: 'جاهزة',
    labLoading: 'تحميل',
    labEmpty: 'فارغة',
    labError: 'خطأ',
    waSend: 'أرسل رسالة تجريبية',
    waSending: 'نرسل…',
    waSent: 'وصلت الرسالة التجريبية إلى {phone} (محاكاة).',
    waNeedPhone: 'اكتب رقم هاتف أولًا في الجملة أعلاه.',
    waNote: 'الرسالة التجريبية لا تُحفظ في الإعدادات.',
    legendTitle: 'كيف تقرأ الصفحة',
    legendValue: 'قيمة حيّة: اضغطها لتعدّلها',
    legendDot: 'نقطة: تختلف عن الافتراضي',
    legendMarker: 'تظليل: تعديل لم يُحفظ',
    legendDashed: 'إطار متقطع: حقل مقترح',
    pathSep: '›',
    back: 'رجوع',
    chapterOf: '{chapter}: {title}',
    groupsIn: '{n} مجموعات',
    restoreFrom: 'من النسخة {v}',
    pendingChanges: '{n} في الطلب',
    linkTo: 'افتح «{name}» عند هذه القيمة',
    pressToEdit: 'اضغط للتعديل',
    noneShort: '—',
  },

  words: {
    on: 'مفعّل',
    off: 'معطّل',
    yes: 'نعم',
    no: 'لا',
    none: 'لا شيء',
    notSet: 'غير محدد',
    noLimit: 'بلا حد',
    empty: 'فارغ',
    emptyList: 'لا شيء',
    notSaved: 'غير محفوظ',
    listSep: '، ',
    listAnd: ' و',
    ladderSep: ' ثم ',
    more: ' و{n} أخرى',
    percent: '{n}٪',
    usdShort: '{n} دولار',
    lines: '{n} سطر',
  },

  /** Unit words for steppers (the unit the value is stored in). */
  units: {
    ms: 'مللي ثانية',
    seconds: 'ثانية',
    minutes: 'دقيقة',
    hours: 'ساعة',
    days: 'يوم',
    months: 'شهر',
    percent: '٪',
    points: 'نقطة',
    count: '',
    bytes: 'بايت',
    ratio: '',
    score: 'درجة',
    USD: 'USD',
  },

  nouns: {
    ms: { one: '1 مللي ثانية', two: '2 مللي ثانية', few: 'مللي ثانية', many: 'مللي ثانية', other: 'مللي ثانية' },
    second: { one: 'ثانية', two: 'ثانيتين', few: 'ثوانٍ', many: 'ثانية', other: 'ثانية' },
    minute: { one: 'دقيقة', two: 'دقيقتين', few: 'دقائق', many: 'دقيقة', other: 'دقيقة' },
    hour: { one: 'ساعة', two: 'ساعتين', few: 'ساعات', many: 'ساعة', other: 'ساعة' },
    day: { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يومًا', other: 'يوم' },
    businessDay: { one: 'يوم عمل', two: 'يومي عمل', few: 'أيام عمل', many: 'يوم عمل', other: 'يوم عمل' },
    month: { one: 'شهر', two: 'شهرين', few: 'أشهر', many: 'شهرًا', other: 'شهر' },
    year: { one: 'سنة', two: 'سنتين', few: 'سنوات', many: 'سنة', other: 'سنة' },
    dollar: { one: 'دولار واحد', two: 'دولارين', few: 'دولارات', many: 'دولارًا', other: 'دولار' },
    point: { one: 'نقطة واحدة', two: 'نقطتين', few: 'نقاط', many: 'نقطة', other: 'نقطة' },
    failedAttempt: {
      one: 'محاولة فاشلة واحدة',
      two: 'محاولتين فاشلتين',
      few: 'محاولات فاشلة',
      many: 'محاولة فاشلة',
      other: 'محاولة فاشلة',
    },
    failedSignin: {
      one: 'محاولة دخول فاشلة واحدة',
      two: 'محاولتي دخول فاشلتين',
      few: 'محاولات دخول فاشلة',
      many: 'محاولة دخول فاشلة',
      other: 'محاولة دخول فاشلة',
    },
    account: { one: 'حساب واحد', two: 'حسابين', few: 'حسابات', many: 'حسابًا', other: 'حساب' },
    card: { one: 'بطاقة واحدة', two: 'بطاقتين', few: 'بطاقات', many: 'بطاقة', other: 'بطاقة' },
    payment: { one: 'دفعة واحدة', two: 'دفعتين', few: 'دفعات', many: 'دفعة', other: 'دفعة' },
    decline: {
      one: 'عملية مرفوضة واحدة',
      two: 'عمليتين مرفوضتين',
      few: 'عمليات مرفوضة',
      many: 'عملية مرفوضة',
      other: 'عملية مرفوضة',
    },
    code: { one: 'رمز واحد', two: 'رمزين', few: 'رموز', many: 'رمزًا', other: 'رمز' },
    time: { one: 'مرة واحدة', two: 'مرتين', few: 'مرات', many: 'مرة', other: 'مرة' },
    passenger: { one: 'مسافر واحد', two: 'مسافرين اثنين', few: 'مسافرين', many: 'مسافرًا', other: 'مسافر' },
    infant: { one: 'رضيع واحد', two: 'رضيعين', few: 'رضّع', many: 'رضيعًا', other: 'رضيع' },
    result: { one: 'نتيجة واحدة', two: 'نتيجتين', few: 'نتائج', many: 'نتيجة', other: 'نتيجة' },
    search: { one: 'عملية بحث واحدة', two: 'عمليتي بحث', few: 'عمليات بحث', many: 'عملية بحث', other: 'عملية بحث' },
    message: { one: 'رسالة واحدة', two: 'رسالتين', few: 'رسائل', many: 'رسالة', other: 'رسالة' },
    alert: { one: 'تنبيه واحد', two: 'تنبيهين', few: 'تنبيهات', many: 'تنبيهًا', other: 'تنبيه' },
    hold: { one: 'حجزًا مؤقتًا واحدًا', two: 'حجزين مؤقتين', few: 'حجوزات مؤقتة', many: 'حجزًا مؤقتًا', other: 'حجز مؤقت' },
    topup: { one: 'شحنة واحدة', two: 'شحنتين', few: 'شحنات', many: 'شحنة', other: 'شحنة' },
    digit: { one: 'رقم واحد', two: 'رقمين', few: 'أرقام', many: 'رقمًا', other: 'رقم' },
    row: { one: 'صف واحد', two: 'صفين', few: 'صفوف', many: 'صفًا', other: 'صف' },
    specialRule: {
      one: 'قاعدة خاصة واحدة',
      two: 'قاعدتين خاصتين',
      few: 'قواعد خاصة',
      many: 'قاعدة خاصة',
      other: 'قاعدة خاصة',
    },
    fieldNom: { one: 'حقل واحد', two: 'حقلان', few: 'حقول', many: 'حقلًا', other: 'حقل' },
    groupNom: { one: 'مجموعة واحدة', two: 'مجموعتان', few: 'مجموعات', many: 'مجموعة', other: 'مجموعة' },
    groupGen: { one: 'مجموعة واحدة', two: 'مجموعتين', few: 'مجموعات', many: 'مجموعة', other: 'مجموعة' },
    chapterGen: { one: 'فصل واحد', two: 'فصلين', few: 'فصول', many: 'فصلًا', other: 'فصل' },
    valueNom: { one: 'قيمة واحدة', two: 'قيمتان', few: 'قيم', many: 'قيمة', other: 'قيمة' },
    valueGen: { one: 'قيمة واحدة', two: 'قيمتين', few: 'قيم', many: 'قيمة', other: 'قيمة' },
    changeNom: { one: 'تغيير واحد', two: 'تغييران', few: 'تغييرات', many: 'تغييرًا', other: 'تغيير' },
  } satisfies Record<string, Noun>,

  countries: {
    TR: 'تركيا',
    SA: 'السعودية',
    AE: 'الإمارات',
    EG: 'مصر',
    KW: 'الكويت',
    QA: 'قطر',
    BH: 'البحرين',
    OM: 'عُمان',
    JO: 'الأردن',
    GB: 'المملكة المتحدة',
    US: 'الولايات المتحدة',
    DE: 'ألمانيا',
  } as Record<string, string>,

  /** Readable words for enum values inside a sentence, when the option label does not fit the grammar. `*.x` matches any prefix. */
  phrases: {
    maintenance: {
      scope: { full: 'المنصة كلها', areas: 'أقسام محددة' },
      'window.startsAt': { __null: 'غير محددة' },
      'window.endsAt': { __null: 'غير محددة' },
    },
    security: {
      'loginAlerts.admin': { always: 'عند كل دخول', new_device_or_location: 'عند الدخول من جهاز أو موقع جديد', off: 'متوقفة' },
      'loginAlerts.customer': { always: 'عند كل دخول', new_device_or_location: 'عند الدخول من جهاز أو موقع جديد', off: 'متوقفة' },
      'adminIpAllowlist.cidrs': { __empty: 'لا شبكات بعد' },
    },
    abuse_protection: {
      'otpCountries.mode': { all: 'كل الدول', allow: 'الدول المدرجة فقط', deny: 'كل الدول عدا المدرجة' },
      'otpCountries.countries': { __empty: 'فارغة' },
      'signup.existingEmail': {
        generic: 'الرد نفسه الذي يراه أي مسجّل جديد',
        explicit: 'ردًا صريحًا بأن البريد مستخدم',
      },
    },
    refund_policy: {
      destination: { CUSTOMER_CHOICE: 'المحفظة أو البطاقة، كما يختار العميل' },
      'failedBooking.mode': { CUSTOMER_CHOICE: 'يختار العميل أين يُعاد المبلغ' },
      'failedBooking.walletIncentivePercent': { __null: 'بلا مكافأة' },
    },
    fraud_policy: {
      'threeDs.mode': { ALWAYS: 'في كل دفعة', ABOVE_AMOUNT: 'فوق مبلغ محدد', RISK_BASED: 'حسب درجة الخطورة' },
      'blocklist.emailDomains': { __empty: 'لا شيء بعد' },
      'blocklist.cardIssuerCountries': { __empty: 'لا شيء بعد' },
    },
    payment_methods: {
      'fallback.method': { card: 'البطاقة' },
    },
    markup_rules: {
      rulesSource: { settings: 'هذه الإعدادات', table: 'جداول التسعير' },
      'defaultRule.maxUsd': { __null: 'مفتوح' },
    },
    tax: {
      mode: { NONE: 'بلا ضريبة', VAT: 'بضريبة القيمة المضافة' },
      'legalEntity.taxId': { __null: 'غير مسجّل بعد' },
    },
    flight_guards: {
      'duplicateBooking.policy': { off: 'لا إجراء', warn: 'تحذير الموظف والعميل', block: 'منع الحجز' },
      'searchCoalescing.scope': { visitor: 'الزائر نفسه فقط', everyone: 'الجميع' },
      'searchGuard.lookToBookAlertRatio': { __null: 'بلا حد' },
    },
    loyalty: {
      'pending.releaseAfter': { DEPARTURE: 'المغادرة', RETURN: 'العودة' },
      'clawback.uncovered': { CARRY_DEBT: 'يُسجَّل دينًا على العميل', WRITE_OFF: 'يُشطب' },
    },
    payment_gateways: {
      '*.source': { dashboard: 'محفوظة هنا في لوحة التحكم', environment: 'من ملف الخادم (.env)', none: 'غير مضبوطة بعد' },
      '*.mode': { test: 'الاختبار', live: 'الإنتاج', unknown: 'غير معروف' },
    },
    whatsapp_provider: {
      status: {
        working: 'يعمل',
        starting: 'قيد التشغيل',
        disabled: 'متوقف',
        notConfigured: 'غير مضبوط',
        unlinked: 'مفصول عن الهاتف',
        error: 'متعطّل',
      },
      lastErrorAt: { __null: 'لا يوجد' },
      'test.phone': { __null: 'رقم لم يُكتب بعد' },
    },
    fx: {
      'rounding.mode': { ceil: 'للأعلى', half_up: 'لأقرب قيمة', floor: 'للأسفل' },
    },
    e_invoicing: {
      sellerTaxOffice: { __empty: 'فارغ' },
    },
    accounting_access: {
      '*.buyerName': { visible: 'ظاهرًا', masked: 'مخفيًا جزئيًا', removed: 'محذوفًا' },
      '*.buyerEmail': { visible: 'ظاهرًا', masked: 'مخفيًا جزئيًا', removed: 'محذوفًا' },
      '*.customerEmail': { visible: 'ظاهرًا', masked: 'مخفيًا جزئيًا', removed: 'محذوفًا' },
    },
    'prefs:appearance': {
      theme: { light: 'الفاتح', dark: 'الداكن', system: 'الذي يتبع الجهاز' },
    },
    'prefs:tables': {
      'tableSettings.density': { comfortable: 'مريحة', standard: 'عادية', compact: 'مضغوطة' },
    },
  } as Phrases,

  book: {
    platform: {
      summary: 'تعمل المنصة باسم {siteName}، بلغة افتراضية هي {defaultLocale} وعملة {defaultCurrency}. والتقارير بتوقيت {timezone}.',
      region: 'يرى الزائر الجديد اللغة {defaultLocale} أولًا، واللغات المتاحة {supportedLocales}. العملة الافتراضية {defaultCurrency}، والتقارير بتوقيت {timezone}.',
    },
    maintenance: {
      summary:
        '[[enabled|وضع الصيانة {enabled} الآن على {scope}، ويرى العملاء رسالة بعنوان {title.ar}.]][[!enabled&window.startsAt|وضع الصيانة {enabled}. النافذة القادمة تبدأ {window.startsAt} وتنتهي {window.endsAt}.]][[!enabled&!window.startsAt|وضع الصيانة {enabled}، ولا نافذة مجدولة.]]',
      switch: 'وضع الصيانة {enabled}.[[scope=full| عند تشغيله تُغلق {scope} أمام العملاء.]][[scope=areas| عند تشغيله تُغلق {scope} فقط: {areas}.]]',
      schedule:
        '[[window.startsAt|تبدأ النافذة {window.startsAt} وتنتهي {window.endsAt}.]][[!window.startsAt|لا نافذة مجدولة بعد.]] والإعلان المسبق {announce.enabled}[[announce.enabled|، ويظهر قبل البداية بمدة {announce.leadMinutes}]]. نتوقف عن قبول العمليات الجديدة قبل البداية بمدة {drainMinutes}. ونطلب من الزوار إعادة المحاولة بعد {retryAfterMinutes}.',
      message: 'يرى العملاء رسالة بعنوان {title.ar}، {showContacts?ومعها بيانات التواصل|دون بيانات التواصل}.',
      team: 'أثناء الصيانة تبقى لوحة التحكم {allowAdmins?متاحة للفريق|مغلقة حتى أمام الفريق}.',
    },
    security: {
      summary:
        '[[lockout.enabled|يُقفل الحساب بعد {lockout.maxFailures:failedAttempt} خلال {lockout.windowMinutes}.]][[!lockout.enabled|القفل بعد المحاولات الفاشلة {lockout.enabled}.]] وقائمة عناوين IP للموظفين {adminIpAllowlist.enabled?مفعّلة|معطّلة}، وروابط الدخول صالحة لمدة {magicLink.ttlMinutes}.',
      staff:
        'قائمة عناوين IP للموظفين {adminIpAllowlist.enabled?مفعّلة|معطّلة}[[adminIpAllowlist.enabled|: لا تُفتح لوحة التحكم إلا من {adminIpAllowlist.cidrs}]][[!adminIpAllowlist.enabled|، فيدخل الموظفون من أي شبكة]]. [[loginAlerts.admin!=off|ونرسل للموظفين تنبيه دخول {loginAlerts.admin}.]][[loginAlerts.admin=off|وتنبيهات الدخول للموظفين {loginAlerts.admin}.]] تبقى دعوة الموظف صالحة لمدة {invites.ttlHours}، وكلمة المرور المؤقتة لمدة {invites.temporaryPasswordTtlHours}. وتنتهي جلسة الموظف بعد {adminSession.idleTimeoutMinutes} من الخمول، أو بعد {adminSession.maxSessionHours} على الأكثر.',
      lockout:
        'القفل بعد المحاولات الفاشلة {lockout.enabled}.[[lockout.enabled| بعد {lockout.maxFailures:failedAttempt} خلال {lockout.windowMinutes} يُقفل الحساب. وتطول مدة القفل في كل مرة: {lockout.backoffMinutes}. يُصفَّر العدّاد بعد {lockout.resetAfterHours}، و{lockout.notify?يُرسَل بريد إلى المالك عند كل قفل|لا يُبلَّغ المالك بالقفل}.]][[!lockout.enabled| لا يُقفل أي حساب مهما تكررت المحاولات الفاشلة.]]',
      customer:
        'الدخول برقم الهاتف {phoneLogin.enabled}، والتسجيل بالهاتف {phoneLogin.signupEnabled}. وروابط الدخول السحرية {magicLink.enabled?مفعّلة|معطّلة}[[magicLink.enabled|، وتبقى صالحة لمدة {magicLink.ttlMinutes}]]. [[loginAlerts.customer!=off|ونرسل للعملاء تنبيه دخول {loginAlerts.customer}.]][[loginAlerts.customer=off|وتنبيهات الدخول للعملاء {loginAlerts.customer}.]] ونطلب إعادة الدخول للعمليات الحساسة إذا مضى على آخر دخول أكثر من {recentAuthMinutes}.',
      history: 'نحتفظ بعمليات الدخول الناجحة لمدة {loginHistory.successRetentionDays}، والفاشلة لمدة {loginHistory.failureRetentionDays}.',
    },
    verification_policy: {
      summary:
        '{requireVerifiedEmailForBooking?لا يحجز إلا من وثّق بريده|يحجز العميل دون توثيق بريده}. ورمز التحقق من {otp.length:digit} صالح لمدة {otp.ttlSeconds}، ويصل عبر {phoneOtpChannel}.',
    },
    abuse_protection: {
      summary:
        'حدود رموز الهاتف {otpBudget.enabled?مطبّقة|متوقفة}، وCAPTCHA {captcha.enabled?يُطلب بعد الفشل المتكرر|لا يُطلب}، وكلمات المرور المسرّبة {breachedPasswords.enabled?مرفوضة|مقبولة}.',
      otp:
        'حدود رموز الهاتف {otpBudget.enabled?مطبّقة|متوقفة}.[[otpBudget.enabled| لا نرسل أكثر من {otpBudget.phoneDailyLimit:code} يوميًا لكل الأرقام، و{otpBudget.perCallingCodeDailyLimit:code} لكل مفتاح دولة. وننبّه الفريق عند بلوغ {otpBudget.alertAtPercent} من أي حد.]][[!otpBudget.enabled| لا سقف يوميًا لرسائل الرموز.]] وتُرسل الرموز إلى {otpCountries.mode}[[otpCountries.mode!=all|: {otpCountries.countries}]].',
      signup:
        'كلمات المرور المسرّبة {breachedPasswords.enabled?مرفوضة عند التسجيل وتغيير كلمة المرور|مقبولة}. ومن يسجّل ببريد مستخدم يرى {signup.existingEmail}، و{signup.notifyExistingOwner?نُبلغ صاحب الحساب|لا نُبلغ صاحب الحساب}.',
      captcha:
        'CAPTCHA {captcha.enabled}.[[captcha.enabled| يظهر بعد {captcha.failuresPerIpBeforeChallenge:failedAttempt} من عنوان IP واحد خلال {captcha.windowMinutes}، و{captcha.alwaysOnSignup?عند كل تسجيل جديد أيضًا|لا يظهر عند التسجيل الجديد}.]][[!captcha.enabled| لا يُطلب من أحد مهما تكررت المحاولات الفاشلة.]]',
      refresh: 'يتجدّد الدخول {refreshLimits.perSessionPerMinute:time} في الدقيقة على الأكثر لكل جهاز، و{refreshLimits.perIpPerMinute:time} لكل عنوان IP.',
    },
    security_alerts: {
      summary:
        'تنبيه موجات الأمان {enabled}[[enabled|: ننبّه الفريق عند {failedAdminLogins:failedSignin} على لوحة التحكم خلال {windowMinutes}]].',
    },
    account: {
      summary: 'يُحذف الحساب نهائيًا بعد مهلة {deletion.graceDays}، ورابط تصدير البيانات صالح لمدة {export.linkTtlDays}.',
    },
    travellers: {
      summary: 'يحفظ العميل حتى {maxTravellers:passenger}، ونطلب جوازًا صالحًا {passportValidityMonths} بعد السفر على الأقل.',
    },
    loyalty: {
      summary:
        'برنامج الولاء {enabled}.[[enabled| يكسب العميل {pointsPerUsd:point} عن كل دولار، وقيمة النقطة {redemption.pointValueUsd}.]][[enabled&expiry.enabled| وتنتهي النقاط بعد {expiry.monthsAfterEarn}.]][[!enabled| لا يكسب العملاء نقاطًا ولا يستبدلونها.]]',
      programme: 'برنامج الولاء {enabled}[[enabled|، وتُضاف النقاط عند {earnTrigger}]].',
      earning: 'يكسب العميل {pointsPerUsd:point} عن كل دولار، وتُضرب نقاط الطيران في {multipliers.byProduct.FLIGHT} إضافية.',
      tiers: [
        '**المستوى الأزرق** يبدأ من {tiers.0.threshold.amount}، ويضرب النقاط في {tiers.0.multiplier}[[tiers.0.discountPercent|، ويخصم {tiers.0.discountPercent} من الهامش]]، ويدوم {tiers.0.validityMonths}.',
        '**المستوى الفضي** يبدأ من {tiers.1.threshold.amount}، ويضرب النقاط في {tiers.1.multiplier}[[tiers.1.discountPercent|، ويخصم {tiers.1.discountPercent} من الهامش]]، ويدوم {tiers.1.validityMonths}.',
        '**المستوى الذهبي** يبدأ من {tiers.2.threshold.amount}، ويضرب النقاط في {tiers.2.multiplier}[[tiers.2.discountPercent|، ويخصم {tiers.2.discountPercent} من الهامش]]، ويدوم {tiers.2.validityMonths}.',
      ],
      redemption:
        'الاستبدال {redemption.enabled}.[[redemption.enabled| قيمة النقطة {redemption.pointValueUsd}، وأقل ما يُستبدل {redemption.minPoints:point}. وأكثره {redemption.maxPointsPerRedemption:point} في المرة الواحدة، ولا تغطي النقاط أكثر من {redemption.maxPercentOfBookingTotal} من الحجز.]][[!redemption.enabled| يجمع العملاء النقاط ولا يستخدمونها.]]',
      expiry:
        'انتهاء النقاط {expiry.enabled}.[[expiry.enabled| تنتهي النقطة بعد {expiry.monthsAfterEarn} من كسبها، ونذكّر العميل {expiry.reminderDaysBefore} قبل الانتهاء.]][[!expiry.enabled| تبقى النقاط صالحة بلا مدة.]]',
      pending:
        'النقاط المكتسبة {pending.enabled?تبقى معلّقة|تُتاح فورًا}[[pending.enabled| حتى {pending.daysAfterTravel} بعد {pending.releaseAfter}، أو {pending.fallbackDays} إذا لم يُعرف تاريخ السفر]]. وإذا أُلغي الحجز نسترجع النقاط {clawback.fromOtherPoints?من النقاط الأخرى أولًا|دون المساس بالنقاط الأخرى}، {clawback.fromWallet?ثم من المحفظة|ولا نقترب من المحفظة}. وما يبقى دون تغطية {clawback.uncovered}.',
      grants: 'منح الموظفين للنقاط {manualGrantRequiresApproval?يحتاج موافقة ثانية|لا يحتاج موافقة ثانية}، وأكبر منحة {maxManualGrantPoints:point}.',
    },
    payment_methods: {
      summary: 'البوابات المفعّلة: {=enabledGateways}. والبوابة الاحتياطية {fallback.gateway}، والدفع من المحفظة {walletPayments.enabled}.',
      gateways: [
        '**Stripe** {gateways.0.enabled?مفعّلة|متوقفة}[[gateways.0.enabled|: {gateways.0.methods} بعملات {gateways.0.currencies}]].',
        '**MyFatoorah** {gateways.1.enabled?مفعّلة|متوقفة}[[gateways.1.enabled|: {gateways.1.methods} بعملات {gateways.1.currencies}]].',
        '**Paymob** {gateways.2.enabled?مفعّلة|متوقفة}[[gateways.2.enabled|: {gateways.2.methods} بعملات {gateways.2.currencies}]].',
        '**Moyasar** {gateways.3.enabled?مفعّلة|متوقفة}[[gateways.3.enabled|: {gateways.3.methods} بعملات {gateways.3.currencies}]].',
        '**Tap** {gateways.4.enabled?مفعّلة|متوقفة}[[gateways.4.enabled|: {gateways.4.methods} بعملات {gateways.4.currencies}]].',
        '**PayTR** {gateways.5.enabled?مفعّلة|متوقفة}[[gateways.5.enabled|: {gateways.5.methods} بعملات {gateways.5.currencies}]].',
        '**iyzico** {gateways.6.enabled?مفعّلة|متوقفة}[[gateways.6.enabled|: {gateways.6.methods} بعملات {gateways.6.currencies}]].',
      ],
      rules: 'إذا لم تنطبق أي قاعدة ظهور نعرض {fallback.gateway} بطريقة {fallback.method}.',
      wallet:
        'الدفع من المحفظة {walletPayments.enabled}.[[walletPayments.enabled&walletPayments.allowPartial| والدفع الجزئي منها {walletPayments.allowPartial?مسموح|ممنوع} ابتداءً من {walletPayments.minPartialUsd}.]][[walletPayments.enabled&!walletPayments.allowPartial| والدفع الجزئي منها {walletPayments.allowPartial?مسموح|ممنوع}: يُدفع الحجز كاملًا من المحفظة أو لا يُدفع منها.]][[!walletPayments.enabled| لا يستطيع العملاء استخدام رصيدهم في الحجز.]]',
    },
    payment_gateways: {
      summary: 'بوابات مفاتيحها مضبوطة: {=configuredGateways}. وبوابات في وضع الإنتاج: {=liveGateways}.',
      gateway: '**{#title}**: المفاتيح {@.source}[[@.mode!=unknown|، والحساب في وضع {@.mode}]][[@.mode=unknown|، ووضع الحساب {@.mode}]].',
    },
    refund_policy: {
      summary:
        'يُعاد مبلغ الإلغاء إلى {destination}، ويصل استرداد البطاقة خلال {refundProcessingDays:businessDay}.[[approvalThresholdUsd| وما فوق {approvalThresholdUsd} يحتاج موافقة ثانية.]][[!approvalThresholdUsd| وكل استرداد يحتاج موافقة ثانية.]]',
      destination:
        'يُعاد مبلغ الحجز الملغى إلى {destination}.[[destination=WALLET&walletIncentivePercent| ويحصل العميل على مكافأة {walletIncentivePercent} فوق المبلغ.]][[destination=CUSTOMER_CHOICE&walletIncentivePercent| ومن يختار المحفظة يحصل على مكافأة {walletIncentivePercent} فوق المبلغ.]][[destination!=ORIGINAL_METHOD&!walletIncentivePercent| ولا مكافأة على المحفظة ({walletIncentivePercent}).]]',
      automation:
        'حين تلغي شركة الطيران الرحلة نردّ المبلغ {autoRefundOnSupplierCancellation?تلقائيًا|بعد مراجعة موظف}. ويصل استرداد البطاقة خلال {refundProcessingDays:businessDay} تقريبًا.',
      approvals:
        '[[approvalThresholdUsd|أي استرداد يتجاوز {approvalThresholdUsd} يحتاج موافقة موظف ثانٍ.]][[!approvalThresholdUsd|كل استرداد يحتاج موافقة موظف ثانٍ، فالحد {approvalThresholdUsd}.]] والتسويات خارج المنصة {offlineSettlement.approvalRequired?تحتاج موظفًا ثانيًا|لا تحتاج موظفًا ثانيًا}[[offlineSettlement.approvalRequired| إذا تجاوزت {offlineSettlement.approvalThresholdUsd}]].',
      failed:
        '[[failedBooking.mode=CUSTOMER_CHOICE|إذا فشل الحجز بعد الدفع {failedBooking.mode} خلال {failedBooking.choiceWindowHours}، وإلا أعدناه إلى {failedBooking.defaultChoice}.]][[failedBooking.mode!=CUSTOMER_CHOICE|إذا فشل الحجز بعد الدفع يُعاد المبلغ دائمًا إلى {failedBooking.mode}.]][[failedBooking.mode!=ORIGINAL_METHOD&failedBooking.walletIncentivePercent| ومن يأخذه في المحفظة يحصل على مكافأة {failedBooking.walletIncentivePercent}.]]',
      topups: [
        'شحن المحفظة {allowWalletTopup}[[allowWalletTopup|: من {walletTopUp.minUsd} إلى {walletTopUp.maxUsd} في المرة]][[!allowWalletTopup|: لا يستطيع العملاء إضافة رصيد بالبطاقة]].',
        '[[allowWalletTopup|الحد اليومي {walletTopUp.dailyMaxUsd}، و{walletTopUp.maxTopUpsPerDay:topup} على الأكثر.]]',
        '[[allowWalletTopup|{walletTopUp.requireVerifiedEmail?لا يشحن إلا من وثّق بريده|يشحن العميل ولو لم يوثّق بريده}.]]',
        '[[allowWalletTopup|الحساب الجديد في أول {walletTopUp.newAccountDays}: حتى {walletTopUp.newAccountMaxUsd} في المرة، و{walletTopUp.newAccountTotalMaxUsd} طوال الفترة.]]',
      ],
      funds: 'تُصرف أموال المحفظة بهذا الترتيب: {walletFunds.spendOrder}.',
    },
    fraud_policy: {
      summary:
        'مراجعة المخاطر {review.enabled?مفعّلة|متوقفة}[[review.enabled|: ينتظر موظفًا كل حجز تبلغ خطورته {review.reviewScore}]]. ونطلب 3-D Secure {threeDs.mode}، وتجربة البطاقات {cardTesting.enabled?تُرصد وتُحظر|لا تُرصد}.',
      review:
        'مراجعة المخاطر {review.enabled?مفعّلة|متوقفة}.[[review.enabled| كل حجز تبلغ درجة خطورته {review.reviewScore} أو أكثر ينتظر موظفًا قبل إصدار التذكرة. ونذكّر الفريق إذا انتظر أكثر من {review.reminderMinutes}.]][[!review.enabled| تصدر التذاكر دون انتظار موظف، مهما كانت درجة الخطورة.]]',
      rules: [
        '**البطاقة المشتركة بين الحسابات** {rules.cardSharedAcrossAccounts.enabled?مفعّلة|متوقفة}[[rules.cardSharedAcrossAccounts.enabled|: إذا ظهرت البطاقة نفسها على أكثر من {rules.cardSharedAcrossAccounts.maxAccounts:account} خلال {rules.cardSharedAcrossAccounts.windowHours} أضفنا {rules.cardSharedAcrossAccounts.score:point}]][[!rules.cardSharedAcrossAccounts.enabled|، فلا تُحتسب نقاطها]].',
        '**بطاقات كثيرة على حساب واحد** {rules.cardsPerAccount.enabled?مفعّلة|متوقفة}[[rules.cardsPerAccount.enabled|: إذا أُضيف أكثر من {rules.cardsPerAccount.maxCards:card} إلى الحساب نفسه خلال {rules.cardsPerAccount.windowHours} أضفنا {rules.cardsPerAccount.score:point}]][[!rules.cardsPerAccount.enabled|، فلا تُحتسب نقاطها]].',
        '**حسابات كثيرة من جهاز واحد** {rules.accountsPerDevice.enabled?مفعّلة|متوقفة}[[rules.accountsPerDevice.enabled|: إذا فُتح أكثر من {rules.accountsPerDevice.maxAccounts:account} من الجهاز نفسه خلال {rules.accountsPerDevice.windowHours} أضفنا {rules.accountsPerDevice.score:point}]][[!rules.accountsPerDevice.enabled|، فلا تُحتسب نقاطها]].',
        '**دفعات كثيرة من عنوان IP واحد** {rules.paymentsPerIp.enabled?مفعّلة|متوقفة}[[rules.paymentsPerIp.enabled|: إذا جاء أكثر من {rules.paymentsPerIp.maxPayments:payment} من العنوان نفسه خلال {rules.paymentsPerIp.windowHours} أضفنا {rules.paymentsPerIp.score:point}]][[!rules.paymentsPerIp.enabled|، فلا تُحتسب نقاطها]].',
        '**اختلاف الدولة** {rules.countryMismatch.enabled?مفعّلة|متوقفة}[[rules.countryMismatch.enabled|: إذا اختلفت دولة البطاقة عن دولة العميل أضفنا {rules.countryMismatch.score:point}]][[!rules.countryMismatch.enabled|، فلا تُحتسب نقاطها]].',
        '**السفر القريب** {rules.sameDayTravel.enabled?مفعّلة|متوقفة}[[rules.sameDayTravel.enabled|: إذا كان السفر خلال {rules.sameDayTravel.withinHours} من الحجز أضفنا {rules.sameDayTravel.score:point}]][[!rules.sameDayTravel.enabled|، فلا تُحتسب نقاطها]].',
        '**المبلغ الكبير** {rules.highAmount.enabled?مفعّلة|متوقفة}[[rules.highAmount.enabled|: إذا بلغ المبلغ {rules.highAmount.amountUsd} أو أكثر أضفنا {rules.highAmount.score:point}]][[!rules.highAmount.enabled|، فلا تُحتسب نقاطها]].',
        '**دون نقل المسؤولية** {rules.noLiabilityShift.enabled?مفعّلة|متوقفة}[[rules.noLiabilityShift.enabled|: إذا لم تنتقل المسؤولية إلى البنك أضفنا {rules.noLiabilityShift.score:point}]][[!rules.noLiabilityShift.enabled|، فلا تُحتسب نقاطها]].',
      ],
      blocklists: 'نطاقات البريد المحظورة: {blocklist.emailDomains}. ودول إصدار البطاقات التي تُحال للمراجعة: {blocklist.cardIssuerCountries}.',
      threeDs:
        'نطلب 3-D Secure {threeDs.mode}[[threeDs.mode=ABOVE_AMOUNT|: كل دفعة من {threeDs.aboveUsd} فأكثر]][[threeDs.mode=RISK_BASED|: كل دفعة تبلغ درجة خطورتها {threeDs.riskScore} فأكثر]].',
      cardTesting: [
        'رصد تجربة البطاقات {cardTesting.enabled}[[!cardTesting.enabled|: لا نعدّ البطاقات المرفوضة ولا نحظر أحدًا]].',
        '[[cardTesting.enabled|نحظر بعد {cardTesting.maxDeclinesPerSession:decline} في جلسة الدفع الواحدة.]]',
        '[[cardTesting.enabled|أو بعد {cardTesting.maxDeclinesPerAccount:decline} على الحساب خلال {cardTesting.accountWindowHours}.]]',
        '[[cardTesting.enabled|أو بعد {cardTesting.maxDeclinesPerIp:decline} من عنوان IP خلال {cardTesting.ipWindowMinutes}.]]',
        '[[cardTesting.enabled|يدوم الحظر {cardTesting.blockMinutes}.]]',
        '[[cardTesting.enabled|إذا بلغ الرفض على المنصة {cardTesting.waveDeclines:decline} خلال {cardTesting.waveWindowMinutes} عددناه موجة ونبّهنا الفريق.]]',
      ],
    },
    disputes: {
      summary:
        'النزاع المفتوح {freezeWalletOnOpen?يجمّد المحفظة|لا يجمّد المحفظة} و{freezePointsOnOpen?يجمّد النقاط|لا يجمّد النقاط}. ونذكّر الفريق قبل الموعد النهائي بمدة {reminderHoursBeforeDue}.',
    },
    markup_rules: {
      summary:
        '[[defaultRule.mode=percentage|الهامش الافتراضي {defaultRule.percent} من سعر المورّد]][[defaultRule.mode=fixed|الهامش الافتراضي {defaultRule.fixedUsd} على كل حجز]][[defaultRule.mode=both|الهامش الافتراضي {defaultRule.percent} زائد {defaultRule.fixedUsd} على كل حجز]]، مع {=ruleCount} تُفحص قبله.',
      source: 'تُقرأ قواعد الهامش من {rulesSource}.',
      default:
        'الهامش الافتراضي {defaultRule.mode}[[defaultRule.mode=percentage|: {defaultRule.percent} من سعر المورّد]][[defaultRule.mode=fixed|: {defaultRule.fixedUsd} على كل حجز]][[defaultRule.mode=both|: {defaultRule.percent} زائد {defaultRule.fixedUsd}]].[[defaultRule.mode!=fixed| لا يقل عن {defaultRule.minUsd}، وسقفه {defaultRule.maxUsd}.]] ويُقرَّب إلى أقرب {defaultRule.roundTo}.',
      rules: 'نفحص {=ruleCount} بالترتيب قبل الهامش الافتراضي، وأول قاعدة تنطبق هي التي تُطبَّق.',
    },
    fx: {
      summary: 'نأخذ أسعار الصرف من {provider} ونحدّثها كل {refreshIntervalMinutes}. ونضيف هامش أمان {safetyMarginPercent}، ونقرّب {rounding.mode}.',
    },
    tax: {
      summary:
        'نعمل {mode}[[mode=NONE|: نصدر إيصالات لا فواتير ضريبية]][[mode=VAT|، ونصدر باسم {legalEntity.name} فواتير ضريبية]]. والأسعار {pricesIncludeTax?شاملة الضريبة|قبل الضريبة}، والرقم الضريبي {legalEntity.taxId}.',
      seller: 'نبيع باسم {legalEntity.name} المسجّلة في {legalEntity.country}، ورقمها الضريبي {legalEntity.taxId}. وتصل الفواتير من {legalEntity.email}.',
      mode: 'نعمل {mode}، والأسعار المعروضة {pricesIncludeTax?شاملة الضريبة|قبل الضريبة}. ورسوم الخدمة {showServiceFeeLine?تظهر في بند مستقل|مدمجة في السعر}.',
      numbering:
        'تبدأ الإيصالات بـ{numbering.receiptPrefix} والفواتير الضريبية بـ{numbering.invoicePrefix}. والإشعارات الدائنة بـ{numbering.creditNotePrefix} وإيصالات الاسترداد بـ{numbering.refundReceiptPrefix}. {numbering.yearlyReset?ويبدأ الترقيم من جديد كل سنة|ويستمر الترقيم دون إعادة}.',
    },
    e_invoicing: {
      summary: 'إرسال المستندات الإلكترونية {enabled}، والمزوّد على الخادم {provider}. ومكتب الضرائب {sellerTaxOffice}.',
    },
    finance_ledger: {
      summary:
        'دفتر القيد المزدوج {enabled?يسجّل القيود|متوقف}، والإقفال اليومي {dailyCloseEnabled}[[dailyCloseEnabled| وينبّه عند فرق يتجاوز {differenceThresholdUsd}]].',
    },
    money_check: {
      summary: 'فحص الأموال اليومي {enabled?يعمل|متوقف}[[enabled|، ويُعدّ الاسترداد عالقًا بعد {refundOpenHours}]].',
    },
    accounting_access: {
      summary: 'يرى المحاسب اسم المشتري {fields.buyerName} وبريده {fields.buyerEmail}، وبريد العميل {fields.customerEmail}.',
    },
    agent_booking_policy: {
      summary:
        'تعديل الموظف للسعر {priceAdjustApprovalRequired?يحتاج موافقة ثانية|لا يحتاج موافقة}[[priceAdjustApprovalRequired| إذا تجاوز {maxAdjustPercentWithoutApproval} من الإجمالي]]. والدفعة اليدوية {manualPaymentApprovalRequired?تحتاج موافقة ثانية|لا تحتاج موافقة}[[manualPaymentApprovalRequired| فوق {manualPaymentApprovalThresholdUsd}]].',
    },
    agent_payment_policy: {
      summary:
        'يبقى رابط الدفع صالحًا {paymentLinkMinMinutes} على الأقل. وحد الموظف اليومي من محفظة العميل {walletOnBehalfDailyCapUsd}، وما فوق {walletOnBehalfApprovalThresholdUsd} يحتاج موافقة ثانية.',
    },
    post_booking_services_policy: {
      summary: 'إضافة الموظف للخدمات بعد الحجز {staffAddEnabled?مسموحة|متوقفة}[[staffAddEnabled|، ويبقى عرض السعر قابلًا للدفع لمدة {staffQuoteMinutes}]].',
    },
    flights: {
      summary: 'يُثبَّت السعر لمدة {priceLockMinutes}، وتبقى صفحة الدفع مفتوحة لمدة {checkoutTtlMinutes}. ونقبل حتى {maxPassengers:passenger} في الحجز الواحد.',
      checkout:
        'يُثبَّت السعر لمدة {priceLockMinutes} بعد اختيار الرحلة، وتبقى صفحة الدفع مفتوحة لمدة {checkoutTtlMinutes}. ولا نقبل حجزًا قبل الإقلاع بأقل من {bookingCutoffMinutes}.',
      price: 'إذا تغيّر السعر بعد الدفع بما لا يتجاوز {priceChangeToleranceUsd} نتحمّل الفرق ونكمل الحجز.',
      aic: 'تغييرات شركة الطيران البسيطة حتى {minorAicThresholdMinutes} {autoAcceptMinorAic?تُقبل تلقائيًا|تنتظر موظفًا}.',
      search: 'يقبل البحث حتى {maxPassengers:passenger} و{maxInfantsPerAdult:infant} لكل بالغ. ويعرض درجات {allowedCabinClasses}، وحتى {searchResultsLimit:result}.',
      calendar:
        'تقويم الأسعار {fareCalendar.enabled}.[[fareCalendar.enabled| يبقى السعر حديثًا لمدة {fareCalendar.freshnessSeconds}، ونبحث حيًا في {fareCalendar.liveProbeDays} حول التاريخ المختار. وحدّ البحث {fareCalendar.maxProbesPerMinute:search} في الدقيقة للمنصة، و{fareCalendar.probesPerVisitor:search} لكل زائر.]][[!fareCalendar.enabled| لا يرى العملاء أسعار الأيام المجاورة.]]',
    },
    flight_provider: {
      summary:
        'البحث لدى المورّد {searchEnabled?مفتوح|مغلق} والحجز {bookingEnabled?مفتوح|مغلق}. والحجز المؤقت {holdPolicy.enabled?مسموح|ممنوع}[[holdPolicy.enabled| حتى {holdPolicy.maxHoldHours}]]، ورسوم الإلغاء {cancellationPolicy.feeUsd}.',
    },
    flight_guards: {
      summary:
        'مراقبة رصيد المورّد {supplierBalance.enabled?مفعّلة|متوقفة}[[supplierBalance.enabled| وتنبّه تحت {supplierBalance.lowBalanceUsd}]]. وعند تكرار المسافر في حجز آخر: {duplicateBooking.policy}.',
      balance:
        'مراقبة رصيد المورّد {supplierBalance.enabled?مفعّلة|متوقفة}.[[supplierBalance.enabled&supplierBalance.lastReading.amountUsd| آخر قراءة {supplierBalance.lastReading.amountUsd} في {supplierBalance.lastReading.at}.]][[supplierBalance.enabled| ننبّه حين ينزل الرصيد تحت {supplierBalance.lowBalanceUsd}، أو حين يكفي أقل من {supplierBalance.minCoverDays:day} بمتوسط إنفاق {supplierBalance.consumptionWindowDays}.]][[supplierBalance.enabled| {supplierBalance.pauseConfirmationWhenInsufficient?ونوقف التأكيد مؤقتًا عند نقص الرصيد|ونؤكد الحجوزات حتى لو نقص الرصيد}]][[supplierBalance.enabled&supplierBalance.pauseConfirmationWhenInsufficient|، لمدة أقصاها {supplierBalance.pauseMaxMinutes}]][[supplierBalance.enabled|.]][[!supplierBalance.enabled| لا تنبيه ولا إيقاف مهما انخفض الرصيد.]]',
      search:
        'لكل عنوان IP حد {searchGuard.perIpDailySearches:search} يوميًا، ولكل حساب {searchGuard.perAccountDailySearches:search}. وميزانية المورّد اليومية {searchGuard.dailySupplierSearchBudget:search}.[[searchGuard.lookToBookAlertRatio| وننبّه حين يتجاوز البحث {searchGuard.lookToBookAlertRatio} لكل حجز.]] واختبار التحقق للزوار {searchGuard.captcha.enabled?مفعّل|متوقف}[[searchGuard.captcha.enabled|: يظهر بعد {searchGuard.captcha.guestSearchesBeforeChallenge:search} ويبقى صالحًا لمدة {searchGuard.captcha.passMinutes}]].',
      coalescing: '{searchCoalescing.enabled?نشارك|لا نشارك} نتيجة البحث المتطابق بين الطلبات المتزامنة[[searchCoalescing.enabled|، ويشترك فيها {searchCoalescing.scope}]].',
      duplicates: 'إذا كان المسافر محجوزًا في حجز آخر على الرحلة نفسها: {duplicateBooking.policy}.',
      holds:
        'إذا ترك العميل {holdAbuse.maxExpiredUnpaidInWindow:hold} دون دفع خلال {holdAbuse.abandonmentWindowDays}، نوقف حجزه المؤقت لمدة {holdAbuse.cooldownDays}. وأقصى مقاعد محجوزة مؤقتًا على الرحلة الواحدة: {holdAbuse.maxHeldSeatsPerFlight}.',
    },
    notifications: {
      summary:
        'قنوات الإرسال: البريد {providers.email.enabled}، وواتساب {providers.whatsapp.enabled}، وإشعارات التطبيق {providers.push.enabled?مفعّلة|معطّلة}، والرسائل النصية {providers.sms.enabled?مفعّلة|معطّلة}.[[opsAlerts.enabled| وتصل تنبيهات التشغيل ابتداءً من مستوى {opsAlerts.minSeverity}.]]',
      channels:
        'البريد {providers.email.enabled}[[providers.email.enabled|، ويُرسل باسم {providers.email.fromName} والردود إلى {providers.email.replyTo}]]. وواتساب {providers.whatsapp.enabled}[[providers.whatsapp.enabled| بوتيرة {providers.whatsapp.pacing.perMinute:message} في الدقيقة وتفاوت عشوائي {providers.whatsapp.pacing.jitterPercent}]]. والرسائل النصية {providers.sms.enabled?مفعّلة|معطّلة}، وإشعارات التطبيق {providers.push.enabled?مفعّلة|معطّلة}.',
      quiet: 'ساعات الهدوء {quietHours.enabled?مفعّلة|متوقفة}[[quietHours.enabled|: من {quietHours.start} حتى {quietHours.end} نؤجّل رسائل {quietHours.channels}]].',
      ops:
        'تنبيهات التشغيل {opsAlerts.enabled?مفعّلة|متوقفة}.[[opsAlerts.enabled| تصل إلى {opsAlerts.recipients} ابتداءً من مستوى {opsAlerts.minSeverity} عبر {opsAlerts.channels}. ونجمع التنبيهات المتكررة كل {opsAlerts.throttleMinutes}، وحين تتجاوز {opsAlerts.burstLimit:alert} نعدّها عاصفة ونكتفي بملخص.]][[!opsAlerts.enabled| لا يصل الفريق أي تنبيه عن الأعطال.]]',
      content: 'رسالة تأكيد الحجز {emailContent.showFareRules?تعرض قواعد التذكرة|لا تعرض قواعد التذكرة}.',
      delivery:
        'نحاول إرسال الرسالة {delivery.maxAttempts:time} على الأكثر، بفاصل {delivery.retryBackoffSeconds} بين المحاولات. ونعيد جدولة ما علق أكثر من {delivery.staleAfterSeconds}.',
    },
    whatsapp_provider: {
      summary: 'واتساب عبر {provider} {status}[[lastSuccessAt|، وآخر رسالة أُرسلت {lastSuccessAt}]].',
      status: 'واتساب عبر {provider} {status}.[[lastSuccessAt| آخر رسالة أُرسلت {lastSuccessAt}.]][[lastErrorAt| وآخر إخفاق {lastErrorAt}.]][[!lastErrorAt| ولم يُسجَّل أي إخفاق.]]',
      switch: 'إرسال رسائل واتساب {providers.whatsapp.enabled}[[providers.whatsapp.enabled| بوتيرة {providers.whatsapp.pacing.perMinute:message} في الدقيقة]].',
      webhook: 'إشعارات التسليم من كرتات {webhook.enabled?نستقبلها على الرابط أدناه|لا نستقبلها}.',
      test: 'أرسل رسالة تجريبية إلى {test.phone} باللغة {test.locale}.',
    },
    mobile_app: {
      summary: 'أقدم إصدار مدعوم {ios.minSupportedVersion} على iOS و{android.minSupportedVersion} على Android، وآخر إصدار {ios.latestVersion}.',
    },
    analytics: {
      summary: 'نحتفظ باستدعاءات المورّد لمدة {retention.providerCallDays} وبملخصات البحث لمدة {retention.searchSummaryDays}. والبث الحي {live.enabled}.',
    },
    audit: {
      summary: 'نحتفظ بسجل التدقيق لمدة {retentionDays}، وبنشاط العملاء لمدة {activityRetentionDays}.',
    },
    storage: {
      summary: 'تبقى الملفات المحذوفة في المهملات لمدة {trash.retentionDays} ثم تُمحى.',
    },
    retention: {
      summary:
        'التنظيف الليلي {enabled?يعمل|متوقف}[[enabled|: نحذف الأحداث الداخلية المسلّمة بعد {outboxDeliveredDays} والإشعارات المنتهية بعد {notificationDays}]].',
    },
    'prefs:appearance': {
      main: 'أعرض اللوحة بالوضع {theme} وبلون {colorTheme}، بنمط واجهة {layoutStyle} وتخطيط {layout}. لغة الواجهة {language}، والخط {fontFamily} بحجم {fontSize}. ولون الشريط الجانبي {sidebarCustomBg?مخصّص|يتبع اللون الأساسي}.',
    },
    'prefs:tables': {
      main: 'أعرض الجداول بكثافة {tableSettings.density}، و{tableSettings.pageSize:row} في الصفحة، {tableSettings.striped?مع صفوف متناوبة الألوان|بلا تلوين متناوب}. إخفاء الأعمدة {tableSettings.showColumnVisibility}، وتغيير عرضها {tableSettings.showColumnResize}. وتحديد الصفوف {tableSettings.showRowSelection}، والبحث العام {tableSettings.showGlobalFilter}.',
    },
    'prefs:notifications': {
      main: 'تصلني الإشعارات {notifications.inApp?داخل اللوحة|خارج اللوحة فقط}، و{notifications.email?بالبريد أيضًا|بلا بريد}، و{notifications.push?كإشعارات فورية على الجهاز|بلا إشعارات فورية}، {notifications.sound?مع صوت عند وصولها|بلا صوت}. الفئات التي تهمني: {notifPrefs.categories}.',
    },
  } as Record<string, Record<string, string | string[]>>,

  /** "See also": the overlaps of audit §9.2, so every group appears once and links to its neighbours. */
  related: {
    platform: [{ to: 'maintenance', why: 'إغلاق المنصة أو أقسام منها في نافذة مجدولة.' }],
    maintenance: [
      { to: 'platform', why: 'مفاتيح المنتجات تُطفئ منتجًا كاملًا، لا لفترة.' },
      { to: 'flight_provider', why: 'إيقاف البحث أو الحجز وحده عند المورّد.' },
    ],
    security: [
      { to: 'abuse_protection', why: 'حدود الرموز وCAPTCHA وكلمات المرور المسرّبة.' },
      { to: 'security_alerts', why: 'تنبيه الفريق عند موجة دخول فاشل أو قفل.' },
      { to: 'verification_policy', why: 'التحقق من البريد والهاتف، ومنه المصادقة الثنائية للموظفين.' },
    ],
    verification_policy: [
      { to: 'security', why: 'القفل وقائمة عناوين IP وطرق الدخول.' },
      { to: 'flight_provider', why: 'اشتراط الهاتف الموثّق للحجز المؤقت يُضبط هناك.' },
    ],
    abuse_protection: [
      { to: 'security', why: 'القفل بعد المحاولات الفاشلة.' },
      { to: 'flight_guards', why: 'CAPTCHA البحث يستخدم مفتاح Turnstile نفسه.' },
    ],
    security_alerts: [
      { to: 'security', why: 'القفل الذي تُحسب منه الموجات.' },
      { to: 'notifications', why: 'قنوات تنبيهات التشغيل ومستلموها.' },
    ],
    payment_methods: [
      { to: 'payment_gateways', why: 'المفاتيح، ووضع الاختبار أو الإنتاج.' },
      { to: 'refund_policy', why: 'شحن المحفظة وترتيب صرفها.' },
    ],
    payment_gateways: [{ to: 'payment_methods', why: 'تشغيل البوابة وطرقها وعملاتها.' }],
    refund_policy: [
      { to: 'payment_methods', why: 'الدفع من المحفظة والدفع الجزئي.' },
      { to: 'agent_payment_policy', why: 'حدود الموظف على محفظة العميل.' },
      { to: 'disputes', why: 'ما يجمّده النزاع البنكي.' },
    ],
    fraud_policy: [
      { to: 'abuse_protection', why: 'حماية الدخول والتسجيل.' },
      { to: 'disputes', why: 'ما يحدث بعد النزاع البنكي.' },
    ],
    disputes: [
      { to: 'refund_policy', why: 'المحفظة والاسترداد.' },
      { to: 'fraud_policy', why: 'المراجعة قبل التذكرة.' },
    ],
    markup_rules: [
      { to: 'fx', why: 'هامش الأمان في أسعار الصرف.' },
      { to: 'loyalty', why: 'خصم المستويات يُحسب من الهامش.' },
    ],
    tax: [
      { to: 'e_invoicing', why: 'إرسال المستندات التركية.' },
      { to: 'accounting_access', why: 'ما يراه المحاسب من بيانات المشتري.' },
    ],
    e_invoicing: [{ to: 'tax', why: 'الرقم الضريبي ووضع الضريبة.' }],
    loyalty: [
      { to: 'markup_rules', why: 'الهامش الذي يُخصم منه.' },
      { to: 'disputes', why: 'تجميد النقاط أثناء النزاع.' },
    ],
    agent_booking_policy: [{ to: 'agent_payment_policy', why: 'روابط الدفع وحدود المحفظة.' }],
    agent_payment_policy: [{ to: 'agent_booking_policy', why: 'الموافقة الثانية على الحجوزات.' }],
    post_booking_services_policy: [{ to: 'flight_provider', why: 'مفتاحا «العمليات بعد الحجز» و«الخدمات بعد الحجز» يسبقان هذا المسار.' }],
    flights: [
      { to: 'flight_provider', why: 'الحجز المؤقت والإلغاء والتعديل.' },
      { to: 'flight_guards', why: 'رصيد المورّد وكلفة البحث.' },
    ],
    flight_provider: [
      { to: 'flights', why: 'التسامح مع تغيّر السعر.' },
      { to: 'flight_guards', why: 'تنبيه الرصيد المنخفض الحالي.' },
    ],
    flight_guards: [
      { to: 'flight_provider', why: 'سياسات المورّد نفسه.' },
      { to: 'abuse_protection', why: 'CAPTCHA الدخول.' },
    ],
    notifications: [
      { to: 'whatsapp_provider', why: 'حساب كرتات وحالة الاتصال، ومفتاح واتساب نفسه.' },
      { to: 'security_alerts', why: 'ما يطلق تنبيه الأمان.' },
    ],
    whatsapp_provider: [{ to: 'notifications', why: 'القنوات وأحداث الرسائل.' }],
    finance_ledger: [{ to: 'money_check', why: 'المقارنة اليومية لسجلات الأموال.' }],
    money_check: [{ to: 'finance_ledger', why: 'الإقفال اليومي للدفتر.' }],
    accounting_access: [{ to: 'tax', why: 'بيانات البائع والفواتير.' }],
    retention: [
      { to: 'audit', why: 'سجل التدقيق ونشاط العملاء.' },
      { to: 'analytics', why: 'بيانات التحليلات.' },
    ],
    audit: [{ to: 'retention', why: 'تنظيف جداول البنية التحتية.' }],
    analytics: [{ to: 'retention', why: 'تنظيف جداول البنية التحتية.' }],
  } as Record<string, Rel[]>,
};

export type Messages = typeof ar;

const en: Messages = {
  ui: {
    skip: 'Skip to content',
    bookTitle: 'Policy book',
    bookLede:
      'Every rule that runs the platform, written the way it works right now. Highlighted values are live: press one to open it where it lives and change it.',
    bookState: '{groups} in {chapters}. {attention} need your attention, and {changed} differ from the default.',
    contents: 'Contents',
    openContents: 'Open the contents',
    closeContents: 'Close the contents',
    chapters: ['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5', 'Chapter 6', 'Chapter 7', 'Chapter 8'],
    prefs: 'My preferences',
    prefsSub: 'This browser only',
    outsideBook: 'Outside the book',
    searchLabel: 'Search settings',
    searchPlaceholder: 'Search the book: a rule, a value, a key…',
    searchKey: '/',
    clearSearch: 'Clear the search',
    filtersLabel: 'Narrow the results',
    filters: {
      all: 'All',
      changed: 'Differ from default',
      unsaved: 'Not saved',
      proposed: 'Proposed',
      risky: 'Sensitive',
    },
    resultsTitle: 'Search results',
    resultsCount: '{fields} in {groups}.',
    noResultsTitle: 'Nothing matches “{q}”',
    noResultsHelp: 'Try a shorter word, the word in Arabic, or part of the technical key such as lockout or refund.',
    noResultsFilter: 'No fields fit this description right now.',
    tryThese: 'Try:',
    suggestions: ['lockout', 'wallet', 'markup', 'CAPTCHA', 'WhatsApp'],
    open: 'Open',
    openGroup: 'Open “{name}”',
    byline: 'Version {v}, changed by {by} {when}.',
    bylineSpecial: 'A special page, last changed {when} by {by}.',
    bylineDiff: 'Differs from the default in {n}.',
    bylineSame: 'Every value is on its default.',
    newBadge: 'New',
    newNote: 'Not in the dashboard yet',
    ownerOnly: 'Owner only',
    draftBadge: 'Draft ({n})',
    pendingBadge: 'Awaiting a second approver',
    seeAlso: 'See also',
    note: 'Note',
    attention: 'Needs attention',
    history: 'History',
    advanced: 'Advanced view',
    advancedOn: 'Advanced view is on: every field on its own row',
    details: 'Details',
    advancedFold: 'Advanced settings ({n})',
    resetSection: 'Reset section to default',
    resetField: 'Reset to default',
    default: 'Default',
    isDefault: 'On default',
    changedFromDefault: 'Changed from default',
    unsaved: 'Unsaved change',
    proposed: 'Proposed',
    proposedTip: 'Proposed field ({id}, priority {p}): not in the API yet.',
    needsBackend: 'Needs server work, not just a new field.',
    deprecated: 'Deprecated',
    deprecatedTip: 'Proposed for retirement: shown until the server drops it.',
    readOnly: 'Read only',
    readOnlyTip: 'Set by the platform or the server; not changed here.',
    structured: 'Edited in a dedicated editor',
    openEditor: 'Open the editor',
    editorStub: 'The rules editor is a separate dashboard page; the lab does not simulate it.',
    itemsCount: '{n} items',
    controlMoney: 'Money control: needs settings.write_controls.',
    controlSecurity: 'Security control: the owner applies it, or it waits for a second approver.',
    twoPerson: 'Goes through the two-person path.',
    riskHigh: 'Sensitive change: asks for a typed confirmation before saving.',
    storedIn: 'Stored in the {g} group.',
    templateKey: 'Message template: {k}',
    technicalKey: 'Technical key',
    copyLink: 'Copy field link',
    copied: 'Field link copied.',
    done: 'Done',
    range: 'Between {min} and {max}',
    rangeMin: '{min} or more',
    rangeMax: 'Up to {max}',
    leaveEmpty: 'No value',
    setValue: 'Set a value',
    decrease: 'Decrease',
    increase: 'Increase',
    add: 'Add',
    addPlaceholder: 'Type, then press Enter',
    remove: 'Remove {x}',
    moveUp: 'Move {x} up',
    moveDown: 'Move {x} down',
    emptyList: 'The list is empty.',
    secretSaved: 'A saved secret is never shown again: only its last four characters.',
    secretReplace: 'New key',
    secretReplacePh: 'Paste the new key',
    reveal: 'Show what you type',
    hide: 'Hide what you type',
    revealOwnerOnly: 'Only the owner can show the key.',
    urlInvalid: 'Not a valid link: it must start with https://',
    openUrl: 'Open the link',
    copyValue: 'Copy the value',
    valueCopied: 'Value copied.',
    on: 'on',
    off: 'off',
    saveBar: '{n} waiting to be saved in “{group}”',
    saveBarRestore: 'Restoring version {v}, waiting to be saved',
    discard: 'Discard',
    review: 'Review and save',
    reviewApproval: 'Review and send for approval',
    discarded: 'Discarded the unsaved changes in “{group}”.',
    undo: 'Undo',
    reviewTitle: 'Review before saving',
    reviewLede: 'This is how the rule reads now, and how it will read after saving.',
    before: 'Now',
    after: 'After saving',
    changeLine: '{label}: {from} → {to}.',
    restoreNote: 'Restoring version {from}: it is saved as a new version {to}, and nothing is removed from the history.',
    approvalNote: 'This group needs a second approver: the change waits for another admin before it applies.',
    securityConfirm: 'I understand this changes a security control.',
    typeConfirm: 'Sensitive change. Type “{word}” to confirm.',
    typeConfirmLabel: 'Type to confirm',
    reason: 'Reason for the change (optional)',
    reasonHelp: 'Shown in the history. {n} of 500 characters.',
    saveAs: 'Save as version {v}',
    sendApproval: 'Send for approval',
    backToEdit: 'Back to editing',
    saved: 'Saved “{group}” as version {v}.',
    sent: 'Sent the change for a second approval.',
    riskBadge: 'Sensitive',
    securityBadge: 'Security control',
    moneyBadge: 'Money control',
    pendingTitle: 'A change request waits for a second approver',
    pendingBody: 'Sent {when}. The values below stay in force until someone approves it.',
    withdraw: 'Withdraw the request',
    withdrawn: 'Withdrew the change request.',
    historyTitle: 'History of “{group}”',
    historyLede: 'Every saved version, newest first. Restoring creates a new version and erases nothing.',
    versionN: 'Version {v}',
    current: 'Current',
    restore: 'Restore this version',
    restoreHint: 'Creates version {v}',
    entryBy: '{by}, {when}',
    viaRequest: 'Applied from request {id}, approved by {by}.',
    historyChange: '{label} became {to} (was {from}).',
    historyEmpty: 'The sample data has no history for this group. The current version is {v}; the first save from here starts the history.',
    restoreSame: 'This version matches the current one: nothing to restore.',
    restoreStaged: 'Version {v} is staged as a draft. Review it, then save.',
    you: 'You',
    prefsTitle: 'My preferences',
    prefsLede: 'They belong to this browser only and apply the moment you change them, with no Save button.',
    applied: 'Applied',
    resetPara: 'Reset the paragraph to default',
    frameNote: 'The style, layout and sidebar colour show in the dashboard frame, not on this page.',
    loading: 'Loading the policy book…',
    emptyTitle: 'No settings to show',
    emptyBody:
      'Your account can read settings, but the server returned no group. Ask the owner for settings.read on the groups you need.',
    errorTitle: 'The policy book did not load',
    errorBody: 'The server did not answer within 10 seconds. Check the connection and try again; no saved change is lost.',
    retry: 'Try again',
    forbiddenTitle: 'This page is for the owner only',
    backToBook: 'Back to the book',
    hiddenPages: 'Hidden from you because it needs the owner’s permission: {names}.',
    hiddenSub: 'This section is hidden from you: it needs the owner’s permission (settings.provider_credentials).',
    labTitle: 'Lab preview',
    labNote: 'Lab only; not part of the dashboard.',
    labViewer: 'Who is reading',
    labOwner: 'Owner',
    labStaff: 'Staff without owner rights',
    labState: 'Loading state',
    labReady: 'Ready',
    labLoading: 'Loading',
    labEmpty: 'Empty',
    labError: 'Error',
    waSend: 'Send a test message',
    waSending: 'Sending…',
    waSent: 'The test message reached {phone} (simulated).',
    waNeedPhone: 'Type a phone number in the sentence above first.',
    waNote: 'The test message is not saved in the settings.',
    legendTitle: 'How to read this page',
    legendValue: 'Live value: press it to change it',
    legendDot: 'Dot: differs from the default',
    legendMarker: 'Highlight: unsaved change',
    legendDashed: 'Dashed frame: proposed field',
    pathSep: '›',
    back: 'Back',
    chapterOf: '{chapter}: {title}',
    groupsIn: '{n} groups',
    restoreFrom: 'from version {v}',
    pendingChanges: '{n} in the request',
    linkTo: 'Open “{name}” at this value',
    pressToEdit: 'Press to edit',
    noneShort: '—',
  },

  words: {
    on: 'on',
    off: 'off',
    yes: 'yes',
    no: 'no',
    none: 'none',
    notSet: 'not set',
    noLimit: 'no limit',
    empty: 'empty',
    emptyList: 'none',
    notSaved: 'not saved',
    listSep: ', ',
    listAnd: ' and ',
    ladderSep: ' then ',
    more: ' and {n} more',
    percent: '{n}%',
    usdShort: '${n}',
    lines: '{n} lines',
  },

  units: {
    ms: 'ms',
    seconds: 'seconds',
    minutes: 'minutes',
    hours: 'hours',
    days: 'days',
    months: 'months',
    percent: '%',
    points: 'points',
    count: '',
    bytes: 'bytes',
    ratio: '',
    score: 'score',
    USD: 'USD',
  },

  nouns: {
    ms: { one: '1 ms', two: '2 ms', few: 'ms', many: 'ms', other: 'ms' },
    second: { one: '1 second', two: '2 seconds', few: 'seconds', many: 'seconds', other: 'seconds' },
    minute: { one: '1 minute', two: '2 minutes', few: 'minutes', many: 'minutes', other: 'minutes' },
    hour: { one: '1 hour', two: '2 hours', few: 'hours', many: 'hours', other: 'hours' },
    day: { one: '1 day', two: '2 days', few: 'days', many: 'days', other: 'days' },
    businessDay: { one: '1 business day', two: '2 business days', few: 'business days', many: 'business days', other: 'business days' },
    month: { one: '1 month', two: '2 months', few: 'months', many: 'months', other: 'months' },
    year: { one: '1 year', two: '2 years', few: 'years', many: 'years', other: 'years' },
    dollar: { one: '$1', two: '$2', few: 'USD', many: 'USD', other: 'USD' },
    point: { one: '1 point', two: '2 points', few: 'points', many: 'points', other: 'points' },
    failedAttempt: { one: '1 failed attempt', two: '2 failed attempts', few: 'failed attempts', many: 'failed attempts', other: 'failed attempts' },
    failedSignin: { one: '1 failed sign-in', two: '2 failed sign-ins', few: 'failed sign-ins', many: 'failed sign-ins', other: 'failed sign-ins' },
    account: { one: '1 account', two: '2 accounts', few: 'accounts', many: 'accounts', other: 'accounts' },
    card: { one: '1 card', two: '2 cards', few: 'cards', many: 'cards', other: 'cards' },
    payment: { one: '1 payment', two: '2 payments', few: 'payments', many: 'payments', other: 'payments' },
    decline: { one: '1 decline', two: '2 declines', few: 'declines', many: 'declines', other: 'declines' },
    code: { one: '1 code', two: '2 codes', few: 'codes', many: 'codes', other: 'codes' },
    time: { one: 'once', two: 'twice', few: 'times', many: 'times', other: 'times' },
    passenger: { one: '1 passenger', two: '2 passengers', few: 'passengers', many: 'passengers', other: 'passengers' },
    infant: { one: '1 infant', two: '2 infants', few: 'infants', many: 'infants', other: 'infants' },
    result: { one: '1 result', two: '2 results', few: 'results', many: 'results', other: 'results' },
    search: { one: '1 search', two: '2 searches', few: 'searches', many: 'searches', other: 'searches' },
    message: { one: '1 message', two: '2 messages', few: 'messages', many: 'messages', other: 'messages' },
    alert: { one: '1 alert', two: '2 alerts', few: 'alerts', many: 'alerts', other: 'alerts' },
    hold: { one: '1 hold', two: '2 holds', few: 'holds', many: 'holds', other: 'holds' },
    topup: { one: '1 top-up', two: '2 top-ups', few: 'top-ups', many: 'top-ups', other: 'top-ups' },
    digit: { one: '1 digit', two: '2 digits', few: 'digits', many: 'digits', other: 'digits' },
    row: { one: '1 row', two: '2 rows', few: 'rows', many: 'rows', other: 'rows' },
    specialRule: { one: '1 special rule', two: '2 special rules', few: 'special rules', many: 'special rules', other: 'special rules' },
    fieldNom: { one: '1 field', two: '2 fields', few: 'fields', many: 'fields', other: 'fields' },
    groupNom: { one: '1 group', two: '2 groups', few: 'groups', many: 'groups', other: 'groups' },
    groupGen: { one: '1 group', two: '2 groups', few: 'groups', many: 'groups', other: 'groups' },
    chapterGen: { one: '1 chapter', two: '2 chapters', few: 'chapters', many: 'chapters', other: 'chapters' },
    valueNom: { one: '1 value', two: '2 values', few: 'values', many: 'values', other: 'values' },
    valueGen: { one: '1 value', two: '2 values', few: 'values', many: 'values', other: 'values' },
    changeNom: { one: '1 change', two: '2 changes', few: 'changes', many: 'changes', other: 'changes' },
  },

  countries: {
    TR: 'Türkiye',
    SA: 'Saudi Arabia',
    AE: 'the UAE',
    EG: 'Egypt',
    KW: 'Kuwait',
    QA: 'Qatar',
    BH: 'Bahrain',
    OM: 'Oman',
    JO: 'Jordan',
    GB: 'the United Kingdom',
    US: 'the United States',
    DE: 'Germany',
  },

  phrases: {
    maintenance: {
      scope: { full: 'the whole platform', areas: 'chosen areas' },
      'window.startsAt': { __null: 'not set' },
      'window.endsAt': { __null: 'not set' },
    },
    security: {
      'loginAlerts.admin': { always: 'on every sign-in', new_device_or_location: 'on a new device or location', off: 'off' },
      'loginAlerts.customer': { always: 'on every sign-in', new_device_or_location: 'on a new device or location', off: 'off' },
      'adminIpAllowlist.cidrs': { __empty: 'no networks yet' },
    },
    abuse_protection: {
      'otpCountries.mode': { all: 'every country', allow: 'only the listed countries', deny: 'every country except the listed' },
      'otpCountries.countries': { __empty: 'empty' },
      'signup.existingEmail': {
        generic: 'the same answer as any new sign-up',
        explicit: 'an explicit “e-mail in use” answer',
      },
    },
    refund_policy: {
      destination: { CUSTOMER_CHOICE: 'the wallet or the card, as the customer chooses', ORIGINAL_METHOD: 'the original payment method', WALLET: 'the wallet' },
      'failedBooking.mode': {
        CUSTOMER_CHOICE: 'the customer chooses where the money goes',
        ORIGINAL_METHOD: 'the original payment method',
        WALLET: 'the wallet',
      },
      'failedBooking.defaultChoice': { WALLET: 'the wallet', ORIGINAL_METHOD: 'the original payment method' },
      'failedBooking.walletIncentivePercent': { __null: 'none' },
    },
    fraud_policy: {
      'threeDs.mode': { ALWAYS: 'on every payment', ABOVE_AMOUNT: 'above an amount', RISK_BASED: 'by risk score' },
      'blocklist.emailDomains': { __empty: 'none yet' },
      'blocklist.cardIssuerCountries': { __empty: 'none yet' },
    },
    payment_methods: {
      'fallback.method': { card: 'card' },
    },
    markup_rules: {
      rulesSource: { settings: 'these settings', table: 'the pricing tables' },
      'defaultRule.maxUsd': { __null: 'open' },
    },
    tax: {
      mode: { NONE: 'with no tax', VAT: 'with VAT' },
      'legalEntity.taxId': { __null: 'not registered yet' },
    },
    flight_guards: {
      'duplicateBooking.policy': { off: 'no action', warn: 'warn staff and the customer', block: 'block the booking' },
      'searchCoalescing.scope': { visitor: 'only the same visitor', everyone: 'everyone' },
      'searchGuard.lookToBookAlertRatio': { __null: 'no limit' },
    },
    loyalty: {
      earnTrigger: { BOOKING_CONFIRMED: 'booking is confirmed', BOOKING_PAID: 'booking is paid' },
      'pending.releaseAfter': { DEPARTURE: 'departure', RETURN: 'return' },
      'clawback.uncovered': { CARRY_DEBT: 'carried as a debt', WRITE_OFF: 'written off' },
    },
    payment_gateways: {
      '*.source': { dashboard: 'are saved here in the dashboard', environment: 'come from the server (.env)', none: 'are not set yet' },
      '*.mode': { test: 'test', live: 'live', unknown: 'unknown' },
    },
    whatsapp_provider: {
      status: {
        working: 'working',
        starting: 'starting',
        disabled: 'switched off',
        notConfigured: 'not configured',
        unlinked: 'unlinked from the phone',
        error: 'failing',
      },
      lastErrorAt: { __null: 'none' },
      'test.phone': { __null: 'a number not typed yet' },
    },
    fx: {
      'rounding.mode': { ceil: 'up', half_up: 'to the nearest value', floor: 'down' },
    },
    e_invoicing: {
      sellerTaxOffice: { __empty: 'empty' },
    },
    accounting_access: {
      '*.buyerName': { visible: 'in full', masked: 'partly hidden', removed: 'removed' },
      '*.buyerEmail': { visible: 'in full', masked: 'partly hidden', removed: 'removed' },
      '*.customerEmail': { visible: 'in full', masked: 'partly hidden', removed: 'removed' },
    },
    'prefs:appearance': {
      theme: { light: 'light', dark: 'dark', system: 'system' },
      layoutStyle: { modern: 'modern', classic: 'classic', floating: 'floating' },
      layout: { default: 'default', compact: 'compact', 'no-sidebar': 'no-sidebar' },
      fontSize: { sm: 'small', base: 'normal', lg: 'large', xl: 'extra-large' },
    },
    'prefs:tables': {
      'tableSettings.density': { comfortable: 'comfortable', standard: 'standard', compact: 'compact' },
    },
  },

  book: {
    platform: {
      summary: 'The platform runs as {siteName}, in {defaultLocale} by default and priced in {defaultCurrency}. Reports use {timezone} time.',
      region: 'New visitors see {defaultLocale} first, and the offered languages are {supportedLocales}. The default currency is {defaultCurrency}, and reports use {timezone} time.',
    },
    maintenance: {
      summary:
        '[[enabled|Maintenance mode is {enabled} right now for {scope}, and customers see a message titled {title.en}.]][[!enabled&window.startsAt|Maintenance mode is {enabled}. The next window starts {window.startsAt} and ends {window.endsAt}.]][[!enabled&!window.startsAt|Maintenance mode is {enabled}, with no window scheduled.]]',
      switch: 'Maintenance mode is {enabled}.[[scope=full| When on, it closes {scope} to customers.]][[scope=areas| When on, it closes only {scope}: {areas}.]]',
      schedule:
        '[[window.startsAt|The window starts {window.startsAt} and ends {window.endsAt}.]][[!window.startsAt|No window is scheduled yet.]] The advance banner is {announce.enabled}[[announce.enabled|, shown {announce.leadMinutes} before the start]]. We stop taking new operations {drainMinutes} before the start. Visitors are asked to retry after {retryAfterMinutes}.',
      message: 'Customers see a message titled {title.en}, {showContacts?with our contact details|without our contact details}.',
      team: 'During maintenance the dashboard stays {allowAdmins?open to the team|closed, even to the team}.',
    },
    security: {
      summary:
        '[[lockout.enabled|An account locks after {lockout.maxFailures:failedAttempt} within {lockout.windowMinutes}.]][[!lockout.enabled|Failed-login lockout is {lockout.enabled}.]] The staff IP allow-list is {adminIpAllowlist.enabled}, and sign-in links last {magicLink.ttlMinutes}.',
      staff:
        'The staff IP allow-list is {adminIpAllowlist.enabled}[[adminIpAllowlist.enabled|: the dashboard only opens from {adminIpAllowlist.cidrs}]][[!adminIpAllowlist.enabled|, so staff sign in from any network]]. [[loginAlerts.admin!=off|Staff get a sign-in alert {loginAlerts.admin}.]][[loginAlerts.admin=off|Staff sign-in alerts are {loginAlerts.admin}.]] A staff invitation stays valid for {invites.ttlHours}, and a temporary password for {invites.temporaryPasswordTtlHours}. A staff session ends after {adminSession.idleTimeoutMinutes} idle, or after {adminSession.maxSessionHours} at most.',
      lockout:
        'Failed-login lockout is {lockout.enabled}.[[lockout.enabled| After {lockout.maxFailures:failedAttempt} within {lockout.windowMinutes} the account locks. Each lock lasts longer: {lockout.backoffMinutes}. The count resets after {lockout.resetAfterHours}, and {lockout.notify?the owner gets an e-mail for every lockout|the owner is not told}.]][[!lockout.enabled| No account is ever locked, however many attempts fail.]]',
      customer:
        'Phone sign-in is {phoneLogin.enabled} and phone sign-up is {phoneLogin.signupEnabled}. Magic sign-in links are {magicLink.enabled}[[magicLink.enabled| and stay valid for {magicLink.ttlMinutes}]]. [[loginAlerts.customer!=off|Customers get a sign-in alert {loginAlerts.customer}.]][[loginAlerts.customer=off|Customer sign-in alerts are {loginAlerts.customer}.]] Sensitive actions ask to sign in again when the last sign-in is older than {recentAuthMinutes}.',
      history: 'We keep successful sign-ins for {loginHistory.successRetentionDays} and failed ones for {loginHistory.failureRetentionDays}.',
    },
    verification_policy: {
      summary:
        '{requireVerifiedEmailForBooking?Only customers with a verified e-mail can book|Customers can book without a verified e-mail}. A code of {otp.length:digit} lasts {otp.ttlSeconds} and goes out by {phoneOtpChannel}.',
    },
    abuse_protection: {
      summary:
        'Phone-code limits are {otpBudget.enabled?applied|off}, a CAPTCHA {captcha.enabled?is asked after repeated failures|is never asked}, and breached passwords are {breachedPasswords.enabled?refused|accepted}.',
      otp:
        'Phone-code limits are {otpBudget.enabled?applied|off}.[[otpBudget.enabled| We send no more than {otpBudget.phoneDailyLimit:code} a day across all numbers, and {otpBudget.perCallingCodeDailyLimit:code} per country code. The team is alerted at {otpBudget.alertAtPercent} of any limit.]][[!otpBudget.enabled| There is no daily cap on code messages.]] Codes go to {otpCountries.mode}[[otpCountries.mode!=all|: {otpCountries.countries}]].',
      signup:
        'Breached passwords are {breachedPasswords.enabled?refused at sign-up and password change|accepted}. Someone signing up with an e-mail in use sees {signup.existingEmail}, and we {signup.notifyExistingOwner?tell the account owner|do not tell the account owner}.',
      captcha:
        'CAPTCHA is {captcha.enabled}.[[captcha.enabled| It appears after {captcha.failuresPerIpBeforeChallenge:failedAttempt} from one IP address within {captcha.windowMinutes}, and {captcha.alwaysOnSignup?on every new sign-up too|not on new sign-ups}.]][[!captcha.enabled| Nobody is asked, however many attempts fail.]]',
      refresh: 'A session refreshes at most {refreshLimits.perSessionPerMinute:time} a minute per device and {refreshLimits.perIpPerMinute:time} per IP address.',
    },
    security_alerts: {
      summary: 'Security wave alerts are {enabled}[[enabled|: the team is alerted at {failedAdminLogins:failedSignin} on the dashboard within {windowMinutes}]].',
    },
    account: {
      summary: 'An account is deleted for good after a grace period of {deletion.graceDays}, and a data export link lasts {export.linkTtlDays}.',
    },
    travellers: {
      summary: 'A customer saves up to {maxTravellers:passenger}, and passports must stay valid {passportValidityMonths} after travel.',
    },
    loyalty: {
      summary:
        'The loyalty programme is {enabled}.[[enabled| Customers earn {pointsPerUsd:point} per dollar, and a point is worth {redemption.pointValueUsd}.]][[enabled&expiry.enabled| Points expire after {expiry.monthsAfterEarn}.]][[!enabled| Customers neither earn nor redeem points.]]',
      programme: 'The loyalty programme is {enabled}[[enabled|, and points are credited when the {earnTrigger}]].',
      earning: 'Customers earn {pointsPerUsd:point} per dollar, and flight points are multiplied by an extra {multipliers.byProduct.FLIGHT}.',
      tiers: [
        '**Blue** starts at {tiers.0.threshold.amount}, multiplies points by {tiers.0.multiplier}[[tiers.0.discountPercent|, takes {tiers.0.discountPercent} off the markup]] and lasts {tiers.0.validityMonths}.',
        '**Silver** starts at {tiers.1.threshold.amount}, multiplies points by {tiers.1.multiplier}[[tiers.1.discountPercent|, takes {tiers.1.discountPercent} off the markup]] and lasts {tiers.1.validityMonths}.',
        '**Gold** starts at {tiers.2.threshold.amount}, multiplies points by {tiers.2.multiplier}[[tiers.2.discountPercent|, takes {tiers.2.discountPercent} off the markup]] and lasts {tiers.2.validityMonths}.',
      ],
      redemption:
        'Redemption is {redemption.enabled}.[[redemption.enabled| A point is worth {redemption.pointValueUsd}, and the smallest redemption is {redemption.minPoints:point}. The largest is {redemption.maxPointsPerRedemption:point}, covering no more than {redemption.maxPercentOfBookingTotal} of a booking.]][[!redemption.enabled| Customers collect points but cannot spend them.]]',
      expiry:
        'Points expiry is {expiry.enabled}.[[expiry.enabled| A point expires {expiry.monthsAfterEarn} after it is earned, and we remind the customer {expiry.reminderDaysBefore} before.]][[!expiry.enabled| Points never expire.]]',
      pending:
        'Earned points {pending.enabled?stay pending|are available at once}[[pending.enabled| until {pending.daysAfterTravel} after {pending.releaseAfter}, or {pending.fallbackDays} when the travel date is unknown]]. When a booking is cancelled we take points back {clawback.fromOtherPoints?from other points first|without touching other points}, {clawback.fromWallet?then from the wallet|never from the wallet}. Anything left uncovered is {clawback.uncovered}.',
      grants: 'Staff point grants {manualGrantRequiresApproval?need a second approval|need no second approval}, and the largest grant is {maxManualGrantPoints:point}.',
    },
    payment_methods: {
      summary: 'Gateways switched on: {=enabledGateways}. The fallback gateway is {fallback.gateway}, and wallet payments are {walletPayments.enabled}.',
      gateways: [
        '**Stripe** is {gateways.0.enabled}[[gateways.0.enabled|: {gateways.0.methods} in {gateways.0.currencies}]].',
        '**MyFatoorah** is {gateways.1.enabled}[[gateways.1.enabled|: {gateways.1.methods} in {gateways.1.currencies}]].',
        '**Paymob** is {gateways.2.enabled}[[gateways.2.enabled|: {gateways.2.methods} in {gateways.2.currencies}]].',
        '**Moyasar** is {gateways.3.enabled}[[gateways.3.enabled|: {gateways.3.methods} in {gateways.3.currencies}]].',
        '**Tap** is {gateways.4.enabled}[[gateways.4.enabled|: {gateways.4.methods} in {gateways.4.currencies}]].',
        '**PayTR** is {gateways.5.enabled}[[gateways.5.enabled|: {gateways.5.methods} in {gateways.5.currencies}]].',
        '**iyzico** is {gateways.6.enabled}[[gateways.6.enabled|: {gateways.6.methods} in {gateways.6.currencies}]].',
      ],
      rules: 'When no visibility rule matches we show {fallback.gateway} with {fallback.method}.',
      wallet:
        'Wallet payments are {walletPayments.enabled}.[[walletPayments.enabled&walletPayments.allowPartial| Partial wallet payments are {walletPayments.allowPartial?allowed|not allowed} from {walletPayments.minPartialUsd}.]][[walletPayments.enabled&!walletPayments.allowPartial| Partial wallet payments are {walletPayments.allowPartial?allowed|not allowed}: a booking is paid fully from the wallet or not at all.]][[!walletPayments.enabled| Customers cannot spend their balance on bookings.]]',
    },
    payment_gateways: {
      summary: 'Gateways with keys set: {=configuredGateways}. Gateways in live mode: {=liveGateways}.',
      gateway: '**{#title}**: the keys {@.source}[[@.mode!=unknown|, and the account runs in {@.mode} mode]][[@.mode=unknown|, and the account mode is {@.mode}]].',
    },
    refund_policy: {
      summary:
        'Cancelled bookings are refunded to {destination}, and a card refund arrives within {refundProcessingDays:businessDay}.[[approvalThresholdUsd| Refunds above {approvalThresholdUsd} need a second approval.]][[!approvalThresholdUsd| Every refund needs a second approval.]]',
      destination:
        'A cancelled booking is refunded to {destination}.[[destination=WALLET&walletIncentivePercent| The customer gets a {walletIncentivePercent} bonus on top.]][[destination=CUSTOMER_CHOICE&walletIncentivePercent| Choosing the wallet earns a {walletIncentivePercent} bonus on top.]][[destination!=ORIGINAL_METHOD&!walletIncentivePercent| There is no wallet bonus ({walletIncentivePercent}).]]',
      automation:
        'When the airline cancels a flight we refund {autoRefundOnSupplierCancellation?automatically|after a staff review}. A card refund arrives in about {refundProcessingDays:businessDay}.',
      approvals:
        '[[approvalThresholdUsd|Any refund above {approvalThresholdUsd} needs a second staff member.]][[!approvalThresholdUsd|Every refund needs a second staff member: the threshold is {approvalThresholdUsd}.]] Offline settlements {offlineSettlement.approvalRequired?need a second staff member|need no second staff member}[[offlineSettlement.approvalRequired| above {offlineSettlement.approvalThresholdUsd}]].',
      failed:
        '[[failedBooking.mode=CUSTOMER_CHOICE|If a booking fails after payment, {failedBooking.mode} within {failedBooking.choiceWindowHours}; otherwise we refund to {failedBooking.defaultChoice}.]][[failedBooking.mode!=CUSTOMER_CHOICE|If a booking fails after payment, the money always goes back to {failedBooking.mode}.]][[failedBooking.mode!=ORIGINAL_METHOD&failedBooking.walletIncentivePercent| Taking it in the wallet earns a {failedBooking.walletIncentivePercent} bonus.]]',
      topups: [
        'Wallet top-ups are {allowWalletTopup}[[allowWalletTopup|: from {walletTopUp.minUsd} to {walletTopUp.maxUsd} at a time]][[!allowWalletTopup|: customers cannot add balance by card]].',
        '[[allowWalletTopup|The daily limit is {walletTopUp.dailyMaxUsd} and {walletTopUp.maxTopUpsPerDay:topup} at most.]]',
        '[[allowWalletTopup|{walletTopUp.requireVerifiedEmail?Only customers with a verified e-mail can top up|Customers can top up without a verified e-mail}.]]',
        '[[allowWalletTopup|A new account, in its first {walletTopUp.newAccountDays}: up to {walletTopUp.newAccountMaxUsd} at a time and {walletTopUp.newAccountTotalMaxUsd} in total.]]',
      ],
      funds: 'Wallet money is spent in this order: {walletFunds.spendOrder}.',
    },
    fraud_policy: {
      summary:
        'Risk review is {review.enabled}[[review.enabled|: any booking scoring {review.reviewScore} waits for a staff member]]. 3-D Secure is asked {threeDs.mode}, and card testing is {cardTesting.enabled?watched and blocked|not watched}.',
      review:
        'Risk review is {review.enabled}.[[review.enabled| Any booking scoring {review.reviewScore} or more waits for a staff member before the ticket is issued. The team is reminded once it has waited more than {review.reminderMinutes}.]][[!review.enabled| Tickets are issued without a staff check, whatever the score.]]',
      rules: [
        '**Card shared across accounts** is {rules.cardSharedAcrossAccounts.enabled}[[rules.cardSharedAcrossAccounts.enabled|: one card on more than {rules.cardSharedAcrossAccounts.maxAccounts:account} within {rules.cardSharedAcrossAccounts.windowHours} adds {rules.cardSharedAcrossAccounts.score:point}]][[!rules.cardSharedAcrossAccounts.enabled|, so it scores nothing]].',
        '**Many cards on one account** is {rules.cardsPerAccount.enabled}[[rules.cardsPerAccount.enabled|: more than {rules.cardsPerAccount.maxCards:card} on one account within {rules.cardsPerAccount.windowHours} adds {rules.cardsPerAccount.score:point}]][[!rules.cardsPerAccount.enabled|, so it scores nothing]].',
        '**Many accounts on one device** is {rules.accountsPerDevice.enabled}[[rules.accountsPerDevice.enabled|: more than {rules.accountsPerDevice.maxAccounts:account} from one device within {rules.accountsPerDevice.windowHours} adds {rules.accountsPerDevice.score:point}]][[!rules.accountsPerDevice.enabled|, so it scores nothing]].',
        '**Many payments from one IP** is {rules.paymentsPerIp.enabled}[[rules.paymentsPerIp.enabled|: more than {rules.paymentsPerIp.maxPayments:payment} from one IP address within {rules.paymentsPerIp.windowHours} adds {rules.paymentsPerIp.score:point}]][[!rules.paymentsPerIp.enabled|, so it scores nothing]].',
        '**Country mismatch** is {rules.countryMismatch.enabled}[[rules.countryMismatch.enabled|: a card country that differs from the customer’s adds {rules.countryMismatch.score:point}]][[!rules.countryMismatch.enabled|, so it scores nothing]].',
        '**Travel soon** is {rules.sameDayTravel.enabled}[[rules.sameDayTravel.enabled|: travel within {rules.sameDayTravel.withinHours} of booking adds {rules.sameDayTravel.score:point}]][[!rules.sameDayTravel.enabled|, so it scores nothing]].',
        '**Large amount** is {rules.highAmount.enabled}[[rules.highAmount.enabled|: an amount of {rules.highAmount.amountUsd} or more adds {rules.highAmount.score:point}]][[!rules.highAmount.enabled|, so it scores nothing]].',
        '**No liability shift** is {rules.noLiabilityShift.enabled}[[rules.noLiabilityShift.enabled|: a payment without liability shift to the bank adds {rules.noLiabilityShift.score:point}]][[!rules.noLiabilityShift.enabled|, so it scores nothing]].',
      ],
      blocklists: 'Blocked e-mail domains: {blocklist.emailDomains}. Card issuing countries sent to review: {blocklist.cardIssuerCountries}.',
      threeDs:
        'We ask for 3-D Secure {threeDs.mode}[[threeDs.mode=ABOVE_AMOUNT|: every payment of {threeDs.aboveUsd} or more]][[threeDs.mode=RISK_BASED|: every payment scoring {threeDs.riskScore} or more]].',
      cardTesting: [
        'Card-testing watch is {cardTesting.enabled}[[!cardTesting.enabled|: declines are not counted and nobody is blocked]].',
        '[[cardTesting.enabled|We block after {cardTesting.maxDeclinesPerSession:decline} in one payment session.]]',
        '[[cardTesting.enabled|Or after {cardTesting.maxDeclinesPerAccount:decline} on an account within {cardTesting.accountWindowHours}.]]',
        '[[cardTesting.enabled|Or after {cardTesting.maxDeclinesPerIp:decline} from an IP address within {cardTesting.ipWindowMinutes}.]]',
        '[[cardTesting.enabled|A block lasts {cardTesting.blockMinutes}.]]',
        '[[cardTesting.enabled|{cardTesting.waveDeclines:decline} across the platform within {cardTesting.waveWindowMinutes} count as a wave and alert the team.]]',
      ],
    },
    disputes: {
      summary:
        'An open dispute {freezeWalletOnOpen?freezes|does not freeze} the wallet and {freezePointsOnOpen?freezes|does not freeze} the points. The team is reminded {reminderHoursBeforeDue} before the deadline.',
    },
    markup_rules: {
      summary:
        '[[defaultRule.mode=percentage|The default markup is {defaultRule.percent} of the supplier price]][[defaultRule.mode=fixed|The default markup is {defaultRule.fixedUsd} per booking]][[defaultRule.mode=both|The default markup is {defaultRule.percent} plus {defaultRule.fixedUsd} per booking]], with {=ruleCount} checked first.',
      source: 'Markup rules are read from {rulesSource}.',
      default:
        'The default markup is a {defaultRule.mode}[[defaultRule.mode=percentage|: {defaultRule.percent} of the supplier price]][[defaultRule.mode=fixed|: {defaultRule.fixedUsd} per booking]][[defaultRule.mode=both|: {defaultRule.percent} plus {defaultRule.fixedUsd}]].[[defaultRule.mode!=fixed| It is at least {defaultRule.minUsd} and capped at {defaultRule.maxUsd}.]] It is rounded to the nearest {defaultRule.roundTo}.',
      rules: 'We check {=ruleCount} in order before the default markup; the first rule that matches wins.',
    },
    fx: {
      summary: 'We take exchange rates from {provider} and refresh them every {refreshIntervalMinutes}. We add a {safetyMarginPercent} safety margin and round {rounding.mode}.',
    },
    tax: {
      summary:
        'We run {mode}[[mode=NONE|: we issue receipts, not tax invoices]][[mode=VAT|, and {legalEntity.name} issues the tax invoices]]. Prices are {pricesIncludeTax?tax-inclusive|before tax}, and the tax number is {legalEntity.taxId}.',
      seller: 'We sell as {legalEntity.name}, registered in {legalEntity.country}, tax number {legalEntity.taxId}. Invoices come from {legalEntity.email}.',
      mode: 'We run {mode}, and displayed prices are {pricesIncludeTax?tax-inclusive|before tax}. The service fee {showServiceFeeLine?has its own line|is folded into the price}.',
      numbering:
        'Receipts start with {numbering.receiptPrefix} and tax invoices with {numbering.invoicePrefix}. Credit notes start with {numbering.creditNotePrefix} and refund receipts with {numbering.refundReceiptPrefix}. Numbering {numbering.yearlyReset?restarts every year|never restarts}.',
    },
    e_invoicing: {
      summary: 'Sending e-documents is {enabled}, and the server provider is {provider}. The tax office is {sellerTaxOffice}.',
    },
    finance_ledger: {
      summary: 'The double-entry ledger is {enabled?recording|off}, and the daily close is {dailyCloseEnabled}[[dailyCloseEnabled|, alerting on a difference above {differenceThresholdUsd}]].',
    },
    money_check: {
      summary: 'The daily money check is {enabled?running|off}[[enabled|, and a refund counts as stuck after {refundOpenHours}]].',
    },
    accounting_access: {
      summary: 'The accountant sees the buyer’s name {fields.buyerName}, their e-mail {fields.buyerEmail} and the customer’s e-mail {fields.customerEmail}.',
    },
    agent_booking_policy: {
      summary:
        'Staff price adjustments {priceAdjustApprovalRequired?need a second approval|need no approval}[[priceAdjustApprovalRequired| above {maxAdjustPercentWithoutApproval} of the total]]. Manual payments {manualPaymentApprovalRequired?need a second approval|need no approval}[[manualPaymentApprovalRequired| above {manualPaymentApprovalThresholdUsd}]].',
    },
    agent_payment_policy: {
      summary:
        'A payment link stays payable at least {paymentLinkMinMinutes}. A staff member may spend up to {walletOnBehalfDailyCapUsd} a day from a customer’s wallet, and above {walletOnBehalfApprovalThresholdUsd} needs a second approval.',
    },
    post_booking_services_policy: {
      summary: 'Staff adding extras after booking is {staffAddEnabled?allowed|off}[[staffAddEnabled|, and a staff quote stays payable for {staffQuoteMinutes}]].',
    },
    flights: {
      summary: 'Prices are locked for {priceLockMinutes}, and checkout stays open for {checkoutTtlMinutes}. One booking takes up to {maxPassengers:passenger}.',
      checkout:
        'The price is locked for {priceLockMinutes} after a flight is picked, and checkout stays open for {checkoutTtlMinutes}. We take no booking less than {bookingCutoffMinutes} before departure.',
      price: 'If the price moves by no more than {priceChangeToleranceUsd} after payment, we absorb the difference and complete the booking.',
      aic: 'Minor airline changes, up to {minorAicThresholdMinutes}, are {autoAcceptMinorAic?accepted automatically|left for a staff member}.',
      search: 'Search takes up to {maxPassengers:passenger} and {maxInfantsPerAdult:infant} per adult. It offers {allowedCabinClasses}, and shows up to {searchResultsLimit:result}.',
      calendar:
        'The fare calendar is {fareCalendar.enabled}.[[fareCalendar.enabled| A price stays fresh for {fareCalendar.freshnessSeconds}, and we search live {fareCalendar.liveProbeDays} around the chosen date. The cap is {fareCalendar.maxProbesPerMinute:search} a minute for the platform and {fareCalendar.probesPerVisitor:search} per visitor.]][[!fareCalendar.enabled| Customers do not see prices of nearby days.]]',
    },
    flight_provider: {
      summary:
        'Supplier search is {searchEnabled?open|closed} and booking {bookingEnabled?open|closed}. Holds are {holdPolicy.enabled?allowed|not allowed}[[holdPolicy.enabled| for up to {holdPolicy.maxHoldHours}]], and the cancellation fee is {cancellationPolicy.feeUsd}.',
    },
    flight_guards: {
      summary:
        'Supplier balance watch is {supplierBalance.enabled?on|off}[[supplierBalance.enabled| and alerts below {supplierBalance.lowBalanceUsd}]]. For a traveller already booked elsewhere: {duplicateBooking.policy}.',
      balance:
        'Supplier balance watch is {supplierBalance.enabled?on|off}.[[supplierBalance.enabled&supplierBalance.lastReading.amountUsd| The last reading was {supplierBalance.lastReading.amountUsd} on {supplierBalance.lastReading.at}.]][[supplierBalance.enabled| We alert when the balance drops below {supplierBalance.lowBalanceUsd}, or covers less than {supplierBalance.minCoverDays:day} at the average spend of {supplierBalance.consumptionWindowDays}.]][[supplierBalance.enabled| We {supplierBalance.pauseConfirmationWhenInsufficient?pause confirmations when the balance runs short|keep confirming even when the balance runs short}]][[supplierBalance.enabled&supplierBalance.pauseConfirmationWhenInsufficient|, for {supplierBalance.pauseMaxMinutes} at most]][[supplierBalance.enabled|.]][[!supplierBalance.enabled| No alert and no pause, however low the balance.]]',
      search:
        'Each IP address may run {searchGuard.perIpDailySearches:search} a day, and each account {searchGuard.perAccountDailySearches:search}. The daily supplier budget is {searchGuard.dailySupplierSearchBudget:search}.[[searchGuard.lookToBookAlertRatio| We alert when searches per booking pass {searchGuard.lookToBookAlertRatio}.]] The guest robot check is {searchGuard.captcha.enabled?on|off}[[searchGuard.captcha.enabled|: it appears after {searchGuard.captcha.guestSearchesBeforeChallenge:search} and a pass lasts {searchGuard.captcha.passMinutes}]].',
      coalescing: 'We {searchCoalescing.enabled?share|do not share} the result of identical searches running at the same time[[searchCoalescing.enabled|, with {searchCoalescing.scope}]].',
      duplicates: 'If a traveller is already booked on the same flight: {duplicateBooking.policy}.',
      holds:
        'If a customer lets {holdAbuse.maxExpiredUnpaidInWindow:hold} expire unpaid within {holdAbuse.abandonmentWindowDays}, their holds pause for {holdAbuse.cooldownDays}. Most held seats per flight: {holdAbuse.maxHeldSeatsPerFlight}.',
    },
    notifications: {
      summary:
        'Channels: e-mail is {providers.email.enabled}, WhatsApp {providers.whatsapp.enabled}, app push {providers.push.enabled} and SMS {providers.sms.enabled}.[[opsAlerts.enabled| Ops alerts start at the {opsAlerts.minSeverity} level.]]',
      channels:
        'E-mail is {providers.email.enabled}[[providers.email.enabled| and goes out as {providers.email.fromName}, with replies to {providers.email.replyTo}]]. WhatsApp is {providers.whatsapp.enabled}[[providers.whatsapp.enabled|, paced at {providers.whatsapp.pacing.perMinute:message} a minute with a random spread of {providers.whatsapp.pacing.jitterPercent}]]. SMS is {providers.sms.enabled} and app push {providers.push.enabled}.',
      quiet: 'Quiet hours are {quietHours.enabled}[[quietHours.enabled|: from {quietHours.start} until {quietHours.end} we hold {quietHours.channels} messages]].',
      ops:
        'Ops alerts are {opsAlerts.enabled}.[[opsAlerts.enabled| They reach {opsAlerts.recipients} from the {opsAlerts.minSeverity} level through {opsAlerts.channels}. Repeats are grouped every {opsAlerts.throttleMinutes}, and beyond {opsAlerts.burstLimit:alert} we call it a storm and send a summary.]][[!opsAlerts.enabled| The team gets no alert about failures.]]',
      content: 'The booking confirmation e-mail {emailContent.showFareRules?shows the fare rules|does not show the fare rules}.',
      delivery: 'We try a message at most {delivery.maxAttempts:time}, {delivery.retryBackoffSeconds} apart. Anything stuck longer than {delivery.staleAfterSeconds} is requeued.',
    },
    whatsapp_provider: {
      summary: 'WhatsApp through {provider} is {status}[[lastSuccessAt|; the last message went out {lastSuccessAt}]].',
      status: 'WhatsApp through {provider} is {status}.[[lastSuccessAt| The last message went out {lastSuccessAt}.]][[lastErrorAt| The last failure was {lastErrorAt}.]][[!lastErrorAt| No failure is recorded.]]',
      switch: 'Sending WhatsApp messages is {providers.whatsapp.enabled}[[providers.whatsapp.enabled|, at {providers.whatsapp.pacing.perMinute:message} a minute]].',
      webhook: 'We {webhook.enabled?receive Cartat delivery receipts at the address below|do not receive Cartat delivery receipts}.',
      test: 'Send a test message to {test.phone} in {test.locale}.',
    },
    mobile_app: {
      summary: 'The oldest supported version is {ios.minSupportedVersion} on iOS and {android.minSupportedVersion} on Android; the latest is {ios.latestVersion}.',
    },
    analytics: {
      summary: 'We keep supplier calls for {retention.providerCallDays} and search summaries for {retention.searchSummaryDays}. The live stream is {live.enabled}.',
    },
    audit: {
      summary: 'We keep the audit log for {retentionDays} and customer activity for {activityRetentionDays}.',
    },
    storage: {
      summary: 'Deleted files stay in the trash for {trash.retentionDays}, then they are erased.',
    },
    retention: {
      summary:
        'The nightly clean-up is {enabled?running|off}[[enabled|: delivered internal events go after {outboxDeliveredDays} and finished notifications after {notificationDays}]].',
    },
    'prefs:appearance': {
      main: 'Show the dashboard in {theme} mode with the {colorTheme} colour, a {layoutStyle} style and the {layout} layout. The interface is in {language}, set in {fontFamily} at {fontSize} size. The sidebar colour {sidebarCustomBg?is custom|follows the primary colour}.',
    },
    'prefs:tables': {
      main: 'Show tables at {tableSettings.density} density with {tableSettings.pageSize:row} per page, {tableSettings.striped?with striped rows|without stripes}. Column hiding is {tableSettings.showColumnVisibility} and column resizing {tableSettings.showColumnResize}. Row selection is {tableSettings.showRowSelection} and global search {tableSettings.showGlobalFilter}.',
    },
    'prefs:notifications': {
      main: 'I get notifications {notifications.inApp?inside the dashboard|outside the dashboard only}, {notifications.email?by e-mail too|without e-mail}, {notifications.push?as push alerts on this device|without push alerts}, {notifications.sound?with a sound|silently}. Categories I follow: {notifPrefs.categories}.',
    },
  },

  related: {
    platform: [{ to: 'maintenance', why: 'Close the platform, or parts of it, in a scheduled window.' }],
    maintenance: [
      { to: 'platform', why: 'Product switches turn a whole product off, not for a window.' },
      { to: 'flight_provider', why: 'Stop only search or booking at the supplier.' },
    ],
    security: [
      { to: 'abuse_protection', why: 'Code limits, CAPTCHA and breached passwords.' },
      { to: 'security_alerts', why: 'Alert the team on a wave of failed sign-ins or lockouts.' },
      { to: 'verification_policy', why: 'E-mail and phone checks, including staff two-factor sign-in.' },
    ],
    verification_policy: [
      { to: 'security', why: 'Lockout, IP allow-list and sign-in methods.' },
      { to: 'flight_provider', why: 'The verified phone needed for a hold is set there.' },
    ],
    abuse_protection: [
      { to: 'security', why: 'Lockout after failed sign-ins.' },
      { to: 'flight_guards', why: 'The search CAPTCHA uses the same Turnstile key.' },
    ],
    security_alerts: [
      { to: 'security', why: 'The lockout the waves are counted from.' },
      { to: 'notifications', why: 'Ops alert channels and recipients.' },
    ],
    payment_methods: [
      { to: 'payment_gateways', why: 'Keys, and test or live mode.' },
      { to: 'refund_policy', why: 'Wallet top-ups and spending order.' },
    ],
    payment_gateways: [{ to: 'payment_methods', why: 'Gateway switches, methods and currencies.' }],
    refund_policy: [
      { to: 'payment_methods', why: 'Wallet payments and partial payments.' },
      { to: 'agent_payment_policy', why: 'Staff limits on a customer’s wallet.' },
      { to: 'disputes', why: 'What a bank dispute freezes.' },
    ],
    fraud_policy: [
      { to: 'abuse_protection', why: 'Sign-in and sign-up protection.' },
      { to: 'disputes', why: 'What happens after a bank dispute.' },
    ],
    disputes: [
      { to: 'refund_policy', why: 'The wallet and refunds.' },
      { to: 'fraud_policy', why: 'The review before ticketing.' },
    ],
    markup_rules: [
      { to: 'fx', why: 'The safety margin in exchange rates.' },
      { to: 'loyalty', why: 'Tier discounts come out of the markup.' },
    ],
    tax: [
      { to: 'e_invoicing', why: 'Sending the Turkish e-documents.' },
      { to: 'accounting_access', why: 'What the accountant sees of the buyer.' },
    ],
    e_invoicing: [{ to: 'tax', why: 'The tax number and tax mode.' }],
    loyalty: [
      { to: 'markup_rules', why: 'The markup the discount comes out of.' },
      { to: 'disputes', why: 'Points frozen during a dispute.' },
    ],
    agent_booking_policy: [{ to: 'agent_payment_policy', why: 'Payment links and wallet limits.' }],
    agent_payment_policy: [{ to: 'agent_booking_policy', why: 'Second approval of bookings.' }],
    post_booking_services_policy: [
      { to: 'flight_provider', why: 'The “after-booking operations” and “extras after booking” switches come first.' },
    ],
    flights: [
      { to: 'flight_provider', why: 'Holds, cancellations and changes.' },
      { to: 'flight_guards', why: 'Supplier balance and search cost.' },
    ],
    flight_provider: [
      { to: 'flights', why: 'Tolerance for price changes.' },
      { to: 'flight_guards', why: 'The current low-balance alert.' },
    ],
    flight_guards: [
      { to: 'flight_provider', why: 'The supplier’s own policies.' },
      { to: 'abuse_protection', why: 'The sign-in CAPTCHA.' },
    ],
    notifications: [
      { to: 'whatsapp_provider', why: 'The Cartat account, connection status, and the same WhatsApp switch.' },
      { to: 'security_alerts', why: 'What fires a security alert.' },
    ],
    whatsapp_provider: [{ to: 'notifications', why: 'Channels and message events.' }],
    finance_ledger: [{ to: 'money_check', why: 'The daily comparison of money records.' }],
    money_check: [{ to: 'finance_ledger', why: 'The ledger’s daily close.' }],
    accounting_access: [{ to: 'tax', why: 'Seller details and invoices.' }],
    retention: [
      { to: 'audit', why: 'The audit log and customer activity.' },
      { to: 'analytics', why: 'Analytics data.' },
    ],
    audit: [{ to: 'retention', why: 'Infrastructure table clean-up.' }],
    analytics: [{ to: 'retention', why: 'Infrastructure table clean-up.' }],
  },
};

export const messages = { ar, en };

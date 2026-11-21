import type { CardType, Role } from '@lab/mocks/hub-app';
import type { PluralForms } from './format';

/**
 * Strings the kit itself needs (card vocabulary, states, the sheet). A page never repeats these: it reads
 * `kitMessages` with `useT` for a type or status label, and keeps its own copy in `pages/<view>/i18n.ts`.
 * `{x}` placeholders are split with `fill` so keys and commands render as LTR isolates.
 */
export type CardAction =
  | 'decide'
  | 'withdraw'
  | 'deliver'
  | 'start'
  | 'verify'
  | 'cancel'
  | 'acknowledge'
  | 'apply'
  | 'dismiss'
  | 'approve'
  | 'reject'
  | 'request_changes'
  | 'claim'
  | 'unclaim'
  | 'submit'
  | 'done'
  | 'review'
  | 'send_to_review'
  | 'mark_ported'
  | 'release'
  | 'mark_ready'
  | 'reopen';

type LinkKindLabel = 'blocks' | 'blocked_by' | 'relates' | 'parent' | 'duplicates';

interface Dict {
  types: Record<CardType, string>;
  roles: Record<Role, string>;
  routed: string;
  moreRoles: string;
  status: Record<string, string>;
  actions: Record<CardAction, string>;
  /** An action whose word depends on the card: Cancel on a need ends the request, and must not read like closing a form (review M5). */
  actionsByType: Partial<Record<CardType, Partial<Record<CardAction, string>>>>;
  done: Record<CardAction, string>;
  undo: string;
  dismiss: string;
  close: string;
  cancel: string;
  retry: string;
  all: string;
  filters: { mine: string; open: string; openCount: string; remove: string };
  mineMark: string;
  sourceStatus: Record<'ok' | 'lagging' | 'failing' | 'disabled', string>;
  search: string;
  copy: { copied: string; label: string; key: string; link: string };
  relative: { justNow: string };
  actor: { agentSuffix: string; system: string };
  online: string;
  lastSeen: string;
  error: { title: string; code: string; requestId: string; forbidden: string; forbiddenRole: string };
  empty: { comingNext: string };
  loading: { still: string };
  secret: { title: string; body: string };
  toast: { undoHint: string; blocked: string };
  confirm: { reason: string; reasonRequired: string };
  sheet: {
    label: string;
    actionsLabel: string;
    more: string;
    watch: string;
    unwatch: string;
    watching: string;
    copyKey: string;
    copyLink: string;
    archive: string;
    restore: string;
    archived: string;
    archiveTitle: string;
    archiveBody: string;
    notFound: string;
    notFoundBody: string;
    created: string;
    tabs: { details: string; comments: string; history: string; links: string };
    noBody: string;
    comments: {
      empty: string;
      placeholder: string;
      label: string;
      send: string;
      hint: string;
      redacted: string;
      agent: string;
    };
    history: { empty: string; kinds: Record<string, string>; via: string; fields: string; selfVerified: string; fieldNames: Record<string, string>; values: Record<string, string> };
    links: {
      empty: string;
      kinds: Record<LinkKindLabel, string>;
      add: string;
      key: string;
      kind: string;
      invalid: string;
      self: string;
    };
    fields: {
      due: string;
      overdue: string;
      dueIn: string;
      responsible: string;
      requester: string;
      kind: string;
      severity: string;
      module: string;
      from: string;
      to: string;
      branch: string;
      reason: string;
      note: string;
      noteOptional: string;
    };
    task: {
      specialty: string;
      specialties: Record<string, string>;
      effort: string;
      acceptance: string;
      prompt: string;
      promptHint: string;
      claimer: string;
      unclaimed: string;
      origin: string;
      origins: Record<string, string>;
      pr: string;
      blockedBy: string;
    };
    decision: {
      question: string;
      options: string;
      pick: string;
      rationale: string;
      rationaleHint: string;
      recommended: string;
      chosen: string;
      pros: string;
      cons: string;
      cost: string;
      decider: string;
      decidedBy: string;
      reminders: string;
      noReminders: string;
      escalated: string;
      adr: string;
      adrNone: string;
      adrStatus: Record<string, string>;
      adrHint: string;
      save: string;
      needPick: string;
    };
    need: {
      steps: Record<'requested' | 'in_progress' | 'delivered' | 'verified', string>;
      kinds: Record<string, string>;
      location: string;
      locationHint: string;
      locationPending: string;
      deliveredBy: string;
      verifiedBy: string;
      verifyNote: string;
      saveDeliver: string;
      saveVerify: string;
    };
    change: {
      kinds: Record<string, string>;
      author: string;
      commits: string;
      files: string;
      added: string;
      removed: string;
      commitList: string;
      pr: string;
      prStates: Record<string, string>;
      session: string;
      changed: string;
      remaining: string;
      noSummary: string;
      noSummaryHint: string;
      duration: string;
      openPr: string;
    };
    handoff: {
      route: string;
      kinds: Record<string, string>;
      severities: Record<string, string>;
      pendingAge: string;
      summary: string;
      diff: string;
      breaking: string;
      nonBreaking: string;
      before: string;
      after: string;
      schemas: string;
      files: string;
      viewRaw: string;
      hideRaw: string;
      prompt: string;
      source: string;
      appliedTask: string;
      ackHint: string;
      saveAck: string;
      saveApply: string;
    };
    redesign: {
      lab: string;
      openLab: string;
      compare: string;
      base: string;
      score: string;
      review: string;
      openReview: string;
      touches: string;
      shots: string;
      noteRequired: string;
      noteOptional: string;
      saveApprove: string;
      saveReject: string;
      saveChanges: string;
      portTask: string;
      ported: string;
    };
    doc: {
      path: string;
      kinds: Record<string, string>;
      source: string;
      commit: string;
      words: string;
      outline: string;
      referencedBy: string;
      openGithub: string;
      indexed: string;
    };
    release: {
      version: string;
      repo: string;
      released: string;
      included: string;
      notes: string;
      noteTabs: { team: string; owner: string; accountant: string };
    };
  };
  blocksCount: PluralForms;
}

const ar: Dict = {
  types: { task: 'مهمة', decision: 'قرار', need: 'احتياج', change: 'تغيير', handoff: 'إحالة', redesign: 'تصميم', doc: 'وثيقة', release: 'إصدار' },
  roles: { owner: 'المالك', pm: 'مدير المشروع', accountant: 'المحاسب', backend: 'الباك إند', frontend: 'الفرونت إند', designer: 'المصمم', qa: 'الجودة' },
  routed: 'موجّه إلى دورك: {role}',
  moreRoles: '+{n}',
  status: {
    backlog: 'مؤجلة',
    ready: 'جاهزة',
    claimed: 'محجوزة',
    in_progress: 'قيد التنفيذ',
    in_review: 'قيد المراجعة',
    done: 'منجزة',
    cancelled: 'ملغاة',
    open: 'مفتوح',
    decided: 'مُحسوم',
    withdrawn: 'مسحوب',
    superseded: 'مُستبدَل',
    requested: 'مطلوب',
    delivered: 'مُسلَّم',
    verified: 'تم التحقق',
    pending: 'بانتظار الاستلام',
    acknowledged: 'مستلَمة',
    applied: 'مطبَّقة',
    dismissed: 'مُتجاهَلة',
    draft: 'مسودة',
    review: 'قيد المراجعة',
    approved: 'موافَق عليه',
    rejected: 'مرفوض',
    ported: 'منقول',
    reference: 'مرجع',
    recorded: 'مسجَّل',
    current: 'محدَّثة',
    stale: 'قديمة',
    removed: 'محذوفة',
    planned: 'مخطَّط',
    released: 'صدر',
    overdue: 'متأخر',
    escalated: 'مُصعَّد',
    blocked: 'متوقف',
    merged: 'مدموج',
  },
  actions: {
    decide: 'قرّر',
    withdraw: 'اسحب',
    deliver: 'سلّم',
    start: 'ابدأ',
    verify: 'تحقّق',
    cancel: 'ألغِ',
    acknowledge: 'استلم',
    apply: 'طبّق',
    dismiss: 'تجاهل',
    approve: 'وافق',
    reject: 'ارفض',
    request_changes: 'اطلب تعديلات',
    claim: 'احجز',
    unclaim: 'ألغِ الحجز',
    submit: 'أرسل للمراجعة',
    done: 'أنجزت',
    review: 'راجع',
    send_to_review: 'أرسل للمراجعة',
    mark_ported: 'سجّل النقل',
    release: 'سجّل الإصدار',
    mark_ready: 'جهّزها',
    reopen: 'أعدها',
  },
  actionsByType: { need: { cancel: 'ألغِ الطلب' }, task: { cancel: 'ألغِ المهمة' } },
  // Verbless, so a toast reads the same to everyone: three of the seven members are women (review M14).
  done: {
    decide: 'سُجّل القرار على {key}',
    withdraw: 'سُحب {key}',
    deliver: 'سُلّم {key}',
    start: 'بدأ العمل على {key}',
    verify: 'تم التحقق من {key}',
    cancel: 'أُلغي {key}',
    acknowledge: 'تم استلام {key}',
    apply: 'تم تطبيق {key}',
    dismiss: 'تم تجاهل {key}',
    approve: 'تمت الموافقة على {key}',
    reject: 'تم رفض {key}',
    request_changes: 'طُلبت تعديلات على {key}',
    claim: 'تم حجز {key}',
    unclaim: 'أُلغي حجز {key}',
    submit: 'أُرسل {key} للمراجعة',
    done: 'أُنجز {key}',
    review: 'تمت مراجعة {key}',
    send_to_review: 'أُرسل {key} للمراجعة',
    mark_ported: 'سُجّل نقل {key}',
    release: 'صدر {key}',
    mark_ready: 'صارت {key} جاهزة',
    reopen: 'أُعيدت {key}',
  },
  undo: 'تراجع',
  dismiss: 'إغلاق',
  close: 'إغلاق',
  cancel: 'ليس الآن',
  retry: 'أعد المحاولة',
  all: 'الكل',
  filters: { mine: 'يخصّني', open: 'الفلاتر', openCount: 'الفلاتر ({n})', remove: 'أزل الفلتر: {name}' },
  mineMark: 'يخصّك',
  sourceStatus: { ok: 'يعمل', lagging: 'متأخر', failing: 'يفشل', disabled: 'موقوف' },
  search: 'ابحث',
  copy: { copied: 'نُسخ', label: 'انسخ {text}', key: 'انسخ المفتاح', link: 'انسخ الرابط' },
  relative: { justNow: 'الآن' },
  actor: { agentSuffix: '(وكيل)', system: 'النظام' },
  online: 'على الخط الآن',
  lastSeen: 'آخر ظهور {rel}',
  error: {
    title: 'تعذّر تحميل {thing}',
    code: 'الرمز',
    requestId: 'معرّف الطلب',
    forbidden: 'لا تملك صلاحية الوصول هنا',
    forbiddenRole: 'هذا القسم يحتاج دور {role}.',
  },
  empty: { comingNext: 'قادمة تاليًا' },
  loading: { still: 'ما زال التحميل جاريًا…' },
  secret: {
    title: 'يبدو أن هذا النص يحتوي على سر ({pattern})',
    body: 'احذفه واكتب مكان حفظ القيمة بدلًا منه.',
  },
  toast: { undoHint: 'اضغط {key} للتراجع', blocked: '{key} متوقفة على {blocker}' },
  confirm: { reason: 'السبب', reasonRequired: 'اكتب السبب لتكمل.' },
  sheet: {
    label: 'بطاقة {key}',
    actionsLabel: 'إجراءات البطاقة',
    more: 'خيارات أخرى',
    watch: 'تابع',
    unwatch: 'أوقف المتابعة',
    watching: 'تتابعها',
    copyKey: 'انسخ المفتاح',
    copyLink: 'انسخ الرابط',
    archive: 'أرشف',
    restore: 'استعد',
    archived: 'مؤرشفة منذ {when}',
    archiveTitle: 'أرشفة {key}؟',
    archiveBody: 'تختفي البطاقة من القوائم وتبقى متاحة عبر فلتر الأرشيف. يمكن استعادتها في أي وقت.',
    notFound: 'لا توجد بطاقة {key} في مساحة العمل هذه',
    notFoundBody: 'تحقق من المفتاح، أو ابحث عنها من شريط البحث.',
    created: 'الإنشاء:',
    tabs: { details: 'التفاصيل', comments: 'التعليقات', history: 'السجل', links: 'الروابط' },
    noBody: 'لا وصف لهذه البطاقة.',
    comments: {
      empty: 'لا تعليقات بعد. اكتب أول تعليق.',
      placeholder: 'اكتب تعليقًا. استخدم GTV- لربط بطاقة.',
      label: 'تعليق جديد',
      send: 'أرسل',
      hint: 'Ctrl+Enter للإرسال',
      redacted: 'حُجب هذا التعليق',
      agent: '(وكيل)',
    },
    history: {
      empty: 'لا أحداث بعد.',
      via: 'عبر {via}',
      fields: 'الحقل',
      selfVerified: 'تحقق ذاتي',
      // Verbal nouns: they follow a member's name, and a verb there has to pick a gender (review M14).
      kinds: {
        created: 'إنشاء البطاقة',
        status_changed: 'تغيير الحالة',
        field_changed: 'تعديل حقل',
        claimed: 'الحجز',
        unclaimed: 'إلغاء الحجز',
        commented: 'تعليق',
        linked: 'إضافة رابط',
        unlinked: 'حذف رابط',
        decided: 'حسم القرار',
        reminder_sent: 'إرسال تذكير',
        escalated: 'تصعيد',
        delivered: 'التسليم',
        verified: 'التحقق',
        acknowledged: 'الاستلام',
        applied: 'التطبيق',
        dismissed: 'التجاهل',
        commit: 'دفع commit',
        pr_opened: 'فتح PR',
        pr_merged: 'دمج PR',
        pr_closed: 'إغلاق PR',
        session_logged: 'تسجيل جلسة',
        approved: 'الموافقة',
        rejected: 'الرفض',
        changes_requested: 'طلب تعديلات',
        ported: 'النقل',
        unblocked: 'زال التوقف',
        archived: 'الأرشفة',
        restored: 'الاستعادة',
        redacted: 'حجب تعليق',
        watch: 'بدء المتابعة',
        unwatch: 'إيقاف المتابعة',
      },
      fieldNames: {
        status: 'الحالة',
        priority: 'الأولوية',
        by: 'بواسطة',
        byKey: 'حلّ محله',
        branch: 'الفرع',
        adrStatus: 'حالة ADR',
        note: 'ملاحظة',
        reason: 'السبب',
        location: 'المكان',
        rationale: 'السبب',
        optionTitle: 'الخيار',
        optionId: 'الخيار',
        channels: 'القنوات',
        kind: 'النوع',
        via: 'عبر',
        offsetHours: 'قبل الموعد (ساعات)',
        afterHours: 'بعد الموعد (ساعات)',
        afterDays: 'بعد (أيام)',
        toRole: 'إلى',
        number: 'الرقم',
        head: 'الفرع',
        base: 'الأساس',
        excerpt: 'المقتطف',
        otherCardKey: 'البطاقة',
        task: 'المهمة',
        files: 'الملفات',
        ref: 'المرجع',
      },
      values: { pr_opened: 'PR مفتوح', none: 'لا يوجد', inbox: 'الوارد', owner: 'المالك', pm: 'مدير المشروع', accountant: 'المحاسب', backend: 'الباك إند', frontend: 'الفرونت إند', designer: 'المصمم', qa: 'الجودة' },
    },
    links: {
      empty: 'لا روابط بعد.',
      kinds: { blocks: 'توقف', blocked_by: 'متوقفة على', relates: 'مرتبطة بـ', parent: 'تابعة لـ', duplicates: 'مكررة من' },
      add: 'أضف رابطًا',
      key: 'مفتاح البطاقة',
      kind: 'نوع الرابط',
      invalid: 'لا توجد بطاقة بهذا المفتاح.',
      self: 'لا يمكن ربط البطاقة بنفسها.',
    },
    fields: {
      due: 'الموعد',
      overdue: 'متأخر {d}',
      dueIn: 'مستحق {rel}',
      responsible: 'المسؤول',
      requester: 'الطلب من',
      kind: 'النوع',
      severity: 'الشدة',
      module: 'الوحدة',
      from: 'من',
      to: 'إلى',
      branch: 'الفرع',
      reason: 'السبب',
      note: 'ملاحظة',
      noteOptional: 'ملاحظة (اختيارية)',
    },
    task: {
      specialty: 'التخصص',
      specialties: { backend: 'باك إند', frontend: 'فرونت إند', design: 'تصميم', qa: 'جودة', ops: 'عمليات', docs: 'توثيق' },
      effort: 'الجهد',
      acceptance: 'معايير القبول',
      prompt: 'أمر البدء',
      promptHint: 'الصقه في Claude Code لتبدأ.',
      claimer: 'الحجز',
      unclaimed: 'لم تُحجز بعد',
      origin: 'المصدر',
      origins: { manual: 'يدوي', import_suggestion: 'اقتراح مستورد', session_followup: 'متابعة جلسة', redesign_port: 'نقل تصميم', decision: 'من قرار', handoff: 'من إحالة' },
      pr: 'PR',
      blockedBy: 'متوقفة على {key}',
    },
    decision: {
      question: 'السؤال',
      options: 'الخيارات',
      pick: 'اختر خيارًا',
      rationale: 'سبب القرار',
      rationaleHint: 'سطر أو سطران يبقيان في السجل وفي ADR.',
      recommended: 'موصى به',
      chosen: 'المختار',
      pros: 'المزايا',
      cons: 'العيوب',
      cost: 'التكلفة',
      decider: 'صاحب القرار',
      decidedBy: 'الحسم',
      reminders: 'التذكيرات',
      noReminders: 'لم يُرسل تذكير',
      escalated: 'صُعّد إلى {role} {when}',
      adr: 'سجل القرار (ADR)',
      adrNone: 'لا ADR بعد.',
      adrStatus: { none: 'لا يوجد', drafted: 'مسودة', pr_opened: 'PR مفتوح', merged: 'مدموج', failed: 'فشل' },
      adrHint: 'اكتب مسودته بالأمر {cmd} في Claude Code.',
      save: 'سجّل القرار',
      needPick: 'اختر خيارًا قبل الحفظ.',
    },
    need: {
      steps: { requested: 'مطلوب', in_progress: 'قيد التنفيذ', delivered: 'مُسلَّم', verified: 'تم التحقق' },
      kinds: { token: 'توكن', account: 'حساب', contract: 'عقد', value_check: 'تحقق من قيمة', file: 'ملف', access: 'صلاحية وصول', other: 'أخرى' },
      location: 'مكان القيمة',
      locationHint: 'اكتب أين وضعتها، لا القيمة نفسها.',
      locationPending: 'يظهر بعد التسليم.',
      deliveredBy: 'التسليم',
      verifiedBy: 'التحقق',
      verifyNote: 'ملاحظة التحقق',
      saveDeliver: 'سجّل التسليم',
      saveVerify: 'سجّل التحقق',
    },
    change: {
      kinds: { commits: 'commits', pull_request: 'Pull request', session: 'جلسة' },
      author: 'الكاتب',
      commits: 'commits',
      files: 'ملفات',
      added: 'أُضيف',
      removed: 'حُذف',
      commitList: 'الـ commits',
      pr: 'PR',
      prStates: { open: 'مفتوح', merged: 'مدموج', closed: 'مغلق' },
      session: 'الجلسة',
      changed: 'ما تغيّر',
      remaining: 'ما تبقى',
      noSummary: 'بلا ملخص',
      noSummaryHint: 'شغّل {cmd} في Claude Code لكتابة الملخص.',
      duration: 'المدة',
      openPr: 'افتح PR',
    },
    handoff: {
      route: 'المسار',
      kinds: { contract: 'عقد API', component: 'مكوّن', design: 'تصميم', data: 'بيانات', other: 'أخرى' },
      severities: { breaking: 'كاسر', notable: 'مهم', info: 'للعلم' },
      pendingAge: 'بانتظار الاستلام منذ {d}',
      summary: 'الملخص',
      diff: 'التغييرات',
      breaking: 'كاسرة',
      nonBreaking: 'غير كاسرة',
      before: 'قبل',
      after: 'بعد',
      schemas: 'مخططات تغيّرت',
      files: 'الملفات',
      viewRaw: 'اعرض JSON',
      hideRaw: 'أخفِ JSON',
      prompt: 'أمر للوكيل المستلم',
      source: 'التغيير المصدر',
      appliedTask: 'مهمة التطبيق',
      ackHint: 'استلامك يخبر الفريق أنك رأيت التغيير. تطبيقه خطوة لاحقة.',
      saveAck: 'سجّل الاستلام',
      saveApply: 'سجّل التطبيق',
    },
    redesign: {
      lab: 'المختبر',
      openLab: 'افتح في المختبر',
      compare: 'قارن',
      base: 'الأساس',
      score: 'تقييم المراجعة',
      review: 'المراجعة',
      openReview: 'افتح review.md',
      touches: 'مكونات يمسها',
      shots: 'لقطات',
      noteRequired: 'الملاحظة مطلوبة.',
      noteOptional: 'ملاحظة (اختيارية)',
      saveApprove: 'سجّل الموافقة',
      saveReject: 'سجّل الرفض',
      saveChanges: 'أرسل طلب التعديلات',
      portTask: 'مهمة النقل',
      ported: 'نُقل إلى',
    },
    doc: {
      path: 'المسار',
      kinds: { doc: 'وثيقة', adr: 'ADR', status: 'حالة', readme: 'README', other: 'أخرى' },
      source: 'المصدر',
      commit: 'آخر commit',
      words: 'كلمة',
      outline: 'العناوين',
      referencedBy: 'مذكورة في',
      openGithub: 'افتح في GitHub',
      indexed: 'فُهرست {when}',
    },
    release: {
      version: 'الإصدار',
      repo: 'المستودع',
      released: 'تاريخ الإصدار',
      included: 'يشمل',
      notes: 'الملاحظات',
      noteTabs: { team: 'للفريق', owner: 'للمالك', accountant: 'للمحاسب' },
    },
  },
  blocksCount: { one: 'يوقف بطاقة واحدة', two: 'يوقف بطاقتين', few: 'يوقف # بطاقات', many: 'يوقف # بطاقة', other: 'يوقف # بطاقة' },
};

const en: Dict = {
  types: { task: 'Task', decision: 'Decision', need: 'Need', change: 'Change', handoff: 'Handoff', redesign: 'Redesign', doc: 'Doc', release: 'Release' },
  roles: { owner: 'Owner', pm: 'PM', accountant: 'Accountant', backend: 'Backend', frontend: 'Frontend', designer: 'Designer', qa: 'QA' },
  routed: 'Routed to your role: {role}',
  moreRoles: '+{n}',
  status: {
    backlog: 'Backlog',
    ready: 'Ready',
    claimed: 'Claimed',
    in_progress: 'In progress',
    in_review: 'In review',
    done: 'Done',
    cancelled: 'Cancelled',
    open: 'Open',
    decided: 'Decided',
    withdrawn: 'Withdrawn',
    superseded: 'Superseded',
    requested: 'Requested',
    delivered: 'Delivered',
    verified: 'Verified',
    pending: 'Pending',
    acknowledged: 'Acknowledged',
    applied: 'Applied',
    dismissed: 'Dismissed',
    draft: 'Draft',
    review: 'In review',
    approved: 'Approved',
    rejected: 'Rejected',
    ported: 'Ported',
    reference: 'Reference',
    recorded: 'Recorded',
    current: 'Current',
    stale: 'Stale',
    removed: 'Removed',
    planned: 'Planned',
    released: 'Released',
    overdue: 'Overdue',
    escalated: 'Escalated',
    blocked: 'Blocked',
    merged: 'Merged',
  },
  actions: {
    decide: 'Decide',
    withdraw: 'Withdraw',
    deliver: 'Deliver',
    start: 'Start',
    verify: 'Verify',
    cancel: 'Cancel',
    acknowledge: 'Acknowledge',
    apply: 'Apply',
    dismiss: 'Dismiss',
    approve: 'Approve',
    reject: 'Reject',
    request_changes: 'Request changes',
    claim: 'Claim',
    unclaim: 'Unclaim',
    submit: 'Submit for review',
    done: 'Mark done',
    review: 'Review',
    send_to_review: 'Send to review',
    mark_ported: 'Mark ported',
    release: 'Mark released',
    mark_ready: 'Mark ready',
    reopen: 'Send back',
  },
  actionsByType: { need: { cancel: 'Cancel request' }, task: { cancel: 'Cancel task' } },
  done: {
    decide: 'Decision recorded on {key}',
    withdraw: 'Withdrew {key}',
    deliver: 'Delivered {key}',
    start: 'Started {key}',
    verify: 'Verified {key}',
    cancel: 'Cancelled {key}',
    acknowledge: 'Acknowledged {key}',
    apply: 'Applied {key}',
    dismiss: 'Dismissed {key}',
    approve: 'Approved {key}',
    reject: 'Rejected {key}',
    request_changes: 'Requested changes on {key}',
    claim: 'Claimed {key}',
    unclaim: 'Unclaimed {key}',
    submit: 'Submitted {key} for review',
    done: 'Marked {key} done',
    review: 'Reviewed {key}',
    send_to_review: 'Sent {key} to review',
    mark_ported: 'Marked {key} ported',
    release: 'Released {key}',
    mark_ready: 'Moved {key} to ready',
    reopen: 'Sent {key} back',
  },
  undo: 'Undo',
  dismiss: 'Dismiss',
  close: 'Close',
  cancel: 'Not now',
  retry: 'Retry',
  all: 'All',
  filters: { mine: 'Mine', open: 'Filters', openCount: 'Filters ({n})', remove: 'Remove the filter: {name}' },
  mineMark: 'Yours',
  sourceStatus: { ok: 'Live', lagging: 'Behind', failing: 'Failing', disabled: 'Off' },
  search: 'Search',
  copy: { copied: 'Copied', label: 'Copy {text}', key: 'Copy key', link: 'Copy link' },
  relative: { justNow: 'just now' },
  actor: { agentSuffix: '(agent)', system: 'System' },
  online: 'Online now',
  lastSeen: 'Last seen {rel}',
  error: {
    title: 'Couldn’t load {thing}',
    code: 'Code',
    requestId: 'Request ID',
    forbidden: 'You don’t have access to this',
    forbiddenRole: 'This section needs the {role} role.',
  },
  empty: { comingNext: 'Coming next' },
  loading: { still: 'Still loading…' },
  secret: {
    title: 'This text looks like it contains a secret ({pattern})',
    body: 'Remove it and describe where the value is stored instead.',
  },
  toast: { undoHint: 'Press {key} to undo', blocked: '{key} is blocked by {blocker}' },
  confirm: { reason: 'Reason', reasonRequired: 'Write a reason to continue.' },
  sheet: {
    label: 'Card {key}',
    actionsLabel: 'Card actions',
    more: 'More options',
    watch: 'Watch',
    unwatch: 'Stop watching',
    watching: 'Watching',
    copyKey: 'Copy key',
    copyLink: 'Copy link',
    archive: 'Archive',
    restore: 'Restore',
    archived: 'Archived {when}',
    archiveTitle: 'Archive {key}?',
    archiveBody: 'The card leaves the lists and stays reachable through the archive filter. You can restore it at any time.',
    notFound: 'No card {key} in this workspace',
    notFoundBody: 'Check the key, or search for it from the search bar.',
    created: 'Created by',
    tabs: { details: 'Details', comments: 'Comments', history: 'History', links: 'Links' },
    noBody: 'This card has no description.',
    comments: {
      empty: 'No comments yet. Write the first one.',
      placeholder: 'Write a comment. Use GTV- to link a card.',
      label: 'New comment',
      send: 'Send',
      hint: 'Ctrl+Enter sends',
      redacted: 'This comment was redacted',
      agent: '(agent)',
    },
    history: {
      empty: 'No events yet.',
      via: 'via {via}',
      fields: 'Field',
      selfVerified: 'Self-verified',
      kinds: {
        created: 'created the card',
        status_changed: 'changed the status',
        field_changed: 'edited a field',
        claimed: 'claimed',
        unclaimed: 'unclaimed',
        commented: 'commented',
        linked: 'added a link',
        unlinked: 'removed a link',
        decided: 'made the decision',
        reminder_sent: 'sent a reminder',
        escalated: 'escalated',
        delivered: 'delivered',
        verified: 'verified',
        acknowledged: 'acknowledged',
        applied: 'applied',
        dismissed: 'dismissed',
        commit: 'pushed a commit',
        pr_opened: 'opened a PR',
        pr_merged: 'merged a PR',
        pr_closed: 'closed a PR',
        session_logged: 'logged a session',
        approved: 'approved',
        rejected: 'rejected',
        changes_requested: 'requested changes',
        ported: 'ported',
        unblocked: 'unblocked',
        archived: 'archived',
        restored: 'restored',
        redacted: 'redacted a comment',
        watch: 'started watching',
        unwatch: 'stopped watching',
      },
      fieldNames: {
        status: 'Status',
        priority: 'Priority',
        by: 'By',
        byKey: 'Replaced by',
        branch: 'Branch',
        adrStatus: 'ADR status',
        note: 'Note',
        reason: 'Reason',
        location: 'Location',
        rationale: 'Why',
        optionTitle: 'Option',
        optionId: 'Option',
        channels: 'Channels',
        kind: 'Kind',
        via: 'Via',
        offsetHours: 'Hours before due',
        afterHours: 'Hours after due',
        afterDays: 'After (days)',
        toRole: 'To',
        number: 'Number',
        head: 'Branch',
        base: 'Base',
        excerpt: 'Excerpt',
        otherCardKey: 'Card',
        task: 'Task',
        files: 'Files',
        ref: 'Ref',
      },
      values: { pr_opened: 'PR open', none: 'None', inbox: 'Inbox', owner: 'Owner', pm: 'PM', accountant: 'Accountant', backend: 'Backend', frontend: 'Frontend', designer: 'Designer', qa: 'QA' },
    },
    links: {
      empty: 'No links yet.',
      kinds: { blocks: 'Blocks', blocked_by: 'Blocked by', relates: 'Relates to', parent: 'Child of', duplicates: 'Duplicates' },
      add: 'Add link',
      key: 'Card key',
      kind: 'Link type',
      invalid: 'No card has this key.',
      self: 'A card cannot link to itself.',
    },
    fields: {
      due: 'Due',
      overdue: '{d} overdue',
      dueIn: 'Due {rel}',
      responsible: 'Responsible',
      requester: 'Requested by',
      kind: 'Kind',
      severity: 'Severity',
      module: 'Module',
      from: 'From',
      to: 'To',
      branch: 'Branch',
      reason: 'Reason',
      note: 'Note',
      noteOptional: 'Note (optional)',
    },
    task: {
      specialty: 'Specialty',
      specialties: { backend: 'Backend', frontend: 'Frontend', design: 'Design', qa: 'QA', ops: 'Ops', docs: 'Docs' },
      effort: 'Effort',
      acceptance: 'Acceptance',
      prompt: 'Start command',
      promptHint: 'Paste it in Claude Code to start.',
      claimer: 'Claimed by',
      unclaimed: 'Not claimed yet',
      origin: 'Origin',
      origins: { manual: 'Manual', import_suggestion: 'Imported suggestion', session_followup: 'Session follow-up', redesign_port: 'Redesign port', decision: 'From a decision', handoff: 'From a handoff' },
      pr: 'PR',
      blockedBy: 'Blocked by {key}',
    },
    decision: {
      question: 'Question',
      options: 'Options',
      pick: 'Pick an option',
      rationale: 'Why this option',
      rationaleHint: 'One or two lines. They stay in the history and in the ADR.',
      recommended: 'Recommended',
      chosen: 'Chosen',
      pros: 'Pros',
      cons: 'Cons',
      cost: 'Cost',
      decider: 'Decider',
      decidedBy: 'Decided by',
      reminders: 'Reminders',
      noReminders: 'No reminder sent',
      escalated: 'Escalated to {role} {when}',
      adr: 'Decision record (ADR)',
      adrNone: 'No ADR yet.',
      adrStatus: { none: 'None', drafted: 'Drafted', pr_opened: 'PR open', merged: 'Merged', failed: 'Failed' },
      adrHint: 'Draft it with {cmd} in Claude Code.',
      save: 'Record decision',
      needPick: 'Pick an option before saving.',
    },
    need: {
      steps: { requested: 'Requested', in_progress: 'In progress', delivered: 'Delivered', verified: 'Verified' },
      kinds: { token: 'Token', account: 'Account', contract: 'Contract', value_check: 'Value check', file: 'File', access: 'Access', other: 'Other' },
      location: 'Where the value is',
      locationHint: 'Write where you put it, never the value itself.',
      locationPending: 'Shown after delivery.',
      deliveredBy: 'Delivered by',
      verifiedBy: 'Verified by',
      verifyNote: 'Verification note',
      saveDeliver: 'Record delivery',
      saveVerify: 'Record verification',
    },
    change: {
      kinds: { commits: 'Commits', pull_request: 'Pull request', session: 'Session' },
      author: 'Author',
      commits: 'commits',
      files: 'files',
      added: 'added',
      removed: 'removed',
      commitList: 'Commits',
      pr: 'PR',
      prStates: { open: 'Open', merged: 'Merged', closed: 'Closed' },
      session: 'Session',
      changed: 'Changed',
      remaining: 'Remaining',
      noSummary: 'No summary',
      noSummaryHint: 'Run {cmd} in Claude Code to write the summary.',
      duration: 'Duration',
      openPr: 'Open PR',
    },
    handoff: {
      route: 'Route',
      kinds: { contract: 'API contract', component: 'Component', design: 'Design', data: 'Data', other: 'Other' },
      severities: { breaking: 'Breaking', notable: 'Notable', info: 'Info' },
      pendingAge: 'Pending for {d}',
      summary: 'Summary',
      diff: 'Changes',
      breaking: 'Breaking',
      nonBreaking: 'Non-breaking',
      before: 'Before',
      after: 'After',
      schemas: 'Schemas changed',
      files: 'Files',
      viewRaw: 'View JSON',
      hideRaw: 'Hide JSON',
      prompt: 'Prompt for the receiving agent',
      source: 'Source change',
      appliedTask: 'Applying task',
      ackHint: 'Acknowledging tells the team you saw the change. Applying it comes later.',
      saveAck: 'Record acknowledgement',
      saveApply: 'Record as applied',
    },
    redesign: {
      lab: 'Lab',
      openLab: 'Open in lab',
      compare: 'Compare',
      base: 'Base',
      score: 'Review score',
      review: 'Review',
      openReview: 'Open review.md',
      touches: 'Touches components',
      shots: 'Screenshots',
      noteRequired: 'A note is required.',
      noteOptional: 'Note (optional)',
      saveApprove: 'Record approval',
      saveReject: 'Record rejection',
      saveChanges: 'Send change request',
      portTask: 'Port task',
      ported: 'Ported to',
    },
    doc: {
      path: 'Path',
      kinds: { doc: 'Doc', adr: 'ADR', status: 'Status', readme: 'README', other: 'Other' },
      source: 'Source',
      commit: 'Last commit',
      words: 'words',
      outline: 'Outline',
      referencedBy: 'Referenced by',
      openGithub: 'Open in GitHub',
      indexed: 'Indexed {when}',
    },
    release: {
      version: 'Version',
      repo: 'Repo',
      released: 'Released',
      included: 'Includes',
      notes: 'Notes',
      noteTabs: { team: 'Team', owner: 'Owner', accountant: 'Accountant' },
    },
  },
  blocksCount: { one: 'Blocks 1 card', other: 'Blocks # cards' },
};

export const kitMessages = { ar, en };

/** The word for an action on this card: the type's own where it has one. */
export const actionName = (t: Dict, type: CardType, action: CardAction) => t.actionsByType[type]?.[action] ?? t.actions[action];

/** History's word for an event. A self-verified need says so (owner decision 2026-11-04). */
export const eventLabel = (t: Dict, event: { kind: string; data?: Record<string, unknown> }) => (event.kind === 'verified' && event.data?.selfVerified ? t.sheet.history.selfVerified : (t.sheet.history.kinds[event.kind] ?? event.kind));

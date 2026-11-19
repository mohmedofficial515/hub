// Settings groups of the "finance" section.
// Generated from the backend groups (src/modules/settings/groups) and the dashboard dictionaries; see audit.md
// in dashboard/settings. Fields with `proposed: true` are NOT in the real API (audit proposals, P0/P1).

import type { SettingsGroup } from '../types';

export const FINANCE_GROUPS: SettingsGroup[] = [
  {
    key: 'finance_ledger',
    section: 'finance',
    icon: 'BookOpenCheck',
    title: {
      ar: 'دفتر الحسابات',
      en: 'Finance ledger',
    },
    summary: {
      ar: 'دفتر القيد المزدوج (وضع الظل) والإقفال اليومي والقيود المتعثرة',
      en: 'Double-entry ledger (shadow mode), daily close and failed postings',
    },
    description: {
      ar: 'دفتر القيد المزدوج في وضع الظل: هل يسجّل، والإقفال اليومي، والفرق الذي يطلق تنبيهًا، وكيف تُعاد محاولة القيود المتعثرة. وضع الظل يسجّل فقط بجانب حركة الأموال: لا يغيّر ولا يوقف ولا يؤخّر أي دفع أو استرداد أو حجز، وأرقامه ليست حسابات رسمية حتى يعتمدها المحاسب.',
      en: 'The double-entry ledger in shadow mode: whether it records, the daily close, the difference that raises an alert and how failed postings are retried. Shadow mode only records next to the money flows: it never changes, blocks or delays a payment, refund or booking, and its figures are not official accounts until the accountant approves them.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 3,
    schemaVersion: 1,
    updatedAt: '2026-11-08T05:50:00.000Z',
    updatedBy: 'Ayşe Demir',
    masterSwitch: 'enabled',
    enabled: true,
    subsections: [
      {
        id: 'recording',
        title: {
          ar: 'التسجيل',
          en: 'Recording',
        },
        description: {
          ar: 'وضع الظل: القيود تُكتب بجانب حركات المال ولا تغيّرها.',
          en: 'Shadow mode: entries are written next to the money flows and never change them.',
        },
        fields: [
          {
            key: 'enabled',
            label: {
              ar: 'تسجيل قيود الدفتر',
              en: 'Record ledger entries',
            },
            help: {
              ar: 'مفعّل: كل دفع واسترداد وحركة محفظة وخصم من المورّد وإيراد وإلغاء وتغيير وإضافة ونزاع بطاقة يُسجَّل له قيد يومية متوازن بجانبه (وضع الظل، لا يغيّر حركة الأموال أبدًا). معطّل: لا يُسجَّل شيء حتى يُعاد تفعيله؛ ثم يستدرك الإقفال اليومي أيام الاستدراك الأخيرة. الافتراضي مفعّل.',
              en: 'On: every payment, refund, wallet movement, supplier charge, revenue, cancellation, change, extra and chargeback posts a balanced journal entry next to it (shadow mode, it never changes the money flow). Off: nothing is recorded until it is switched on again; the daily close then catches up the last catch-up days. Default on.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
        ],
      },
      {
        id: 'close',
        title: {
          ar: 'الإقفال اليومي',
          en: 'Daily close',
        },
        description: {
          ar: '05:45 UTC: يلحق بما فات ويقارن الدفتر بالجداول.',
          en: '05:45 UTC: catches up and compares the ledger with the tables.',
        },
        fields: [
          {
            key: 'dailyCloseEnabled',
            label: {
              ar: 'الإقفال اليومي',
              en: 'Daily close',
            },
            help: {
              ar: 'يشغّل الإقفال اليومي الساعة 05:45 بتوقيت UTC: يسجّل ما فات الأحداث، ثم يقارن الدفتر بالمحافظ ومدفوعات البوابات وتكلفة المورّد والهامش والمبالغ المدفوعة ويطلق تنبيهًا عند وجود فروق. معطّل: لا تشغيل مجدول (التشغيل اليدوي يبقى ممكنًا). الافتراضي مفعّل.',
              en: 'Runs the daily close at 05:45 UTC: posts anything an event missed, then compares the ledger with the wallets, gateway payments, supplier cost, markup and amounts paid and raises an alert on differences. Off: no scheduled run (a manual run still works). Default on.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'differenceThresholdUsd',
            label: {
              ar: 'الفرق الذي يطلق تنبيهًا (دولار)',
              en: 'Difference that alerts (USD)',
            },
            help: {
              ar: 'تُعدّ مقارنة الإقفال اليومي فرقًا، وتطلق تنبيه "فرق في الدفتر" للعمليات، عندما يختلف الدفتر عن جداول المصدر بأكثر من هذا المبلغ بالدولار الأمريكي. من 0 إلى 10,000. الافتراضي 1.',
              en: 'A comparison of the daily close counts as a difference, and raises the "ledger difference" alert to operations, when the ledger and the source tables differ by more than this many US dollars. Between 0 and 10,000. Default 1.',
            },
            type: 'money',
            value: 1,
            default: 1,
            min: 0,
            max: 10000,
            unit: 'USD',
            step: 0.01,
          },
          {
            key: 'catchUpDays',
            label: {
              ar: 'نافذة الاستدراك (أيام)',
              en: 'Catch-up window (days)',
            },
            help: {
              ar: 'أيام حركة الأموال التي يعيد الإقفال اليومي قراءتها ليسجّل ما لم يسجّله أي حدث: إضافات أُضيفت لدى المورّد، واستردادات دُفعت خارج المنصة، وأحداث ضائعة. من 1 إلى 60. الافتراضي 3.',
              en: 'Days of money movements the daily close reads again to post what no event did: extras added at the supplier, refunds paid back outside the platform, lost events. Between 1 and 60. Default 3.',
            },
            type: 'duration',
            value: 3,
            default: 3,
            unit: 'days',
            min: 1,
            max: 60,
          },
        ],
      },
      {
        id: 'failures',
        title: {
          ar: 'القيود المتعثرة',
          en: 'Failed postings',
        },
        description: {
          ar: 'إعادة المحاولة والتنبيه.',
          en: 'Retries and the alert.',
        },
        fields: [
          {
            key: 'failureAlertMinutes',
            label: {
              ar: 'التنبيه على القيود المتعثرة بعد (دقائق)',
              en: 'Alert on failing postings after (minutes)',
            },
            help: {
              ar: 'تُنبَّه العمليات عندما يستمر تعثّر قيد في الدفتر أكثر من هذا العدد من الدقائق. من 5 إلى 1,440. الافتراضي 15.',
              en: 'Operations are alerted when a ledger posting has kept failing for longer than this many minutes. Between 5 and 1,440. Default 15.',
            },
            type: 'duration',
            value: 15,
            default: 15,
            unit: 'minutes',
            min: 5,
            max: 1440,
          },
          {
            key: 'maxAttempts',
            label: {
              ar: 'إعادات المحاولة التلقائية للقيد المتعثر',
              en: 'Automatic retries of a failed posting',
            },
            help: {
              ar: 'عدد مرات إعادة محاولة القيد المتعثر تلقائيًا (كل 5 دقائق، وتتضاعف المدة حتى 6 ساعات) قبل أن ينتظر تدخّل شخص. من 1 إلى 50. الافتراضي 10.',
              en: 'How many times a failed posting is retried by itself (every 5 minutes, the wait doubling up to 6 hours) before it waits for a person. Between 1 and 50. Default 10.',
            },
            type: 'integer',
            value: 10,
            default: 10,
            min: 1,
            max: 50,
          },
        ],
      },
      {
        id: 'retention',
        title: {
          ar: 'الاحتفاظ',
          en: 'Retention',
        },
        description: {
          ar: 'يظهر أيضًا في نظرة «مدد الاحتفاظ».',
          en: 'Also listed in the data retention overview.',
        },
        fields: [
          {
            key: 'keepRunsDays',
            label: {
              ar: 'الاحتفاظ بتشغيلات الإقفال اليومي (أيام)',
              en: 'Keep daily close runs (days)',
            },
            help: {
              ar: 'عدد الأيام التي يُحتفظ فيها بتشغيل الإقفال اليومي قبل حذفه؛ أما تشغيلات الاستيفاء فتُحفظ دائمًا. من 30 إلى 3,650. الافتراضي 400.',
              en: 'Days a stored daily close run is kept before it is deleted; backfill runs are always kept. Between 30 and 3,650. Default 400.',
            },
            type: 'duration',
            value: 400,
            default: 400,
            unit: 'days',
            min: 30,
            max: 3650,
          },
        ],
      },
    ],
  },
  {
    key: 'money_check',
    section: 'finance',
    icon: 'ListChecks',
    title: {
      ar: 'فحص الأموال اليومي',
      en: 'Daily money check',
    },
    summary: {
      ar: 'مقارنة يومية لسجلات الأموال',
      en: 'Daily comparison of the money records',
    },
    description: {
      ar: 'فحص الأموال اليومي: هل يعمل، وكم تنتظر الأموال قبل أن تُعدّ متأخرة، وكم نتيجة يحفظ كل تشغيل، وكم يُحتفظ بالتشغيلات. يقرأ سجلات الأموال فقط ولا يصحّح شيئًا.',
      en: 'The daily money check: whether it runs, how long waiting money may wait before it counts as stuck, how many findings each run keeps and how long runs are kept. It only reads the money records and corrects nothing.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 2,
    schemaVersion: 1,
    updatedAt: '2026-10-31T06:00:00.000Z',
    updatedBy: 'Ayşe Demir',
    masterSwitch: 'enabled',
    enabled: true,
    subsections: [
      {
        id: 'run',
        title: {
          ar: 'التشغيل',
          en: 'Run',
        },
        description: {
          ar: 'يعمل يوميًا 05:15 UTC.',
          en: 'Runs daily at 05:15 UTC.',
        },
        fields: [
          {
            key: 'enabled',
            label: {
              ar: 'التشغيل اليومي',
              en: 'Daily run',
            },
            help: {
              ar: 'المفتاح الرئيسي لفحص الأموال اليومي (08:15 بتوقيت الرياض). عند إيقافه لا يفحص التشغيل المجدول شيئًا؛ أما التشغيل اليدوي فيعمل دائمًا.',
              en: 'Master switch of the daily money check (08:15 Riyadh). When off, the scheduled run checks nothing; a run started by hand still runs.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'sampleSize',
            label: {
              ar: 'النتائج المحفوظة لكل فحص',
              en: 'Findings kept per check',
            },
            help: {
              ar: 'عدد النتائج التي يحفظها كل فحص في التشغيل (من 1 إلى 500). العدد الكلي للنتائج يبقى كاملًا دائمًا.',
              en: 'How many findings each check stores in a run (1 to 500). The count of findings is always complete.',
            },
            type: 'integer',
            value: 50,
            default: 50,
            min: 1,
            max: 500,
          },
        ],
      },
      {
        id: 'stuck',
        title: {
          ar: 'عتبات الأموال العالقة',
          en: 'Stuck-money thresholds',
        },
        description: {
          ar: 'متى يُعدّ المال المنتظر عالقًا.',
          en: 'When waiting money counts as stuck.',
        },
        fields: [
          {
            key: 'refundOpenHours',
            label: {
              ar: 'استرداد معلّق (ساعات)',
              en: 'Refund pending (hours)',
            },
            help: {
              ar: 'الساعات التي يبقى فيها الاسترداد معلّقًا أو قيد المعالجة قبل أن يُعدّ متأخرًا.',
              en: 'Hours a refund may stay pending or processing before the check reports it as stuck.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 720,
          },
          {
            key: 'refundFailedHours',
            label: {
              ar: 'استرداد فاشل دون معالجة (ساعات)',
              en: 'Failed refund unresolved (hours)',
            },
            help: {
              ar: 'الساعات التي ينتظر فيها الاسترداد الفاشل إعادة المحاولة أو التسجيل خارج المنصة قبل أن يُعدّ متأخرًا.',
              en: 'Hours a failed refund may wait for a retry or an offline settlement before it is reported as stuck.',
            },
            type: 'duration',
            value: 12,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 720,
          },
          {
            key: 'reviewOpenHours',
            label: {
              ar: 'دفعة قيد المراجعة (ساعات)',
              en: 'Payment in review (hours)',
            },
            help: {
              ar: 'الساعات التي تبقى فيها الدفعة قيد المراجعة (تحصيل ناقص أو بعملة أخرى) قبل أن تُعدّ متأخرة.',
              en: 'Hours a payment may stay under review (captured short or in another currency) before it is reported as stuck.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 720,
          },
          {
            key: 'unappliedPaymentHours',
            label: {
              ar: 'دفعة محصَّلة غير مسجَّلة (ساعات)',
              en: 'Captured payment not applied (hours)',
            },
            help: {
              ar: 'الساعات التي تبقى فيها دفعة حجز محصَّلة دون تسجيلها على الحجز ودون استردادها قبل أن تُعدّ متأخرة.',
              en: 'Hours a captured booking payment may stay neither recorded on its booking nor refunded before it is reported as stuck.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 720,
          },
          {
            key: 'walletHoldHours',
            label: {
              ar: 'حجز محفظة مفتوح (ساعات)',
              en: 'Wallet hold open (hours)',
            },
            help: {
              ar: 'الساعات التي يبقى فيها حجز محفظة لدفعة منتهية مفتوحًا (لم يُحصَّل ولم يُحرَّر) قبل أن يُعدّ متأخرًا.',
              en: 'Hours a wallet hold of a finished payment may stay open (never captured or released) before it is reported as stuck.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 720,
          },
        ],
      },
      {
        id: 'documents',
        title: {
          ar: 'المستندات والتدقيق',
          en: 'Documents & audit',
        },
        description: {
          ar: 'تأخر الإيصالات وسجلات التدقيق عن حركة المال.',
          en: 'How far receipts and audit rows may lag a money movement.',
        },
        fields: [
          {
            key: 'documentGraceMinutes',
            label: {
              ar: 'مهلة المستندات (دقائق)',
              en: 'Document grace period (minutes)',
            },
            help: {
              ar: 'الدقائق التي يمكن أن يتأخر فيها الإيصال أو الإشعار الدائن أو قيد التدقيق عن حركة الأموال قبل أن تُعدّ الحركة بلا مستند.',
              en: 'Minutes a receipt, credit note or audit entry may lag behind its money movement before the movement is reported as undocumented.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 5,
            max: 1440,
          },
          {
            key: 'auditLookbackDays',
            label: {
              ar: 'مدة مراجعة التدقيق (أيام)',
              en: 'Audit look-back (days)',
            },
            help: {
              ar: 'أيام حركات الأموال التي ينفذها الموظفون (استرداد خارج المنصة، دفعات يدوية، تعديلات محفظة) التي يُتحقَّق من وجود قيد تدقيق لها.',
              en: 'Days of staff money movements (offline refunds, manual payments, wallet adjustments) checked for their audit entry.',
            },
            type: 'duration',
            value: 35,
            default: 35,
            unit: 'days',
            min: 1,
            max: 365,
          },
        ],
      },
      {
        id: 'retention',
        title: {
          ar: 'الاحتفاظ',
          en: 'Retention',
        },
        description: {
          ar: 'يظهر أيضًا في نظرة «مدد الاحتفاظ».',
          en: 'Also listed in the data retention overview.',
        },
        fields: [
          {
            key: 'keepRunsDays',
            label: {
              ar: 'الاحتفاظ بالتشغيلات (أيام)',
              en: 'Keep runs (days)',
            },
            help: {
              ar: 'الأيام التي يُحتفظ فيها بكل تشغيل؛ وتحذف المهمة اليومية التشغيلات الأقدم.',
              en: 'Days a stored run is kept; older runs are deleted by the daily job.',
            },
            type: 'duration',
            value: 400,
            default: 400,
            unit: 'days',
            min: 30,
            max: 3650,
          },
        ],
      },
    ],
  },
  {
    key: 'accounting_access',
    section: 'finance',
    icon: 'EyeOff',
    title: {
      ar: 'ما يراه المحاسب',
      en: 'What the accountant sees',
    },
    summary: {
      ar: 'حقلًا بحقل: ظاهر أو مخفي جزئيًا أو محذوف عند المحاسب',
      en: 'Field by field: visible, masked or removed for the accountant',
    },
    description: {
      ar: 'ما يراه المحاسب من كل حقل للمشتري والعميل، في شاشات المالية وملفات التصدير: «ظاهر» يعرضه، و«مخفي جزئيًا» يخفي معظمه، و«محذوف» يزيل العمود والقيمة. هذه سياسة واحدة للمنصة كلها، وتسري على كل من يملك صلاحية invoicing.export. أما من يملك users.reveal_pii فيرى كل شيء أيًا كان الإعداد هنا، ومن لا يملك invoicing.export يبقى على الإخفاء المعتاد. كل حقل هنا إعداد أمني: التغيير من غير المالك يُرسل للموافقة ولا يُطبَّق إلا بعد موافقة مدير ثانٍ. تبقى مستندات PDF الصادرة كاملة.',
      en: 'What the accountant sees of each buyer and customer field, on the finance screens and in the exports: visible shows it, masked hides most of it, removed drops the column and the value. This is one policy for the whole platform, and it applies to every holder of invoicing.export. Staff who hold users.reveal_pii see everything whatever is set here, and staff without invoicing.export keep the usual masks. Every field is a security setting: a change by anyone but the owner is sent for approval and applied only when a second admin approves it. Issued PDF documents stay whole.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'second-approver',
    version: 4,
    schemaVersion: 2,
    updatedAt: '2026-11-06T16:20:00.000Z',
    updatedBy: 'Sara Haddad',
    subsections: [
      {
        id: 'buyer',
        title: {
          ar: 'الفواتير (المشتري)',
          en: 'Invoices (buyer)',
        },
        description: {
          ar: 'ما يراه المحاسب من بيانات المشتري.',
          en: 'What the accountant sees of the buyer.',
        },
        fields: [
          {
            key: 'fields.buyerName',
            label: {
              ar: 'اسم المشتري',
              en: 'Buyer name',
            },
            help: {
              ar: 'اسم المشتري في الفواتير.',
              en: "The buyer's name on invoices.",
            },
            type: 'enum',
            value: 'visible',
            default: 'visible',
            options: [
              {
                value: 'visible',
                label: {
                  ar: 'ظاهر',
                  en: 'Visible',
                },
              },
              {
                value: 'masked',
                label: {
                  ar: 'مخفي جزئيًا',
                  en: 'Masked',
                },
              },
              {
                value: 'removed',
                label: {
                  ar: 'محذوف',
                  en: 'Removed',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'fields.buyerEmail',
            label: {
              ar: 'بريد المشتري',
              en: 'Buyer e-mail',
            },
            help: {
              ar: 'البريد الإلكتروني للمشتري في الفواتير.',
              en: "The buyer's e-mail on invoices.",
            },
            type: 'enum',
            value: 'masked',
            default: 'masked',
            options: [
              {
                value: 'visible',
                label: {
                  ar: 'ظاهر',
                  en: 'Visible',
                },
              },
              {
                value: 'masked',
                label: {
                  ar: 'مخفي جزئيًا',
                  en: 'Masked',
                },
              },
              {
                value: 'removed',
                label: {
                  ar: 'محذوف',
                  en: 'Removed',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'fields.buyerCompany',
            label: {
              ar: 'شركة المشتري',
              en: 'Buyer company',
            },
            help: {
              ar: 'شركة المشتري في الفواتير.',
              en: "The buyer's company on invoices.",
            },
            type: 'enum',
            value: 'visible',
            default: 'visible',
            options: [
              {
                value: 'visible',
                label: {
                  ar: 'ظاهر',
                  en: 'Visible',
                },
              },
              {
                value: 'masked',
                label: {
                  ar: 'مخفي جزئيًا',
                  en: 'Masked',
                },
              },
              {
                value: 'removed',
                label: {
                  ar: 'محذوف',
                  en: 'Removed',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'fields.buyerTaxId',
            label: {
              ar: 'الرقم الضريبي للمشتري',
              en: 'Buyer tax number',
            },
            help: {
              ar: 'الرقم الضريبي للمشتري في الفواتير.',
              en: "The buyer's tax number on invoices.",
            },
            type: 'enum',
            value: 'visible',
            default: 'masked',
            options: [
              {
                value: 'visible',
                label: {
                  ar: 'ظاهر',
                  en: 'Visible',
                },
              },
              {
                value: 'masked',
                label: {
                  ar: 'مخفي جزئيًا',
                  en: 'Masked',
                },
              },
              {
                value: 'removed',
                label: {
                  ar: 'محذوف',
                  en: 'Removed',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'fields.buyerAddress',
            label: {
              ar: 'عنوان المشتري',
              en: 'Buyer address',
            },
            help: {
              ar: 'عنوان المشتري ومدينته وبلده في شاشة الفاتورة. لا يوجد هذا العمود في ملف تصدير الفواتير.',
              en: "The buyer's address, city and country on the invoice screen. The invoices export has no such column.",
            },
            type: 'enum',
            value: 'visible',
            default: 'visible',
            options: [
              {
                value: 'visible',
                label: {
                  ar: 'ظاهر',
                  en: 'Visible',
                },
              },
              {
                value: 'masked',
                label: {
                  ar: 'مخفي جزئيًا',
                  en: 'Masked',
                },
              },
              {
                value: 'removed',
                label: {
                  ar: 'محذوف',
                  en: 'Removed',
                },
              },
            ],
            control: 'security',
          },
        ],
      },
      {
        id: 'customer',
        title: {
          ar: 'المدفوعات (العميل)',
          en: 'Payments (customer)',
        },
        description: {
          ar: 'بيانات العميل على المدفوعات والقيود.',
          en: 'Customer data on payments and ledger lines.',
        },
        fields: [
          {
            key: 'fields.customerName',
            label: {
              ar: 'اسم العميل',
              en: 'Customer name',
            },
            help: {
              ar: 'اسم العميل في المدفوعات.',
              en: "The customer's name on payments.",
            },
            type: 'enum',
            value: 'visible',
            default: 'visible',
            options: [
              {
                value: 'visible',
                label: {
                  ar: 'ظاهر',
                  en: 'Visible',
                },
              },
              {
                value: 'masked',
                label: {
                  ar: 'مخفي جزئيًا',
                  en: 'Masked',
                },
              },
              {
                value: 'removed',
                label: {
                  ar: 'محذوف',
                  en: 'Removed',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'fields.customerEmail',
            label: {
              ar: 'بريد العميل',
              en: 'Customer e-mail',
            },
            help: {
              ar: 'البريد الإلكتروني للعميل في المدفوعات.',
              en: "The customer's e-mail on payments.",
            },
            type: 'enum',
            value: 'removed',
            default: 'masked',
            options: [
              {
                value: 'visible',
                label: {
                  ar: 'ظاهر',
                  en: 'Visible',
                },
              },
              {
                value: 'masked',
                label: {
                  ar: 'مخفي جزئيًا',
                  en: 'Masked',
                },
              },
              {
                value: 'removed',
                label: {
                  ar: 'محذوف',
                  en: 'Removed',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'fields.customerId',
            label: {
              ar: 'معرّف العميل',
              en: 'Customer ID',
            },
            help: {
              ar: 'معرّف حساب العميل في المدفوعات والفواتير وقيود دفتر الأستاذ. عند إخفائه أو حذفه لا يظهر المعرّف في الشاشات ولا يفتح اسم العميل صفحته؛ والإخفاء يبقي عمود الملف المصدَّر بالقيمة •••، والحذف يزيله.',
              en: "The customer's account id on payments, invoices and ledger lines. Masked or removed, the screens show no id and the customer's name links nowhere; masked keeps the export column as •••, removed drops it.",
            },
            type: 'enum',
            value: 'visible',
            default: 'visible',
            options: [
              {
                value: 'visible',
                label: {
                  ar: 'ظاهر',
                  en: 'Visible',
                },
              },
              {
                value: 'masked',
                label: {
                  ar: 'مخفي جزئيًا',
                  en: 'Masked',
                },
              },
              {
                value: 'removed',
                label: {
                  ar: 'محذوف',
                  en: 'Removed',
                },
              },
            ],
            control: 'security',
          },
        ],
      },
      {
        id: 'gateway',
        title: {
          ar: 'مراجع البوابة',
          en: 'Gateway references',
        },
        description: {
          ar: 'معرّفات البوابة وآخر رد خام.',
          en: 'Gateway ids and the last raw response.',
        },
        fields: [
          {
            key: 'fields.gatewayPaymentId',
            label: {
              ar: 'مراجع بوابة الدفع',
              en: 'Gateway references',
            },
            help: {
              ar: 'معرّفات بوابة الدفع في المدفوعات والمبالغ المستردة. إذا أُخفيت أو حُذفت يُخفى معها معرّف العميل لدى البوابة ومعرّفات الاسترداد والرد الخام للبوابة.',
              en: "The gateway's own ids on payments and refunds. Masked or removed, this also hides the gateway's customer id, its refund ids and its raw response.",
            },
            type: 'enum',
            value: 'visible',
            default: 'visible',
            options: [
              {
                value: 'visible',
                label: {
                  ar: 'ظاهر',
                  en: 'Visible',
                },
              },
              {
                value: 'masked',
                label: {
                  ar: 'مخفي جزئيًا',
                  en: 'Masked',
                },
              },
              {
                value: 'removed',
                label: {
                  ar: 'محذوف',
                  en: 'Removed',
                },
              },
            ],
            control: 'security',
          },
        ],
      },
    ],
  },
];

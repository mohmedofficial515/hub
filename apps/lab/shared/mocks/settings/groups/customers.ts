// Settings groups of the "customers" section.
// Generated from the backend groups (src/modules/settings/groups) and the dashboard dictionaries; see audit.md
// in dashboard/settings. Fields with `proposed: true` are NOT in the real API (audit proposals, P0/P1).

import type { SettingsGroup } from '../types';

export const CUSTOMER_GROUPS: SettingsGroup[] = [
  {
    key: 'account',
    section: 'customers',
    icon: 'UserCog',
    title: {
      ar: 'حسابات العملاء',
      en: 'Customer accounts',
    },
    summary: {
      ar: 'حذف الحسابات وتصدير البيانات',
      en: 'Account deletion and data export',
    },
    description: {
      ar: 'مهلة حذف حسابات العملاء وحدود تصدير البيانات الشخصية.',
      en: 'Customer account deletion grace period and personal data export limits.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 2,
    schemaVersion: 1,
    updatedAt: '2026-09-27T23:20:00.000Z',
    updatedBy: 'System (defaults)',
    subsections: [
      {
        id: 'deletion',
        title: {
          ar: 'حذف الحساب',
          en: 'Account deletion',
        },
        description: {
          ar: 'مهلة يستطيع العميل خلالها التراجع عن الحذف.',
          en: 'Grace period in which the customer can cancel the deletion.',
        },
        fields: [
          {
            key: 'deletion.graceDays',
            label: {
              ar: 'مهلة الإلغاء (أيام)',
              en: 'Grace period (days)',
            },
            help: {
              ar: 'عدد الأيام بين طلب الحذف ومسح الحساب، ويمكن للعميل الإلغاء حتى ذلك الحين.',
              en: 'Days between a deletion request and the erasure of the account. The customer can cancel until then.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'days',
            min: 1,
            max: 90,
          },
          {
            key: 'deletion.walletBalancePolicy',
            label: {
              ar: 'رصيد المحفظة عند الحذف',
              en: 'Wallet balance at deletion',
            },
            help: {
              ar: 'ماذا يحدث لرصيد المحفظة والرحلات القادمة عند طلب الحذف: رفض الطلب حتى تُسوّى، أو ردّ الرصيد النقدي للبطاقة، أو إسقاطه.',
              en: 'What happens to a wallet balance and upcoming trips on a deletion request: block it until settled, refund the cash balance to the card, or forfeit it.',
            },
            type: 'enum',
            value: 'block',
            default: 'block',
            options: [
              {
                value: 'block',
                label: {
                  ar: 'رفض الطلب حتى تُسوّى',
                  en: 'Block until settled',
                },
              },
              {
                value: 'refund',
                label: {
                  ar: 'ردّ الرصيد النقدي للبطاقة',
                  en: 'Refund cash to the card',
                },
              },
              {
                value: 'forfeit',
                label: {
                  ar: 'إسقاط الرصيد',
                  en: 'Forfeit the balance',
                },
              },
            ],
            risk: 'high',
            proposed: true,
            proposalId: 'S-09',
            priority: 'P1',
            needsBackend: true,
          },
        ],
      },
      {
        id: 'export',
        title: {
          ar: 'تصدير البيانات الشخصية',
          en: 'Personal data export',
        },
        description: {
          ar: 'حدود أرشيف «نزّل بياناتي».',
          en: 'Limits of the "download my data" archive.',
        },
        fields: [
          {
            key: 'export.linkTtlDays',
            label: {
              ar: 'إتاحة التنزيل (أيام)',
              en: 'Download available for (days)',
            },
            help: {
              ar: 'عدد الأيام التي يبقى فيها ملف التصدير متاحًا للتنزيل قبل حذفه.',
              en: 'Days an export archive stays downloadable before it is deleted.',
            },
            type: 'duration',
            value: 7,
            default: 7,
            unit: 'days',
            min: 1,
            max: 30,
          },
          {
            key: 'export.cooldownHours',
            label: {
              ar: 'الانتظار بين عمليات التصدير (ساعات)',
              en: 'Wait between exports (hours)',
            },
            help: {
              ar: 'عدد الساعات التي ينتظرها العميل بين طلبي تصدير.',
              en: 'Hours a customer must wait between two export requests.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 0,
            max: 720,
          },
        ],
      },
    ],
  },
  {
    key: 'travellers',
    section: 'customers',
    icon: 'Users',
    title: {
      ar: 'المسافرون',
      en: 'Travellers',
    },
    summary: {
      ar: 'المسافرون المحفوظون والوثائق',
      en: 'Saved travellers and documents',
    },
    description: {
      ar: 'حدود المسافرين المحفوظين، وقاعدة صلاحية جواز السفر، وحصص خزنة الوثائق.',
      en: 'Saved traveller limits, the passport validity rule and document vault quotas.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 3,
    schemaVersion: 1,
    updatedAt: '2026-10-14T13:00:00.000Z',
    updatedBy: 'Lina Mansour',
    subsections: [
      {
        id: 'saved',
        title: {
          ar: 'المسافرون المحفوظون',
          en: 'Saved travellers',
        },
        description: {
          ar: 'الحد الأقصى وصلاحية جواز السفر.',
          en: 'Limit and passport validity.',
        },
        fields: [
          {
            key: 'maxTravellers',
            label: {
              ar: 'المسافرون المحفوظون لكل حساب',
              en: 'Saved travellers per account',
            },
            help: {
              ar: 'عدد المسافرين المحفوظين المسموح به للحساب، ومنهم صاحب الحساب.',
              en: 'Saved travellers one account may keep, its own traveller included.',
            },
            type: 'integer',
            value: 20,
            default: 20,
            min: 1,
            max: 100,
          },
          {
            key: 'passportValidityMonths',
            label: {
              ar: 'صلاحية جواز السفر (أشهر)',
              en: 'Passport validity (months)',
            },
            help: {
              ar: 'عدد الأشهر التي يجب أن تبقى فيها وثيقة السفر صالحة بعد آخر وصول، وإلا يظهر تحذير.',
              en: 'Months a travel document must stay valid after the last arrival, or a warning is shown.',
            },
            type: 'duration',
            value: 6,
            default: 6,
            unit: 'months',
            min: 0,
            max: 12,
          },
        ],
      },
      {
        id: 'vault',
        title: {
          ar: 'خزنة الوثائق',
          en: 'Documents vault',
        },
        description: {
          ar: 'أحجام الملفات والحصة وتذكيرات الانتهاء.',
          en: 'File sizes, quota and expiry reminders.',
        },
        fields: [
          {
            key: 'vault.maxFileBytes',
            label: {
              ar: 'أكبر ملف (بايت)',
              en: 'Largest file (bytes)',
            },
            help: {
              ar: 'أكبر ملف واحد يمكن للعميل إرفاقه بوثيقة.',
              en: 'Largest single file a customer may attach to a document.',
            },
            type: 'number',
            value: 10000000,
            default: 10000000,
            min: 100000,
            max: 50000000,
            unit: 'bytes',
          },
          {
            key: 'vault.maxFilesPerDocument',
            label: {
              ar: 'الملفات لكل وثيقة',
              en: 'Files per document',
            },
            help: {
              ar: 'عدد الملفات (الصفحات أو الأوجه) المسموح به لكل وثيقة.',
              en: 'Files (pages or sides) one document may hold.',
            },
            type: 'integer',
            value: 4,
            default: 4,
            min: 1,
            max: 20,
          },
          {
            key: 'vault.quotaBytes',
            label: {
              ar: 'حصة التخزين (بايت)',
              en: 'Storage quota (bytes)',
            },
            help: {
              ar: 'إجمالي البايتات التي يمكن للحساب الاحتفاظ بها في خزنته.',
              en: 'Total bytes one account may keep in its vault.',
            },
            type: 'number',
            value: 200000000,
            default: 200000000,
            min: 1000000,
            max: 5000000000,
            unit: 'bytes',
          },
          {
            key: 'vault.expiryReminderDays',
            label: {
              ar: 'تذكيرات الانتهاء (أيام قبل)',
              en: 'Expiry reminders (days before)',
            },
            help: {
              ar: 'الأيام السابقة لانتهاء الوثيقة التي يُذكَّر فيها مالكها.',
              en: 'Days before a document expires when its owner is reminded.',
            },
            type: 'string-list',
            value: [180, 90, 30, 7],
            default: [180, 90, 30],
            itemType: 'integer',
            itemUnit: 'days',
            max: 6,
          },
        ],
      },
    ],
  },
  {
    key: 'loyalty',
    section: 'customers',
    icon: 'Gift',
    title: {
      ar: 'الولاء',
      en: 'Loyalty',
    },
    summary: {
      ar: 'الكسب والمستويات والاستبدال',
      en: 'Earning, tiers and redemption',
    },
    description: {
      ar: 'برنامج الولاء: معدل الكسب والمستويات والاستبدال وانتهاء الصلاحية.',
      en: 'Loyalty programme: earning rate, tiers, redemption and expiry.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'controls',
    version: 11,
    schemaVersion: 4,
    updatedAt: '2026-11-06T10:45:00.000Z',
    updatedBy: 'Sara Haddad',
    masterSwitch: 'enabled',
    enabled: true,
    subsections: [
      {
        id: 'programme',
        title: {
          ar: 'البرنامج',
          en: 'Programme',
        },
        description: {
          ar: 'تشغيل البرنامج ومتى تُحتسب النقاط.',
          en: 'Programme switch and when points are credited.',
        },
        fields: [
          {
            key: 'enabled',
            label: {
              ar: 'برنامج الولاء',
              en: 'Loyalty programme',
            },
            help: {
              ar: 'المفتاح الرئيسي لكسب النقاط واستبدالها.',
              en: 'Master switch for earning and redeeming points.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'earnTrigger',
            label: {
              ar: 'تُضاف النقاط عند',
              en: 'Points credited on',
            },
            help: {
              ar: 'حدث الحجز الذي تُضاف عنده النقاط.',
              en: 'Booking event that credits the points.',
            },
            type: 'enum',
            value: 'BOOKING_CONFIRMED',
            default: 'BOOKING_CONFIRMED',
            options: [
              {
                value: 'BOOKING_CONFIRMED',
                label: {
                  ar: 'تأكيد الحجز',
                  en: 'Booking confirmed',
                },
              },
              {
                value: 'BOOKING_PAID',
                label: {
                  ar: 'دفع الحجز',
                  en: 'Booking paid',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'earning',
        title: {
          ar: 'الكسب',
          en: 'Earning',
        },
        description: {
          ar: 'النقاط لكل دولار والمضاعفات حسب المنتج.',
          en: 'Points per dollar and multipliers per product.',
        },
        fields: [
          {
            key: 'pointsPerUsd',
            label: {
              ar: 'النقاط لكل دولار',
              en: 'Points per USD',
            },
            help: {
              ar: 'النقاط المكتسبة لكل دولار من الإنفاق المؤهل.',
              en: 'Points earned per USD of eligible spend.',
            },
            type: 'number',
            value: 1,
            default: 1,
            min: 0,
            max: 1000,
            unit: 'points',
            control: 'money',
            step: 0.1,
          },
          {
            key: 'multipliers.byProduct.FLIGHT',
            label: {
              ar: 'مضاعِف إضافي — الطيران',
              en: 'Extra multiplier — Flights',
            },
            help: {
              ar: 'مضاعِف إضافي لنقاط حجوزات الطيران (غير المحدد = 1). يُضاف منتج الفنادق عند تشغيله.',
              en: 'Extra multiplier on points of flight bookings (missing = 1). Hotels join when the product is switched on.',
            },
            type: 'number',
            value: 1,
            default: 1,
            min: 0,
            max: 10,
            control: 'money',
            step: 0.05,
          },
        ],
      },
      {
        id: 'tiers',
        title: {
          ar: 'المستويات',
          en: 'Tiers',
        },
        description: {
          ar: 'من الأدنى إلى الأعلى؛ الأول هو مستوى الدخول. الأسماء والمزايا للعرض فقط.',
          en: 'Lowest to highest; the first is the entry tier. Names and benefits are display only.',
        },
        fields: [
          {
            key: 'tiers.0.threshold.amount',
            label: {
              ar: 'القيمة — أزرق',
              en: 'Amount — Blue',
            },
            help: {
              ar: 'قيمة المقياس اللازمة للوصول إلى المستوى.',
              en: 'Amount of the measure needed to reach the tier.',
            },
            type: 'money',
            value: 0,
            default: 0,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'money',
          },
          {
            key: 'tiers.0.multiplier',
            label: {
              ar: 'مضاعِف النقاط — أزرق',
              en: 'Points multiplier — Blue',
            },
            help: {
              ar: 'المضاعِف المطبَّق على النقاط المكتسبة في هذا المستوى.',
              en: 'Multiplier applied to points earned while in this tier.',
            },
            type: 'number',
            value: 1,
            default: 1,
            min: 0,
            max: 10,
            control: 'money',
            step: 0.05,
          },
          {
            key: 'tiers.0.discountPercent',
            label: {
              ar: 'الخصم (% من الهامش) — أزرق',
              en: 'Discount (% of the markup) — Blue',
            },
            help: {
              ar: 'خصم (من 0 إلى 100، نسبة من الهامش) على الأسعار لأعضاء هذا المستوى.',
              en: 'Discount (0 to 100, a percent of the markup) on prices for members of this tier.',
            },
            type: 'number',
            value: 0,
            default: 0,
            min: 0,
            max: 100,
            unit: 'percent',
            step: 0.5,
            control: 'money',
          },
          {
            key: 'tiers.0.validityMonths',
            label: {
              ar: 'الصلاحية (أشهر) — أزرق',
              en: 'Validity (months) — Blue',
            },
            help: {
              ar: 'عدد الأشهر التي يُحتفظ فيها بالمستوى قبل إعادة تقييمه.',
              en: 'Months the tier is kept before it is evaluated again.',
            },
            type: 'duration',
            value: 12,
            default: 12,
            unit: 'months',
            min: 1,
            max: 120,
            control: 'money',
          },
          {
            key: 'tiers.1.threshold.amount',
            label: {
              ar: 'القيمة — فضي',
              en: 'Amount — Silver',
            },
            help: {
              ar: 'قيمة المقياس اللازمة للوصول إلى المستوى.',
              en: 'Amount of the measure needed to reach the tier.',
            },
            type: 'money',
            value: 2500,
            default: 2500,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'money',
          },
          {
            key: 'tiers.1.multiplier',
            label: {
              ar: 'مضاعِف النقاط — فضي',
              en: 'Points multiplier — Silver',
            },
            help: {
              ar: 'المضاعِف المطبَّق على النقاط المكتسبة في هذا المستوى.',
              en: 'Multiplier applied to points earned while in this tier.',
            },
            type: 'number',
            value: 1.25,
            default: 1.25,
            min: 0,
            max: 10,
            control: 'money',
            step: 0.05,
          },
          {
            key: 'tiers.1.discountPercent',
            label: {
              ar: 'الخصم (% من الهامش) — فضي',
              en: 'Discount (% of the markup) — Silver',
            },
            help: {
              ar: 'خصم (من 0 إلى 100، نسبة من الهامش) على الأسعار لأعضاء هذا المستوى.',
              en: 'Discount (0 to 100, a percent of the markup) on prices for members of this tier.',
            },
            type: 'number',
            value: 0,
            default: 0,
            min: 0,
            max: 100,
            unit: 'percent',
            step: 0.5,
            control: 'money',
          },
          {
            key: 'tiers.1.validityMonths',
            label: {
              ar: 'الصلاحية (أشهر) — فضي',
              en: 'Validity (months) — Silver',
            },
            help: {
              ar: 'عدد الأشهر التي يُحتفظ فيها بالمستوى قبل إعادة تقييمه.',
              en: 'Months the tier is kept before it is evaluated again.',
            },
            type: 'duration',
            value: 12,
            default: 12,
            unit: 'months',
            min: 1,
            max: 120,
            control: 'money',
          },
          {
            key: 'tiers.2.threshold.amount',
            label: {
              ar: 'القيمة — ذهبي',
              en: 'Amount — Gold',
            },
            help: {
              ar: 'قيمة المقياس اللازمة للوصول إلى المستوى.',
              en: 'Amount of the measure needed to reach the tier.',
            },
            type: 'money',
            value: 10000,
            default: 10000,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'money',
          },
          {
            key: 'tiers.2.multiplier',
            label: {
              ar: 'مضاعِف النقاط — ذهبي',
              en: 'Points multiplier — Gold',
            },
            help: {
              ar: 'المضاعِف المطبَّق على النقاط المكتسبة في هذا المستوى.',
              en: 'Multiplier applied to points earned while in this tier.',
            },
            type: 'number',
            value: 1.75,
            default: 1.5,
            min: 0,
            max: 10,
            control: 'money',
            step: 0.05,
          },
          {
            key: 'tiers.2.discountPercent',
            label: {
              ar: 'الخصم (% من الهامش) — ذهبي',
              en: 'Discount (% of the markup) — Gold',
            },
            help: {
              ar: 'خصم (من 0 إلى 100، نسبة من الهامش) على الأسعار لأعضاء هذا المستوى.',
              en: 'Discount (0 to 100, a percent of the markup) on prices for members of this tier.',
            },
            type: 'number',
            value: 5,
            default: 0,
            min: 0,
            max: 100,
            unit: 'percent',
            step: 0.5,
            control: 'money',
          },
          {
            key: 'tiers.2.validityMonths',
            label: {
              ar: 'الصلاحية (أشهر) — ذهبي',
              en: 'Validity (months) — Gold',
            },
            help: {
              ar: 'عدد الأشهر التي يُحتفظ فيها بالمستوى قبل إعادة تقييمه.',
              en: 'Months the tier is kept before it is evaluated again.',
            },
            type: 'duration',
            value: 12,
            default: 12,
            unit: 'months',
            min: 1,
            max: 120,
            control: 'money',
          },
        ],
      },
      {
        id: 'redemption',
        title: {
          ar: 'الاستبدال',
          en: 'Redemption',
        },
        description: {
          ar: 'تحويل النقاط إلى رصيد في المحفظة.',
          en: 'Turning points into wallet credit.',
        },
        fields: [
          {
            key: 'redemption.enabled',
            label: {
              ar: 'الاستبدال',
              en: 'Redemption',
            },
            help: {
              ar: 'يمكن للعملاء تحويل النقاط إلى رصيد في المحفظة.',
              en: 'Customers may convert points into wallet credit.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'redemption.pointValueUsd',
            label: {
              ar: 'قيمة النقطة (USD)',
              en: 'Point value (USD)',
            },
            help: {
              ar: 'المبلغ بالدولار المضاف لكل نقطة مستبدلة.',
              en: 'USD credited per point redeemed.',
            },
            type: 'money',
            value: 0.01,
            default: 0.01,
            min: 0,
            max: 100,
            unit: 'USD',
            step: 0.001,
            control: 'money',
          },
          {
            key: 'redemption.minPoints',
            label: {
              ar: 'أقل عدد من النقاط',
              en: 'Fewest points',
            },
            help: {
              ar: 'أقل عدد من النقاط يمكن استبداله.',
              en: 'Smallest number of points that can be redeemed.',
            },
            type: 'integer',
            value: 500,
            default: 500,
            min: 0,
          },
          {
            key: 'redemption.maxPointsPerRedemption',
            label: {
              ar: 'أقصى نقاط في الاستبدال الواحد',
              en: 'Most points per redemption',
            },
            help: {
              ar: 'الحد الأقصى لكل عملية استبدال. أوقفه لإلغاء الحد.',
              en: 'Limit per redemption. Switch it off for no limit.',
            },
            type: 'integer',
            value: 50000,
            default: null,
            nullable: true,
            min: 1,
            control: 'money',
          },
          {
            key: 'redemption.maxPercentOfBookingTotal',
            label: {
              ar: 'أقصى حصة من الحجز بالنقاط',
              en: 'Most of a booking paid with points',
            },
            help: {
              ar: 'أكبر نسبة من إجمالي الحجز يمكن دفعها بالنقاط.',
              en: 'Largest share of a booking total payable with points.',
            },
            type: 'number',
            value: 50,
            default: 50,
            min: 0,
            max: 100,
            unit: 'percent',
            step: 0.5,
            control: 'money',
          },
        ],
      },
      {
        id: 'expiry',
        title: {
          ar: 'انتهاء النقاط',
          en: 'Points expiry',
        },
        description: {
          ar: 'تنتهي النقاط الأقدم أولًا بعد المدة.',
          en: 'Oldest points expire first after the lifetime.',
        },
        fields: [
          {
            key: 'expiry.enabled',
            label: {
              ar: 'انتهاء صلاحية النقاط',
              en: 'Points expire',
            },
            help: {
              ar: 'تنتهي صلاحية النقاط، الأقدم أولًا، بعد المدة أدناه.',
              en: 'Points expire, oldest first, after the lifetime below.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'expiry.monthsAfterEarn',
            label: {
              ar: 'مدة الصلاحية (أشهر)',
              en: 'Lifetime (months)',
            },
            help: {
              ar: 'مدة صلاحية النقاط المكتسبة بالأشهر.',
              en: 'Lifetime of earned points in months.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'months',
            min: 1,
            max: 120,
          },
          {
            key: 'expiry.reminderDaysBefore',
            label: {
              ar: 'التذكيرات (أيام قبل)',
              en: 'Reminders (days before)',
            },
            help: {
              ar: 'الأيام السابقة لانتهاء الصلاحية التي تُرسل فيها التذكيرات.',
              en: 'Days before expiry when reminders are sent.',
            },
            type: 'string-list',
            value: [30, 7],
            default: [30, 7],
            itemType: 'integer',
            itemUnit: 'days',
            max: 5,
          },
        ],
      },
      {
        id: 'pending',
        title: {
          ar: 'النقاط المعلّقة والاسترجاع',
          en: 'Pending points & clawback',
        },
        description: {
          ar: 'النقاط معلّقة حتى السفر، وما يحدث لنقاط حجز أُلغي بعد استبدالها.',
          en: 'Points stay pending until travel, and what happens to redeemed points of a cancelled booking.',
        },
        fields: [
          {
            key: 'pending.enabled',
            label: {
              ar: 'إبقاء النقاط المكتسبة معلّقة',
              en: 'Keep earned points pending',
            },
            help: {
              ar: 'مفعّل (موصى به): تنتظر النقاط المكتسبة حتى الرحلة؛ والإلغاء قبلها يلغيها ببساطة. معطّل: تصبح النقاط قابلة للاستبدال فور اكتسابها، والإلغاء اللاحق يتطلب استرجاع ما استُبدل منها.',
              en: 'On (recommended): earned points wait until the trip; cancelling before then simply voids them. Off: points are redeemable as soon as they are earned, and a later cancellation has to claw back what was already redeemed.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
          },
          {
            key: 'pending.releaseAfter',
            label: {
              ar: 'تُتاح بعد',
              en: 'Released after',
            },
            help: {
              ar: 'المغادرة: تصبح النقاط متاحة بعد أول رحلة. العودة: بعد نهاية الرحلة (أو المغادرة إن لم يكن للرحلة تاريخ نهاية).',
              en: 'Departure: the points become available after the first flight. Return: after the end of the trip (the departure when the trip has no end date).',
            },
            type: 'enum',
            value: 'DEPARTURE',
            default: 'DEPARTURE',
            options: [
              {
                value: 'DEPARTURE',
                label: {
                  ar: 'المغادرة',
                  en: 'Departure',
                },
              },
              {
                value: 'RETURN',
                label: {
                  ar: 'العودة',
                  en: 'Return',
                },
              },
            ],
            control: 'money',
          },
          {
            key: 'pending.daysAfterTravel',
            label: {
              ar: 'أيام بعد السفر',
              en: 'Days after travel',
            },
            help: {
              ar: 'عدد الأيام بعد تاريخ السفر ذاك قبل أن تصبح النقاط متاحة. 0 يعني اليوم نفسه. الافتراضي 1.',
              en: 'Days after that travel date before the points become available. 0 means the same day. Default 1.',
            },
            type: 'duration',
            value: 1,
            default: 1,
            unit: 'days',
            min: 0,
            max: 365,
            control: 'money',
          },
          {
            key: 'pending.fallbackDays',
            label: {
              ar: 'عندما يكون تاريخ السفر غير معروف (أيام)',
              en: 'When the travel date is unknown (days)',
            },
            help: {
              ar: 'إن لم يكن تاريخ السفر معروفًا بعد تبقى النقاط معلّقة هذا العدد من الأيام بعد اكتسابها؛ وتعيد مهمة الإتاحة كل ساعة فحص تاريخ السفر قبل إتاحتها. الافتراضي 30.',
              en: 'When the travel date is not known yet, the points stay pending this many days after they were earned; the hourly release job checks the travel date again before releasing them. Default 30.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'days',
            min: 1,
            max: 365,
            control: 'money',
          },
          {
            key: 'clawback.fromOtherPoints',
            label: {
              ar: 'من النقاط الأخرى أولًا',
              en: 'From the other points first',
            },
            help: {
              ar: 'مفعّل: تؤخذ النقاط الناقصة من نقاط العميل المتاحة الأخرى أولًا. معطّل: لا تُمس النقاط الأخرى.',
              en: "On: the missing points are taken from the customer's other available points first. Off: other points are left alone.",
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
          },
          {
            key: 'clawback.fromWallet',
            label: {
              ar: 'ثم من المحفظة',
              en: 'Then from the wallet',
            },
            help: {
              ar: 'مفعّل: ما يبقى ناقصًا يؤخذ من المحفظة بقيمة النقاط (النقاط × قيمة الاستبدال)، من المال الترويجي ومال الولاء أولًا، ودون النزول تحت الصفر. معطّل: لا تُمس المحفظة أبدًا.',
              en: "On: what is still missing is taken from the wallet at the points' value (points × redemption value), promotional and loyalty money first, never below zero. Off: the wallet is never touched.",
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
            risk: 'high',
          },
          {
            key: 'clawback.uncovered',
            label: {
              ar: 'ما يبقى دون تغطية',
              en: 'What is left uncovered',
            },
            help: {
              ar: 'تسجيله دَينًا (موصى به): يُسجَّل دَين نقاط يُسدَّد تلقائيًا من النقاط التالية التي تصبح متاحة. شطبه: يُعفى منه (يُسجَّل في عملية الاسترجاع ولا يبقى شيء مستحق).',
              en: 'Carry as debt (recommended): recorded as a points debt that is repaid automatically from the next points that become available. Write off: forgiven (recorded on the reversal, nothing owed).',
            },
            type: 'enum',
            value: 'CARRY_DEBT',
            default: 'CARRY_DEBT',
            options: [
              {
                value: 'CARRY_DEBT',
                label: {
                  ar: 'تسجيله دَينًا',
                  en: 'Carry as debt',
                },
              },
              {
                value: 'WRITE_OFF',
                label: {
                  ar: 'شطبه',
                  en: 'Write off',
                },
              },
            ],
            control: 'money',
          },
        ],
      },
      {
        id: 'grants',
        title: {
          ar: 'منح الموظفين',
          en: 'Staff grants',
        },
        description: {
          ar: 'منح النقاط يدويًا ينتظر موافقة موظف ثانٍ.',
          en: 'Manual point grants wait for a second staff member.',
        },
        fields: [
          {
            key: 'manualGrantRequiresApproval',
            label: {
              ar: 'منح النقاط يحتاج موافقة ثانية',
              en: 'Point grants need a second approval',
            },
            help: {
              ar: 'ينتظر منح الموظف للنقاط موافقةَ موظف ثانٍ يملك صلاحية اعتماد منح النقاط قبل إضافتها.',
              en: 'A staff grant of points waits for a second staff member who can approve point grants before the points are added.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
            risk: 'high',
          },
          {
            key: 'maxManualGrantPoints',
            label: {
              ar: 'أكبر منح من الموظف (نقاط)',
              en: 'Largest staff grant (points)',
            },
            help: {
              ar: 'أكبر عدد من النقاط في منح واحد من الموظف. أوقفه لإلغاء الحد.',
              en: 'Largest single staff grant of points. Switch it off for no limit.',
            },
            type: 'integer',
            value: 20000,
            default: null,
            nullable: true,
            min: 1,
            max: 1000000000,
            control: 'money',
          },
        ],
      },
    ],
  },
];

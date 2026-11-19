// Settings groups of the "staff" section.
// Generated from the backend groups (src/modules/settings/groups) and the dashboard dictionaries; see audit.md
// in dashboard/settings. Fields with `proposed: true` are NOT in the real API (audit proposals, P0/P1).

import type { SettingsGroup } from '../types';

export const STAFF_GROUPS: SettingsGroup[] = [
  {
    key: 'agent_booking_policy',
    section: 'staff',
    icon: 'Scale',
    title: {
      ar: 'موافقات حجوزات الموظفين',
      en: 'Agent booking approvals',
    },
    summary: {
      ar: 'الموافقة الثانية على حجوزات الموظفين',
      en: 'Second approval for staff bookings',
    },
    description: {
      ar: 'قواعد الموافقة الثانية على الحجوزات التي ينشئها الموظفون: تعديلات الأسعار والمدفوعات اليدوية.',
      en: 'Second-approval rules of bookings made by staff: price adjustments and manual payments.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'second-approver',
    version: 4,
    schemaVersion: 2,
    updatedAt: '2026-10-21T14:00:00.000Z',
    updatedBy: 'Sara Haddad',
    subsections: [
      {
        id: 'adjust',
        title: {
          ar: 'تعديلات السعر',
          en: 'Price adjustments',
        },
        description: {
          ar: 'هامش أو خصم أو إعفاء من الرسوم يضيفه الموظف.',
          en: 'A markup, discount or fee waiver added by staff.',
        },
        fields: [
          {
            key: 'priceAdjustApprovalRequired',
            label: {
              ar: 'تعديلات الأسعار تحتاج موافقة ثانية',
              en: 'Price adjustments need a second approval',
            },
            help: {
              ar: 'ينتظر تعديل السعر الذي يجريه الموظف على الحجز (هامش أو خصم أو إعفاء من رسوم) موافقةَ موظف ثانٍ يملك صلاحية اعتماد تعديلات الأسعار.',
              en: 'A price adjustment a staff member makes on a booking (markup, discount, fee waiver) waits for a second staff member who can approve price adjustments.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
            risk: 'high',
          },
          {
            key: 'maxAdjustPercentWithoutApproval',
            label: {
              ar: 'يُطبَّق فورًا حتى (% من الإجمالي)',
              en: 'Applied at once up to (% of the total)',
            },
            help: {
              ar: 'عند اشتراط الموافقة، يُطبَّق فورًا ودون موظف ثانٍ أي تعديل لا تتجاوز قيمته هذه النسبة من إجمالي الحجز. القيمة 0 تعني أن كل تعديل ينتظر الموافقة.',
              en: 'When approval is required, an adjustment worth at most this percent of the booking total is applied at once, without a second staff member. 0 means every adjustment waits.',
            },
            type: 'number',
            value: 2,
            default: 0,
            min: 0,
            max: 100,
            unit: 'percent',
            step: 0.5,
            control: 'money',
          },
        ],
      },
      {
        id: 'manual',
        title: {
          ar: 'المدفوعات اليدوية',
          en: 'Manual payments',
        },
        description: {
          ar: 'نقدًا أو بتحويل بنكي: موظف يسجّل وآخر يوافق.',
          en: 'Cash or bank transfer: one staff member records, another approves.',
        },
        fields: [
          {
            key: 'manualPaymentApprovalRequired',
            label: {
              ar: 'المدفوعات اليدوية الكبيرة تحتاج موافقة ثانية',
              en: 'Large manual payments need a second approval',
            },
            help: {
              ar: 'المفتاح الرئيسي للموافقة الثانية على المدفوعات النقدية والتحويلات البنكية التي يسجّلها الموظفون: الدفعة التي تزيد على الحد أدناه تنتظر موظفًا ثانيًا يملك صلاحية اعتماد المدفوعات اليدوية قبل اعتبار الحجز مدفوعًا. المالك لا يحتاج موافقة ثانية أبدًا. مفعّل افتراضيًا (قرار المالك). عند إيقافه تُعتمد كل دفعة فور تسجيلها.',
              en: 'Main switch of the second approval of cash and bank transfer payments recorded by staff: a payment above the threshold below waits for a second staff member allowed to approve manual payments before the booking is paid. The owner never needs a second approval. On by default (owner decision). Off: every payment is accepted as soon as it is recorded.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
            twoPerson: true,
            risk: 'high',
          },
          {
            key: 'manualPaymentApprovalThresholdUsd',
            label: {
              ar: 'حد الموافقة الثانية (USD)',
              en: 'Second approval threshold (USD)',
            },
            help: {
              ar: 'الدفعات اليدوية التي تزيد قيمتها على هذا المبلغ بالدولار (بسعر صرف الحجز) تنتظر موظفًا ثانيًا، وما كان مساويًا له أو أقل يُعتمد فورًا. القيمة 0 تعني أن كل دفعة تنتظر. الافتراضي 500.',
              en: 'Manual payments worth more than this many US dollars (at the booking rate) wait for a second staff member; at or under it they are accepted at once. 0 means every payment waits. Default 500.',
            },
            type: 'money',
            value: 500,
            default: 500,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'money',
            twoPerson: true,
          },
        ],
      },
    ],
  },
  {
    key: 'agent_payment_policy',
    section: 'staff',
    icon: 'Wallet',
    title: {
      ar: 'حدود مدفوعات الموظفين',
      en: 'Agent payment limits',
    },
    summary: {
      ar: 'مدفوعات الموظفين: الروابط وحدود المحفظة',
      en: 'Staff payments: links and wallet limits',
    },
    description: {
      ar: 'كيف يحصّل الموظفون الحجوزات: المدة التي يبقى فيها رابط الدفع صالحاً، وحدود الدفع من محفظة العميل نيابةً عنه.',
      en: 'How staff collect on agent bookings: how long a payment link stays payable and the limits of wallet payments on behalf of a customer.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'controls',
    version: 3,
    schemaVersion: 1,
    updatedAt: '2026-10-08T17:30:00.000Z',
    updatedBy: 'Sara Haddad',
    subsections: [
      {
        id: 'links',
        title: {
          ar: 'روابط الدفع وتثبيت السعر',
          en: 'Payment links & price holds',
        },
        description: {
          ar: 'أقل مدة صلاحية للرابط ومدة تثبيت السعر أثناء الموافقة.',
          en: 'Shortest link lifetime and the price hold while an approval waits.',
        },
        fields: [
          {
            key: 'paymentLinkMinMinutes',
            label: {
              ar: 'يبقى رابط الدفع صالحاً على الأقل (دقائق)',
              en: 'Payment link stays payable at least (minutes)',
            },
            help: {
              ar: 'إذا انتهى قفل السعر قبل ذلك يُعاد فحص السعر لدى شركة الطيران ويُمدد القفل قبل إرسال الرابط، دون تجاوز انتهاء العرض.',
              en: 'When the price lock ends sooner, the fare is re-checked at the airline and the lock extended before the link is sent, never past the offer expiry.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'minutes',
            min: 5,
            max: 1440,
          },
          {
            key: 'manualApprovalHoldMinutes',
            label: {
              ar: 'ثبّت السعر أثناء انتظار الدفعة اليدوية (دقائق)',
              en: 'Hold the price while a manual payment waits (minutes)',
            },
            help: {
              ar: 'أثناء انتظار دفعة نقدية أو تحويل بنكي لموافقة المعتمد، يُعاد فحص السعر ويُثبت هذه المدة (أو يُحجز مؤقتاً إن سمحت الأجرة)، دون تجاوز انتهاء العرض. القيمة 0 تُبقي القفل الحالي فقط.',
              en: 'While a cash or bank transfer payment waits for its approver, the fare is re-checked and the price held this long (or placed on hold when the fare allows), never past the offer expiry. 0 keeps only the current lock.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 0,
            max: 10080,
          },
        ],
      },
      {
        id: 'wallet',
        title: {
          ar: 'الدفع من محفظة العميل',
          en: 'Wallet on behalf',
        },
        description: {
          ar: 'ما يأخذه موظف واحد من محافظ العملاء.',
          en: 'What one staff member may take from customer wallets.',
        },
        fields: [
          {
            key: 'walletOnBehalfDailyCapUsd',
            label: {
              ar: 'حد المحفظة اليومي لكل موظف (USD)',
              en: 'Daily wallet limit per staff member (USD)',
            },
            help: {
              ar: 'أقصى مبلغ يأخذه موظف واحد من محافظ العملاء في اليوم، شاملاً الدفعات المنتظرة للموافقة. القيمة 0 توقف الدفع من المحفظة نيابة عن العميل.',
              en: 'The most one staff member may take from customer wallets per day, pending approvals included. 0 disables wallet payments on behalf.',
            },
            type: 'money',
            value: 1500,
            default: 2000,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'money',
          },
          {
            key: 'walletOnBehalfApprovalThresholdUsd',
            label: {
              ar: 'موافقة ثانية فوق (USD)',
              en: 'Second approval above (USD)',
            },
            help: {
              ar: 'دفعة المحفظة الواحدة نيابة عن العميل التي تتجاوز هذا المبلغ تنتظر موظفاً ثانياً يملك صلاحية اعتماد المدفوعات اليدوية. القيمة 0 تعني أن كل دفعة تنتظر.',
              en: 'A single wallet payment on behalf worth more than this waits for a second staff member who can approve manual payments. 0 means every one waits.',
            },
            type: 'money',
            value: 500,
            default: 500,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'money',
          },
        ],
      },
    ],
  },
  {
    key: 'post_booking_services_policy',
    section: 'staff',
    icon: 'Luggage',
    title: {
      ar: 'الخدمات الإضافية بعد الحجز',
      en: 'Post-booking extras',
    },
    summary: {
      ar: 'الخدمات الإضافية بعد إصدار التذاكر',
      en: 'Extras after ticketing',
    },
    description: {
      ar: 'هل يضيف الموظفون خدمات إضافية إلى حجز مؤكد نيابةً عن العميل، وكيف يحصّلون ثمنها، والمدة التي يبقى فيها عرض السعر الذي ينشئه الموظف صالحاً للدفع، وهل يستطيع العميل إلغاء عرض سعر لم يُدفع.',
      en: 'Whether staff may add extras to a confirmed booking for the customer, how they may collect for them, how long a staff quote stays payable and whether the customer may cancel an unpaid quote.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'controls',
    version: 2,
    schemaVersion: 1,
    updatedAt: '2026-10-10T14:20:00.000Z',
    updatedBy: 'Omar Kaya',
    masterSwitch: 'staffAddEnabled',
    enabled: true,
    notes: {
      ar: 'لا يعمل هذا المسار إذا أُوقف «العمليات بعد الحجز» أو «الخدمات بعد الحجز» في مورّد الطيران.',
      en: 'This path does nothing while "post-booking operations" or "extras after booking" is off in the flight supplier.',
    },
    subsections: [
      {
        id: 'staff',
        title: {
          ar: 'مسار الموظفين',
          en: 'Staff path',
        },
        description: {
          ar: 'إضافة خدمات لحجز مؤكد نيابة عن العميل.',
          en: 'Adding extras to a confirmed booking on the customer’s behalf.',
        },
        fields: [
          {
            key: 'staffAddEnabled',
            label: {
              ar: 'يضيف الموظفون الخدمات نيابةً عن العميل',
              en: 'Staff may add extras for the customer',
            },
            help: {
              ar: 'يستطيع الموظفون إضافة خدمات (أمتعة) إلى حجز مؤكد نيابةً عن العميل وتحصيل ثمنها. عند الإيقاف: يضيف العميل الخدمات بنفسه عبر الموقع فقط.',
              en: "Staff may add extras (bags) to a confirmed booking on the customer's behalf and collect for them. Off: only the customer adds extras on the website.",
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
          },
        ],
      },
      {
        id: 'collect',
        title: {
          ar: 'طرق التحصيل',
          en: 'Collection methods',
        },
        description: {
          ar: 'كيف يحصّل الموظف ثمن الإضافات.',
          en: 'How staff collect for the extras.',
        },
        fields: [
          {
            key: 'paymentLinkEnabled',
            label: {
              ar: 'رابط دفع للخدمات الإضافية',
              en: 'Payment link for extras',
            },
            help: {
              ar: 'يستطيع الموظفون إرسال رابط دفع إلى العميل لسداد ثمن الخدمات الإضافية.',
              en: 'Staff may send the customer a payment link for the extras.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
          },
          {
            key: 'walletOnBehalfEnabled',
            label: {
              ar: 'الدفع من محفظة العميل',
              en: "Pay extras from the customer's wallet",
            },
            help: {
              ar: 'يستطيع الموظفون الذين يملكون صلاحية الدفع نيابةً عن العميل سداد ثمن الخدمات من محفظته، ضمن الحد اليومي وحد الموافقة الثانية في إعدادات مدفوعات الموظفين.',
              en: "Staff who can spend on a customer's behalf may pay the extras from the customer's wallet, within the daily limit and approval threshold of staff payments.",
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
          },
          {
            key: 'manualPaymentEnabled',
            label: {
              ar: 'دفع يدوي للخدمات الإضافية',
              en: 'Manual payment for extras',
            },
            help: {
              ar: 'يستطيع الموظفون الذين يملكون صلاحية تسجيل المدفوعات اليدوية تسجيل دفعة نقدية أو تحويل بنكي لثمن الخدمات، وتنتظر دائماً موافقة موظف ثانٍ.',
              en: "Staff who can record manual payments may record a cash or bank transfer payment for the extras. It always waits for a second staff member's approval.",
            },
            type: 'boolean',
            value: false,
            default: true,
            control: 'money',
          },
        ],
      },
      {
        id: 'quotes',
        title: {
          ar: 'عروض الأسعار',
          en: 'Quotes',
        },
        description: {
          ar: 'صلاحية عرض الموظف وإلغاء العميل.',
          en: 'Staff quote lifetime and customer cancellation.',
        },
        fields: [
          {
            key: 'staffQuoteMinutes',
            label: {
              ar: 'مدة صلاحية عرض سعر الموظف (دقائق)',
              en: 'Staff quote stays payable (minutes)',
            },
            help: {
              ar: 'المدة التي يبقى فيها عرض سعر الخدمات الذي ينشئه الموظف صالحاً للدفع، من 15 إلى 1440 دقيقة. يُعاد فحص سعر شركة الطيران عند شراء الخدمات.',
              en: 'How long a quote for extras opened by staff stays payable, from 15 to 1440 minutes. The airline price is checked again when the extras are bought.',
            },
            type: 'duration',
            value: 45,
            default: 30,
            unit: 'minutes',
            min: 15,
            max: 1440,
            control: 'money',
          },
          {
            key: 'customerCanCancel',
            label: {
              ar: 'يلغي العميل عرض السعر غير المدفوع',
              en: 'Customer may cancel an unpaid quote',
            },
            help: {
              ar: 'يستطيع العميل إلغاء عرض سعر الخدمات الإضافية الذي لم يدفعه بنفسه.',
              en: 'The customer may cancel an unpaid quote for extras themselves.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
        ],
      },
    ],
  },
];

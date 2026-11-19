// Settings groups of the "pricing" section.
// Generated from the backend groups (src/modules/settings/groups) and the dashboard dictionaries; see audit.md
// in dashboard/settings. Fields with `proposed: true` are NOT in the real API (audit proposals, P0/P1).

import type { SettingsGroup } from '../types';

export const PRICING_GROUPS: SettingsGroup[] = [
  {
    key: 'markup_rules',
    section: 'pricing',
    icon: 'BadgePercent',
    title: {
      ar: 'قواعد الهامش',
      en: 'Markup rules',
    },
    summary: {
      ar: 'الهامش على أسعار المورّدين',
      en: 'Markup on supplier prices',
    },
    description: {
      ar: 'الهامش المضاف إلى أسعار المورّدين: قيمة افتراضية وقواعد مرتّبة حسب الأولوية.',
      en: 'Markup applied on top of supplier prices: a default plus prioritised rules.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 21,
    schemaVersion: 1,
    updatedAt: '2026-11-17T19:15:00.000Z',
    updatedBy: 'Lina Mansour',
    subsections: [
      {
        id: 'source',
        title: {
          ar: 'مصدر القواعد',
          en: 'Rules source',
        },
        description: {
          ar: 'من أين تُقرأ قواعد الهامش: هذه المجموعة أو جدول القواعد.',
          en: 'Where markup rules are read from: this group or the rules table.',
        },
        fields: [
          {
            key: 'rulesSource',
            label: {
              ar: 'مصدر القواعد',
              en: 'Rules source',
            },
            help: {
              ar: 'الإعدادات: تحدد مجموعة قواعد الهامش ونسب الضريبة في مجموعة الضريبة الأسعار والضريبة (وتعمل الجداول بجانبها للمقارنة). الجداول: تتولى جداول قواعد التسعير ونسب الضريبة ذلك.',
              en: 'Settings: the Markup rules group and the tax rates of the Tax group set prices and tax (the tables run alongside for comparison). Tables: the pricing rules and tax rates tables do.',
            },
            type: 'enum',
            value: 'settings',
            default: 'settings',
            options: [
              {
                value: 'settings',
                label: {
                  ar: 'مجموعات الإعدادات',
                  en: 'Settings groups',
                },
              },
              {
                value: 'table',
                label: {
                  ar: 'جداول التسعير',
                  en: 'Pricing tables',
                },
              },
            ],
            control: 'money',
            risk: 'high',
            storedIn: 'pricing',
            note: {
              ar: 'من مجموعة «مصدر قواعد التسعير» المخفية في اللوحة اليوم. بعد التحويل إلى الجدول ترفض هذه المجموعة الحفظ (409).',
              en: 'From the "Pricing rules source" group, hidden in the dashboard today. Once switched to the table, this group refuses saves (409).',
            },
          },
        ],
      },
      {
        id: 'default',
        title: {
          ar: 'الهامش الافتراضي',
          en: 'Default markup',
        },
        description: {
          ar: 'يُطبَّق عندما لا تطابق أي قاعدة.',
          en: 'Applied when no rule matches.',
        },
        fields: [
          {
            key: 'defaultRule.mode',
            label: {
              ar: 'الطريقة',
              en: 'Mode',
            },
            help: {
              ar: 'نسبة مئوية: نسبة من إجمالي المورّد. مبلغ ثابت: المبلغ الثابت فقط. كلاهما: النسبة مضافًا إليها المبلغ الثابت.',
              en: 'Percentage: a percent of the supplier total. Fixed: the fixed amount only. Both: the percent plus the fixed amount.',
            },
            type: 'enum',
            value: 'both',
            default: 'percentage',
            options: [
              {
                value: 'percentage',
                label: {
                  ar: 'نسبة مئوية',
                  en: 'Percentage',
                },
              },
              {
                value: 'fixed',
                label: {
                  ar: 'مبلغ ثابت',
                  en: 'Fixed amount',
                },
              },
              {
                value: 'both',
                label: {
                  ar: 'نسبة ومبلغ ثابت',
                  en: 'Percent and fixed amount',
                },
              },
            ],
          },
          {
            key: 'defaultRule.percent',
            label: {
              ar: 'النسبة المئوية',
              en: 'Percent',
            },
            help: {
              ar: 'نسبة مئوية من إجمالي المورّد (تُتجاهل في طريقة المبلغ الثابت).',
              en: 'Percent of the supplier total (ignored in fixed mode).',
            },
            type: 'number',
            value: 6,
            default: 5,
            min: 0,
            max: 100,
            unit: 'percent',
            step: 0.5,
          },
          {
            key: 'defaultRule.fixedUsd',
            label: {
              ar: 'المبلغ الثابت (USD)',
              en: 'Fixed amount (USD)',
            },
            help: {
              ar: 'مبلغ ثابت بالدولار الأمريكي (يُتجاهل في طريقة النسبة المئوية).',
              en: 'Fixed amount in USD (ignored in percentage mode).',
            },
            type: 'money',
            value: 2,
            default: 0,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
          },
          {
            key: 'defaultRule.minUsd',
            label: {
              ar: 'أدنى هامش (USD)',
              en: 'Smallest markup (USD)',
            },
            help: {
              ar: 'لا يقل الهامش عن هذا المبلغ. أوقفه لإلغاء الحد الأدنى.',
              en: 'The markup is never below this amount. Switch it off for no floor.',
            },
            type: 'money',
            value: 3,
            default: 0,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
          },
          {
            key: 'defaultRule.maxUsd',
            label: {
              ar: 'أعلى هامش (USD)',
              en: 'Largest markup (USD)',
            },
            help: {
              ar: 'لا يزيد الهامش عن هذا المبلغ. أوقفه لإلغاء الحد الأعلى.',
              en: 'The markup is never above this amount. Switch it off for no ceiling.',
            },
            type: 'money',
            value: 120,
            default: null,
            nullable: true,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
          },
          {
            key: 'defaultRule.roundTo',
            label: {
              ar: 'التقريب إلى (USD)',
              en: 'Round to (USD)',
            },
            help: {
              ar: 'خطوة تقريب الهامش: 0.01 للتقريب إلى السنت، و1 إلى الدولار الكامل.',
              en: 'Rounding step of the markup: 0.01 rounds to cents, 1 to whole dollars.',
            },
            type: 'number',
            value: 0.5,
            default: 0.01,
            min: 0.01,
            max: 1000,
            unit: 'USD',
            step: 0.01,
          },
        ],
      },
      {
        id: 'rules',
        title: {
          ar: 'القواعد',
          en: 'Rules',
        },
        description: {
          ar: 'أول قاعدة مفعّلة تطابق كل شروطها (حسب الأولوية) هي التي تُطبَّق.',
          en: 'The first enabled rule (by priority) whose conditions all match wins.',
        },
        fields: [
          {
            key: 'rules',
            label: {
              ar: 'القواعد',
              en: 'Rules',
            },
            help: {
              ar: 'تُطبَّق أول قاعدة مفعّلة (حسب الأولوية تصاعديًا) تتحقق كل شروطها.',
              en: 'The first enabled rule (by ascending priority) whose conditions all match wins.',
            },
            type: 'string-list',
            value: [
              '10 · داخلي تركيا TRY ← 3٪',
              '20 · درجة الأعمال ← 4٪ + 10$ (حد أقصى 250$)',
              '30 · خدمات بعد الحجز ← 8$ ثابتة',
              '40 · عرض نوفمبر (حتى 30-11) ← 4٪',
            ],
            default: [],
            structured: true,
          },
        ],
      },
    ],
  },
  {
    key: 'fx',
    section: 'pricing',
    icon: 'Coins',
    title: {
      ar: 'أسعار الصرف',
      en: 'Exchange rates',
    },
    summary: {
      ar: 'مصدر أسعار الصرف والتقريب',
      en: 'Exchange-rate source and rounding',
    },
    description: {
      ar: 'مزوّد أسعار الصرف، وتواتر التحديث، وهامش الأمان الافتراضي، والتقريب.',
      en: 'Exchange-rate provider, refresh cadence, default safety margin and rounding.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 5,
    schemaVersion: 2,
    updatedAt: '2026-10-28T10:30:00.000Z',
    updatedBy: 'Lina Mansour',
    subsections: [
      {
        id: 'source',
        title: {
          ar: 'المصدر والتحديث',
          en: 'Source & refresh',
        },
        description: {
          ar: 'مزوّد الأسعار وكل كم يُحدَّث ومتى تُعدّ الأسعار قديمة.',
          en: 'Rate provider, refresh cadence and when rates count as stale.',
        },
        fields: [
          {
            key: 'baseCurrency',
            label: {
              ar: 'العملة الأساسية',
              en: 'Base currency',
            },
            help: {
              ar: 'تُحوَّل كل أسعار المورّدين إلى الدولار الأمريكي.',
              en: 'All supplier prices are converted to USD.',
            },
            type: 'string',
            value: 'USD',
            default: 'USD',
            readOnly: true,
            format: 'currency',
          },
          {
            key: 'provider',
            label: {
              ar: 'مزوّد الأسعار',
              en: 'Rate provider',
            },
            help: {
              ar: 'المزوّد الذي تقرأ منه مهمة التحديث أسعار الصرف.',
              en: 'Provider the refresh job reads the rates from.',
            },
            type: 'enum',
            value: 'frankfurter',
            default: 'frankfurter',
            options: [
              {
                value: 'frankfurter',
                label: {
                  ar: 'Frankfurter',
                  en: 'Frankfurter',
                },
              },
              {
                value: 'openexchangerates',
                label: {
                  ar: 'Open Exchange Rates',
                  en: 'Open Exchange Rates',
                },
              },
              {
                value: 'fake',
                label: {
                  ar: 'مزوّد تجريبي',
                  en: 'Test provider',
                },
              },
            ],
            note: {
              ar: 'متغير الخادم FX_PROVIDER يتقدم على هذا الحقل.',
              en: 'The server variable FX_PROVIDER wins over this field.',
            },
          },
          {
            key: 'refreshIntervalMinutes',
            label: {
              ar: 'التحديث كل (دقائق)',
              en: 'Refresh every (minutes)',
            },
            help: {
              ar: 'عدد الدقائق بين تحديثين لأسعار الصرف.',
              en: 'Minutes between two rate refreshes.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 0,
            max: 525600,
          },
          {
            key: 'staleAfterMinutes',
            label: {
              ar: 'تقادم الأسعار بعد (دقائق)',
              en: 'Stale after (minutes)',
            },
            help: {
              ar: 'الأسعار الأقدم من هذه المدة تُعد قديمة: يفشل التسعير ويُرفع تنبيه للعمليات.',
              en: 'Rates older than this are stale: pricing fails and an operations alert is raised.',
            },
            type: 'duration',
            value: 120,
            default: 1440,
            unit: 'minutes',
            min: 0,
            max: 525600,
            risk: 'high',
          },
        ],
      },
      {
        id: 'margin',
        title: {
          ar: 'الهامش والتقريب',
          en: 'Margin & rounding',
        },
        description: {
          ar: 'هامش الأمان الافتراضي (يمكن تجاوزه لكل عملة) وطريقة التقريب.',
          en: 'Default safety margin (overridable per currency) and rounding.',
        },
        fields: [
          {
            key: 'safetyMarginPercent',
            label: {
              ar: 'هامش الأمان (%)',
              en: 'Safety margin (%)',
            },
            help: {
              ar: 'النسبة الافتراضية المضافة إلى سعر التحويل من الدولار إلى عملة العرض لامتصاص تقلّب الأسعار (يدفع العميل أكثر قليلًا). يمكن تغييرها لكل عملة.',
              en: 'Default percent added to the USD to display currency rate to absorb rate movements (the customer pays slightly more). Each currency can override it.',
            },
            type: 'number',
            value: 1.5,
            default: 1.5,
            min: 0,
            max: 100,
            unit: 'percent',
            step: 0.1,
          },
          {
            key: 'rounding.mode',
            label: {
              ar: 'طريقة التقريب',
              en: 'Rounding mode',
            },
            help: {
              ar: 'التقريب المطبَّق بعد التحويل إلى عملة العرض.',
              en: 'Rounding applied after converting to the display currency.',
            },
            type: 'enum',
            value: 'ceil',
            default: 'ceil',
            options: [
              {
                value: 'ceil',
                label: {
                  ar: 'تقريب للأعلى',
                  en: 'Round up',
                },
              },
              {
                value: 'half_up',
                label: {
                  ar: 'تقريب لأقرب قيمة',
                  en: 'Round to nearest',
                },
              },
              {
                value: 'floor',
                label: {
                  ar: 'تقريب للأسفل',
                  en: 'Round down',
                },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'tax',
    section: 'pricing',
    icon: 'Landmark',
    title: {
      ar: 'الضريبة',
      en: 'Tax',
    },
    summary: {
      ar: 'محرك الضريبة وترقيم المستندات',
      en: 'Tax engine and document numbering',
    },
    description: {
      ar: 'محرك الضريبة وترقيم الإيصالات والفواتير الضريبية والإشعارات الدائنة. لم تعد نسب الضريبة هنا: تُدار فقط من صفحة نسب الضريبة. يحسب المحرك ما يُضبط بالضبط: يجب أن تأتي الإعدادات من محاسب الشركة، وهي ليست استشارة ضريبية.',
      en: "Tax engine and document numbering of receipts, tax invoices and credit notes. The tax rates are no longer here: they are managed only on the tax rates page. The engine computes exactly what is configured: the configuration must come from the company's accountant and is not tax advice.",
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 4,
    schemaVersion: 2,
    updatedAt: '2026-11-03T13:30:00.000Z',
    updatedBy: 'Ayşe Demir',
    attention: {
      ar: 'الوضع «بدون ضريبة» (إيصالات فقط) والرقم الضريبي فارغ: لا يمكن تشغيل وضع ضريبة القيمة المضافة ولا إرسال المستندات الإلكترونية التركية قبل تعبئته.',
      en: 'Mode is "No tax" (receipts only) and the tax number is empty: VAT mode and the Turkish e-documents cannot work until it is filled.',
    },
    subsections: [
      {
        id: 'seller',
        title: {
          ar: 'البائع (الكيان القانوني)',
          en: 'Seller (legal entity)',
        },
        description: {
          ar: 'يُطبع على كل مستند.',
          en: 'Printed on every document.',
        },
        fields: [
          {
            key: 'legalEntity.name',
            label: {
              ar: 'الاسم القانوني',
              en: 'Legal name',
            },
            help: {
              ar: 'الاسم القانوني المسجّل للشركة البائعة، ويُطبع على كل مستند.',
              en: 'Registered legal name of the selling company, printed on every document.',
            },
            type: 'string',
            value: 'Goteav Turizm Ltd. Şti.',
            default: 'Goteav',
            min: 1,
            max: 200,
          },
          {
            key: 'legalEntity.country',
            label: {
              ar: 'دولة التسجيل',
              en: 'Country of registration',
            },
            help: {
              ar: 'رمز الدولة من حرفين (ISO 3166-1). أوقفه ما دامت الولاية القضائية غير محددة. مطلوب في وضع ضريبة القيمة المضافة.',
              en: 'Two-letter country code (ISO 3166-1). Switch it off while the jurisdiction is undecided. Required in VAT mode.',
            },
            type: 'string',
            value: 'TR',
            default: null,
            nullable: true,
            format: 'country',
          },
          {
            key: 'legalEntity.taxId',
            label: {
              ar: 'الرقم الضريبي',
              en: 'Tax registration number',
            },
            help: {
              ar: 'رقم التسجيل الضريبي (VAT أو TRN أو VKN) المطبوع على الفواتير الضريبية. مطلوب في وضع ضريبة القيمة المضافة.',
              en: 'VAT, TRN or VKN number printed on tax invoices. Required in VAT mode.',
            },
            type: 'string',
            value: null,
            default: null,
            nullable: true,
            max: 64,
          },
          {
            key: 'legalEntity.address',
            label: {
              ar: 'العنوان المسجّل',
              en: 'Registered address',
            },
            help: {
              ar: 'يُطبع كما هو مكتوب (مع الحفاظ على فواصل الأسطر).',
              en: 'Printed as written (line breaks are kept).',
            },
            type: 'string',
            value: 'Maslak Mah. Büyükdere Cad. No:255\nSarıyer / İstanbul',
            default: '',
            max: 500,
            multiline: true,
          },
          {
            key: 'legalEntity.email',
            label: {
              ar: 'بريد الفوترة',
              en: 'Billing email',
            },
            help: {
              ar: 'بريد التواصل للفوترة المطبوع على المستندات. اتركه فارغًا لحذفه.',
              en: 'Billing contact email printed on documents. Empty to leave it out.',
            },
            type: 'string',
            value: 'billing@goteav.com',
            default: '',
            format: 'email',
          },
        ],
      },
      {
        id: 'mode',
        title: {
          ar: 'وضع الضريبة',
          en: 'Tax mode',
        },
        description: {
          ar: 'يُغيَّر بتعليمات المحاسب فقط.',
          en: 'Changed on the accountant’s instruction only.',
        },
        fields: [
          {
            key: 'mode',
            label: {
              ar: 'وضع الضريبة',
              en: 'Tax mode',
            },
            help: {
              ar: 'بلا ضريبة: تصدر إيصالات دون ضريبة. ضريبة القيمة المضافة: تصدر فواتير ضريبية وإشعارات دائنة بالصافي والضريبة والإجمالي لكل بند. لا تغيّره إلا بتوجيه من المحاسب.',
              en: "None issues receipts without tax. VAT issues tax invoices and credit notes with net, tax and gross per line. Change it only on the accountant's instruction.",
            },
            type: 'enum',
            value: 'NONE',
            default: 'NONE',
            options: [
              {
                value: 'NONE',
                label: {
                  ar: 'بلا ضريبة (إيصالات)',
                  en: 'None (receipts)',
                },
              },
              {
                value: 'VAT',
                label: {
                  ar: 'ضريبة القيمة المضافة (فواتير ضريبية)',
                  en: 'VAT (tax invoices)',
                },
              },
            ],
            risk: 'high',
          },
          {
            key: 'pricesIncludeTax',
            label: {
              ar: 'الأسعار شاملة الضريبة',
              en: 'Prices include tax',
            },
            help: {
              ar: 'أسعار العملاء تشمل الضريبة، وتُستخرج منها: الصافي = الإجمالي ÷ (1 + النسبة). أبقه مفعّلًا: لا يضيف الدفع ضريبة فوق السعر.',
              en: 'Customer prices already include the tax, which is extracted: net = gross / (1 + rate). Keep it on: checkout never adds tax on top.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'showServiceFeeLine',
            label: {
              ar: 'رسوم الخدمة في بند مستقل',
              en: 'Service fee on its own line',
            },
            help: {
              ar: 'طباعة رسوم خدمتنا في بند مستقل. عند الإيقاف: تُضمَّن في بند أجرة الطيران.',
              en: 'Print our service fee as its own line. Off: it is included in the airfare line.',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
        ],
      },
      {
        id: 'numbering',
        title: {
          ar: 'ترقيم المستندات',
          en: 'Document numbering',
        },
        description: {
          ar: 'تغيير البادئة يبدأ سلسلة جديدة من 1.',
          en: 'Changing a prefix starts a new series at 1.',
        },
        fields: [
          {
            key: 'numbering.receiptPrefix',
            label: {
              ar: 'بادئة الإيصالات',
              en: 'Receipt prefix',
            },
            help: {
              ar: 'بادئة أرقام الإيصالات (وضع بلا ضريبة)، مثل PREFIX-YYYY-000001. تغييرها يبدأ سلسلة جديدة من 1.',
              en: 'Prefix of receipt numbers (tax mode None), as in PREFIX-YYYY-000001. Changing it starts a new series at 1.',
            },
            type: 'string',
            value: 'RCPT',
            default: 'RCPT',
            risk: 'high',
            max: 10,
          },
          {
            key: 'numbering.invoicePrefix',
            label: {
              ar: 'بادئة الفواتير الضريبية',
              en: 'Tax invoice prefix',
            },
            help: {
              ar: 'بادئة أرقام الفواتير الضريبية (وضع ضريبة القيمة المضافة)، مثل PREFIX-YYYY-000001. تغييرها يبدأ سلسلة جديدة من 1.',
              en: 'Prefix of tax invoice numbers (tax mode VAT), as in PREFIX-YYYY-000001. Changing it starts a new series at 1.',
            },
            type: 'string',
            value: 'INV',
            default: 'INV',
            risk: 'high',
            max: 10,
          },
          {
            key: 'numbering.creditNotePrefix',
            label: {
              ar: 'بادئة الإشعارات الدائنة',
              en: 'Credit note prefix',
            },
            help: {
              ar: 'بادئة أرقام الإشعارات الدائنة (استرداد فاتورة ضريبية). تغييرها يبدأ سلسلة جديدة من 1.',
              en: 'Prefix of credit note numbers (refunds of a tax invoice). Changing it starts a new series at 1.',
            },
            type: 'string',
            value: 'CN',
            default: 'CN',
            risk: 'high',
            max: 10,
          },
          {
            key: 'numbering.refundReceiptPrefix',
            label: {
              ar: 'بادئة إيصالات الاسترداد',
              en: 'Refund receipt prefix',
            },
            help: {
              ar: 'بادئة أرقام إيصالات الاسترداد (استرداد إيصال). تغييرها يبدأ سلسلة جديدة من 1.',
              en: 'Prefix of refund receipt numbers (refunds of a receipt). Changing it starts a new series at 1.',
            },
            type: 'string',
            value: 'RFND',
            default: 'RFND',
            risk: 'high',
            max: 10,
          },
          {
            key: 'numbering.yearlyReset',
            label: {
              ar: 'البدء من جديد كل سنة',
              en: 'Restart each year',
            },
            help: {
              ar: 'إعادة كل سلسلة إلى 1 في بداية كل سنة ميلادية (UTC) وطباعة السنة في الرقم. عند الإيقاف: سلسلة واحدة مستمرة، PREFIX-000001.',
              en: 'Restart every series at 1 each calendar year (UTC) and print the year in the number. Off: one running series, PREFIX-000001.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
        ],
      },
    ],
  },
  {
    key: 'e_invoicing',
    section: 'pricing',
    icon: 'FileCheck2',
    title: {
      ar: 'الفوترة الإلكترونية',
      en: 'E-invoicing',
    },
    summary: {
      ar: 'المستندات الإلكترونية التركية (e-Fatura / e-Arşiv): التشغيل والإلغاء وإعادة المحاولة',
      en: 'Turkish e-documents (e-Fatura / e-Arşiv): switch, cancellation and retries',
    },
    description: {
      ar: 'المستندات الإلكترونية التركية (e-Fatura / e-Arşiv) التي تُرسل إلى مزوّد الفوترة الإلكترونية لكل إيصال وفاتورة وإشعار دائن يصدر: التشغيل، ومكتب ضرائب البائع، ومتى يُلغى المستند الإلكتروني بدل تصحيحه، وإعادة المحاولة. هذه قواعد قانونية: لا تضبطها إلا كما يقول المحاسب. تعطّل المزوّد لا يوقف أي بيع؛ ينتظر المستند الإلكتروني وتُعاد محاولته.',
      en: "Turkish e-documents (e-Fatura / e-Arşiv) sent to the e-invoicing provider for every issued receipt, invoice and credit note: the switch, the seller's tax office, when an e-document is cancelled rather than corrected, and the retries. These are legal rules: set them only as the accountant says. A provider failure never blocks a sale; the e-document waits and is retried.",
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 2,
    schemaVersion: 1,
    updatedAt: '2026-11-03T13:35:00.000Z',
    updatedBy: 'Ayşe Demir',
    masterSwitch: 'enabled',
    enabled: true,
    attention: {
      ar: 'مُفعّل لكن مكتب الضرائب فارغ والمزوّد على الخادم «غير مُعدّ» (E_INVOICING_PROVIDER=none): لا يُرسل أي مستند إلكتروني حتى يُختار المُدمج الخاص.',
      en: 'On, but the tax office is empty and the server provider is "not configured" (E_INVOICING_PROVIDER=none): no e-document is sent until the Özel Entegratör is chosen.',
    },
    subsections: [
      {
        id: 'switch',
        title: {
          ar: 'التشغيل والبائع',
          en: 'Switch & seller',
        },
        description: {
          ar: 'الرقم الضريبي (VKN) يأتي من مجموعة «الضريبة».',
          en: 'The tax number (VKN) comes from the Tax group.',
        },
        fields: [
          {
            key: 'enabled',
            label: {
              ar: 'إرسال المستندات الإلكترونية',
              en: 'Send e-documents',
            },
            help: {
              ar: 'مفعّل: يُسجَّل مستند إلكتروني (e-Fatura أو e-Arşiv) ويُرسل إلى المزوّد لكل إيصال وفاتورة وإشعار دائن يصدر. معطّل: تبقى المستندات تصدر، لكن لا يُسجَّل ولا يُرسل أي مستند إلكتروني. الافتراضي مفعّل.',
              en: 'On: an e-document (e-Fatura or e-Arşiv) is recorded and sent to the provider for every issued receipt, invoice and credit note. Off: documents are still issued, but no e-document is recorded or sent. Default on.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'provider',
            label: {
              ar: 'المزوّد المربوط على الخادم',
              en: 'Provider bound on the server',
            },
            help: {
              ar: 'قيمة E_INVOICING_PROVIDER للقراءة فقط: «غير مُعدّ» في الإنتاج حتى يُختار المُدمج الخاص مع المحاسب، فلا يُرسل شيء رغم التشغيل.',
              en: 'Read-only E_INVOICING_PROVIDER: "not configured" in production until the Özel Entegratör is chosen with the accountant, so nothing is sent even when switched on.',
            },
            type: 'enum',
            value: 'none',
            default: 'none',
            options: [
              {
                value: 'none',
                label: {
                  ar: 'غير مضبوطة',
                  en: 'Not configured',
                },
              },
              {
                value: 'fake',
                label: {
                  ar: 'مزوّد تجريبي',
                  en: 'Test provider',
                },
              },
              {
                value: 'ozel_entegrator',
                label: {
                  ar: 'مُدمج خاص (Özel Entegratör)',
                  en: 'Özel Entegratör',
                },
              },
            ],
            readOnly: true,
            proposed: true,
            proposalId: 'S-20',
            priority: 'P1',
            needsBackend: true,
          },
          {
            key: 'sellerTaxOffice',
            label: {
              ar: 'مكتب ضرائب البائع',
              en: 'Seller tax office',
            },
            help: {
              ar: 'مكتب الضرائب (vergi dairesi) التابع لشركتنا، يُطبع على كل مستند إلكتروني بجانب الرقم الضريبي للكيان القانوني في إعدادات الضريبة. حتى 100 حرف؛ يبقى فارغًا حتى يعطيه المحاسب.',
              en: 'Tax office (vergi dairesi) of our company, printed on every e-document next to the tax number of the legal entity in the tax settings. Up to 100 characters; empty until the accountant gives it.',
            },
            type: 'string',
            value: '',
            default: '',
            max: 100,
          },
          {
            key: 'eFaturaProfile',
            label: {
              ar: 'نموذج e-Fatura',
              en: 'e-Fatura profile',
            },
            help: {
              ar: 'سيناريو الفاتورة الإلكترونية e-Fatura المرسلة إلى شركة مسجّلة في الفوترة الإلكترونية. الفاتورة الأساسية (TEMELFATURA): لا يستطيع المشتري رفضها. الفاتورة التجارية (TICARIFATURA): يستطيع المشتري قبولها أو رفضها خلال 8 أيام. اسأل المحاسب. الافتراضي الفاتورة الأساسية.',
              en: 'The scenario of an e-Fatura sent to a company registered for e-invoices. Basic invoice (TEMELFATURA): the buyer cannot reject it. Commercial invoice (TICARIFATURA): the buyer may accept or reject it within 8 days. Ask the accountant. Default basic invoice.',
            },
            type: 'enum',
            value: 'TEMELFATURA',
            default: 'TEMELFATURA',
            options: [
              {
                value: 'TEMELFATURA',
                label: {
                  ar: 'فاتورة أساسية (TEMELFATURA)',
                  en: 'Basic invoice (TEMELFATURA)',
                },
              },
              {
                value: 'TICARIFATURA',
                label: {
                  ar: 'فاتورة تجارية (TICARIFATURA)',
                  en: 'Commercial invoice (TICARIFATURA)',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'cancellation',
        title: {
          ar: 'نوافذ الإلغاء',
          en: 'Cancellation windows',
        },
        description: {
          ar: 'متى يُلغى المستند بدل إرسال مستند إرجاع.',
          en: 'When a document is cancelled instead of sending a return document.',
        },
        fields: [
          {
            key: 'cancellation.onFullRefund',
            label: {
              ar: 'الإلغاء عند الاسترداد الكامل',
              en: 'Cancel on a full refund',
            },
            help: {
              ar: 'مفعّل: عندما يسترد الاسترداد بيعًا كاملًا داخل المهلة (إلغاء شركة الطيران للتذكرة، أو إلغاء في الأسبوع نفسه) يُلغى المستند الإلكتروني الأصلي بدل إرسال مستند إرجاع. معطّل: كل استرداد يرسل مستند إرجاع. الافتراضي مفعّل.',
              en: 'On: when a refund takes back a whole sale inside the window (an airline void, a cancellation the same week), the original e-document is cancelled instead of sending a return document. Off: every refund sends a return document. Default on.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'cancellation.eArsivWindowDays',
            label: {
              ar: 'مهلة إلغاء e-Arşiv (أيام)',
              en: 'e-Arşiv cancellation window (days)',
            },
            help: {
              ar: 'عدد الأيام بعد الإصدار التي يبقى فيها إلغاء e-Arşiv ممكنًا. 0 يعني عدم الإلغاء أبدًا: كل استرداد يرسل مستند إرجاع. من 0 إلى 31. الافتراضي 7 (يؤكده المحاسب).',
              en: 'Days after issue an e-Arşiv may still be cancelled. 0 never cancels: every refund sends a return document. Between 0 and 31. Default 7 (the accountant confirms it).',
            },
            type: 'duration',
            value: 7,
            default: 7,
            unit: 'days',
            min: 0,
            max: 31,
          },
          {
            key: 'cancellation.eFaturaCancellable',
            label: {
              ar: 'السماح بإلغاء e-Fatura',
              en: 'Allow cancelling an e-Fatura',
            },
            help: {
              ar: 'مفعّل: يمكن إلغاء e-Fatura عبر المزوّد داخل مهلتها. معطّل: تُصحَّح e-Fatura دائمًا بمستند إرجاع. الافتراضي معطّل.',
              en: 'On: an e-Fatura may be cancelled through the provider inside its window. Off: an e-Fatura is always corrected by a return document. Default off.',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'cancellation.eFaturaWindowDays',
            label: {
              ar: 'مهلة إلغاء e-Fatura (أيام)',
              en: 'e-Fatura cancellation window (days)',
            },
            help: {
              ar: 'عدد الأيام بعد الإصدار التي يبقى فيها إلغاء e-Fatura ممكنًا، إذا كان الإلغاء مسموحًا. من 0 إلى 31. الافتراضي 8 (مهلة الاعتراض التجارية).',
              en: 'Days after issue an e-Fatura may still be cancelled, when cancelling is allowed. Between 0 and 31. Default 8 (the commercial objection period).',
            },
            type: 'duration',
            value: 8,
            default: 8,
            unit: 'days',
            min: 0,
            max: 31,
          },
        ],
      },
      {
        id: 'delivery',
        title: {
          ar: 'الإرسال وإعادة المحاولة',
          en: 'Delivery & retries',
        },
        description: {
          ar: 'لا يمكن لمستند متعثر أن يوقف بيعًا.',
          en: 'A stuck e-document never blocks a sale.',
        },
        fields: [
          {
            key: 'retry.maxAttempts',
            label: {
              ar: 'المحاولات قبل الفشل',
              en: 'Attempts before failing',
            },
            help: {
              ar: 'عدد محاولات إرسال المستند الإلكتروني قبل وسمه بالفشل وإرسال تنبيه حرج للعمليات (ثم يمكن للموظفين إعادة إرساله من الفاتورة). من 1 إلى 20. الافتراضي 8.',
              en: 'Attempts to send one e-document before it is marked failed and a critical alert goes to operations (staff can then send it again from the invoice). Between 1 and 20. Default 8.',
            },
            type: 'integer',
            value: 8,
            default: 8,
            min: 1,
            max: 20,
          },
          {
            key: 'retry.baseDelaySeconds',
            label: {
              ar: 'مهلة أول إعادة (ثوانٍ)',
              en: 'First retry delay (seconds)',
            },
            help: {
              ar: 'الانتظار قبل أول إعادة محاولة؛ وكل انتظار بعده ضعف ما قبله. من 1 إلى 3,600. الافتراضي 30.',
              en: 'Wait before the first retry; each next wait doubles it. Between 1 and 3,600. Default 30.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'seconds',
            min: 1,
            max: 3600,
          },
          {
            key: 'statusPollMinutes',
            label: {
              ar: 'فحص الحالة كل (دقائق)',
              en: 'Status check every (minutes)',
            },
            help: {
              ar: 'كم مرة يُعاد فحص مستند إلكتروني مُرسل ما زال ينتظر مصلحة الضرائب (GİB) أو المشتري. من 1 إلى 1,440. الافتراضي 15.',
              en: 'How often a sent e-document still waiting for the tax authority (GİB) or the buyer is checked again. Between 1 and 1,440. Default 15.',
            },
            type: 'duration',
            value: 15,
            default: 15,
            unit: 'minutes',
            min: 1,
            max: 1440,
          },
        ],
      },
    ],
  },
];

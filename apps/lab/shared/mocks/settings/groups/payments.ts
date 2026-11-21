// Settings groups of the "payments" section.
// Generated from the backend groups (src/modules/settings/groups) and the dashboard dictionaries; see audit.md
// in dashboard/settings. Fields with `proposed: true` are NOT in the real API (audit proposals, P0/P1).

import type { SettingsGroup } from '../types';

export const PAYMENT_GROUPS: SettingsGroup[] = [
  {
    key: 'payment_methods',
    section: 'payments',
    icon: 'CreditCard',
    title: {
      ar: 'طرق الدفع',
      en: 'Payment methods',
    },
    summary: {
      ar: 'بوابات الدفع وطرقه',
      en: 'Gateways and payment methods',
    },
    description: {
      ar: 'بوابات الدفع وطرقها والقواعد التي تحدد ما يظهر لكل عميل. التوجيه الافتراضي: PayTR أولًا لكل الدول بالليرة التركية والدولار واليورو والجنيه الإسترليني؛ ثم iyzico للعملاء في تركيا الذين يدفعون بالليرة فقط. البوابتان التركيتان معطّلتان في البداية.',
      en: 'Payment gateways, their methods and the rules deciding what each customer sees. Default routing: PayTR first for every country in TRY, USD, EUR and GBP; iyzico second, for customers in Türkiye paying in TRY only. Both Turkish gateways ship switched off.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 12,
    schemaVersion: 2,
    updatedAt: '2026-11-16T15:30:00.000Z',
    updatedBy: 'Sara Haddad',
    subsections: [
      {
        id: 'gateways',
        title: {
          ar: 'البوابات',
          en: 'Gateways',
        },
        description: {
          ar: 'تشغيل كل بوابة وطرقها وعملاتها. المفاتيح في صفحة «بوابات الدفع».',
          en: 'Each gateway on/off, its methods and currencies. The keys live on the Payment gateways page.',
        },
        fields: [
          {
            key: 'gateways.0.enabled',
            label: {
              ar: 'مفعّلة — Stripe',
              en: 'Enabled — Stripe',
            },
            help: {
              ar: 'البوابة المعطّلة لا تُعرض أبدًا.',
              en: 'A disabled gateway is never offered.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'gateways.0.methods',
            label: {
              ar: 'الطرق — Stripe',
              en: 'Methods — Stripe',
            },
            help: {
              ar: 'طرق الدفع المعروضة عبر هذه البوابة (card وknet وmada وapple_pay وغيرها).',
              en: 'Methods offered through this gateway (card, knet, mada, apple_pay and others).',
            },
            type: 'multi-enum',
            value: ['card', 'apple_pay', 'google_pay'],
            default: ['card', 'apple_pay', 'google_pay'],
            options: [
              {
                value: 'card',
                label: {
                  ar: 'بطاقة',
                  en: 'Card',
                },
              },
              {
                value: 'apple_pay',
                label: {
                  ar: 'Apple Pay',
                  en: 'Apple Pay',
                },
              },
              {
                value: 'google_pay',
                label: {
                  ar: 'Google Pay',
                  en: 'Google Pay',
                },
              },
            ],
          },
          {
            key: 'gateways.0.currencies',
            label: {
              ar: 'العملات — Stripe',
              en: 'Currencies — Stripe',
            },
            help: {
              ar: 'عملات التسوية التي يقبلها الحساب (ضمن ما تدعمه البوابة). PayTR: الليرة والدولار واليورو والجنيه (الأجنبية بعد تفعيلها في المتجر)؛ iyzico: الليرة.',
              en: 'Settlement currencies the account accepts (limited to what the gateway supports). PayTR: TRY, USD, EUR, GBP (the foreign ones activated on the store); iyzico: TRY.',
            },
            type: 'string-list',
            value: ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY'],
            default: ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'TRY'],
            format: 'currency',
          },
          {
            key: 'gateways.1.enabled',
            label: {
              ar: 'مفعّلة — MyFatoorah',
              en: 'Enabled — MyFatoorah',
            },
            help: {
              ar: 'البوابة المعطّلة لا تُعرض أبدًا.',
              en: 'A disabled gateway is never offered.',
            },
            type: 'boolean',
            value: true,
            default: false,
            risk: 'high',
          },
          {
            key: 'gateways.1.methods',
            label: {
              ar: 'الطرق — MyFatoorah',
              en: 'Methods — MyFatoorah',
            },
            help: {
              ar: 'طرق الدفع المعروضة عبر هذه البوابة (card وknet وmada وapple_pay وغيرها).',
              en: 'Methods offered through this gateway (card, knet, mada, apple_pay and others).',
            },
            type: 'multi-enum',
            value: ['knet', 'mada', 'benefit', 'omannet', 'card'],
            default: ['knet', 'mada', 'benefit', 'omannet', 'card'],
            options: [
              {
                value: 'knet',
                label: {
                  ar: 'كي-نت',
                  en: 'KNET',
                },
              },
              {
                value: 'mada',
                label: {
                  ar: 'مدى',
                  en: 'mada',
                },
              },
              {
                value: 'benefit',
                label: {
                  ar: 'بنفت',
                  en: 'BENEFIT',
                },
              },
              {
                value: 'omannet',
                label: {
                  ar: 'عمان نت',
                  en: 'OmanNet',
                },
              },
              {
                value: 'card',
                label: {
                  ar: 'بطاقة',
                  en: 'Card',
                },
              },
            ],
          },
          {
            key: 'gateways.1.currencies',
            label: {
              ar: 'العملات — MyFatoorah',
              en: 'Currencies — MyFatoorah',
            },
            help: {
              ar: 'عملات التسوية التي يقبلها الحساب (ضمن ما تدعمه البوابة). PayTR: الليرة والدولار واليورو والجنيه (الأجنبية بعد تفعيلها في المتجر)؛ iyzico: الليرة.',
              en: 'Settlement currencies the account accepts (limited to what the gateway supports). PayTR: TRY, USD, EUR, GBP (the foreign ones activated on the store); iyzico: TRY.',
            },
            type: 'string-list',
            value: ['SAR'],
            default: ['KWD', 'SAR', 'AED', 'QAR', 'BHD', 'OMR', 'JOD', 'EGP'],
            format: 'currency',
          },
          {
            key: 'gateways.2.enabled',
            label: {
              ar: 'مفعّلة — Paymob',
              en: 'Enabled — Paymob',
            },
            help: {
              ar: 'البوابة المعطّلة لا تُعرض أبدًا.',
              en: 'A disabled gateway is never offered.',
            },
            type: 'boolean',
            value: false,
            default: false,
            risk: 'high',
          },
          {
            key: 'gateways.2.methods',
            label: {
              ar: 'الطرق — Paymob',
              en: 'Methods — Paymob',
            },
            help: {
              ar: 'طرق الدفع المعروضة عبر هذه البوابة (card وknet وmada وapple_pay وغيرها).',
              en: 'Methods offered through this gateway (card, knet, mada, apple_pay and others).',
            },
            type: 'multi-enum',
            value: ['card', 'wallet_mobile', 'fawry'],
            default: ['card', 'wallet_mobile', 'fawry'],
            options: [
              {
                value: 'card',
                label: {
                  ar: 'بطاقة',
                  en: 'Card',
                },
              },
              {
                value: 'wallet_mobile',
                label: {
                  ar: 'محفظة الجوال',
                  en: 'Mobile wallet',
                },
              },
              {
                value: 'fawry',
                label: {
                  ar: 'فوري',
                  en: 'Fawry',
                },
              },
            ],
          },
          {
            key: 'gateways.2.currencies',
            label: {
              ar: 'العملات — Paymob',
              en: 'Currencies — Paymob',
            },
            help: {
              ar: 'عملات التسوية التي يقبلها الحساب (ضمن ما تدعمه البوابة). PayTR: الليرة والدولار واليورو والجنيه (الأجنبية بعد تفعيلها في المتجر)؛ iyzico: الليرة.',
              en: 'Settlement currencies the account accepts (limited to what the gateway supports). PayTR: TRY, USD, EUR, GBP (the foreign ones activated on the store); iyzico: TRY.',
            },
            type: 'string-list',
            value: ['EGP', 'SAR', 'AED', 'OMR'],
            default: ['EGP', 'SAR', 'AED', 'OMR'],
            format: 'currency',
          },
          {
            key: 'gateways.3.enabled',
            label: {
              ar: 'مفعّلة — Moyasar',
              en: 'Enabled — Moyasar',
            },
            help: {
              ar: 'البوابة المعطّلة لا تُعرض أبدًا.',
              en: 'A disabled gateway is never offered.',
            },
            type: 'boolean',
            value: false,
            default: false,
            risk: 'high',
          },
          {
            key: 'gateways.3.methods',
            label: {
              ar: 'الطرق — Moyasar',
              en: 'Methods — Moyasar',
            },
            help: {
              ar: 'طرق الدفع المعروضة عبر هذه البوابة (card وknet وmada وapple_pay وغيرها).',
              en: 'Methods offered through this gateway (card, knet, mada, apple_pay and others).',
            },
            type: 'multi-enum',
            value: ['mada', 'card', 'apple_pay', 'stc_pay'],
            default: ['mada', 'card', 'apple_pay', 'stc_pay'],
            options: [
              {
                value: 'mada',
                label: {
                  ar: 'مدى',
                  en: 'mada',
                },
              },
              {
                value: 'card',
                label: {
                  ar: 'بطاقة',
                  en: 'Card',
                },
              },
              {
                value: 'apple_pay',
                label: {
                  ar: 'Apple Pay',
                  en: 'Apple Pay',
                },
              },
              {
                value: 'stc_pay',
                label: {
                  ar: 'STC Pay',
                  en: 'STC Pay',
                },
              },
            ],
          },
          {
            key: 'gateways.3.currencies',
            label: {
              ar: 'العملات — Moyasar',
              en: 'Currencies — Moyasar',
            },
            help: {
              ar: 'عملات التسوية التي يقبلها الحساب (ضمن ما تدعمه البوابة). PayTR: الليرة والدولار واليورو والجنيه (الأجنبية بعد تفعيلها في المتجر)؛ iyzico: الليرة.',
              en: 'Settlement currencies the account accepts (limited to what the gateway supports). PayTR: TRY, USD, EUR, GBP (the foreign ones activated on the store); iyzico: TRY.',
            },
            type: 'string-list',
            value: ['SAR', 'USD', 'EUR', 'GBP', 'AED', 'BHD', 'KWD', 'OMR', 'QAR'],
            default: ['SAR', 'USD', 'EUR', 'GBP', 'AED', 'BHD', 'KWD', 'OMR', 'QAR'],
            format: 'currency',
          },
          {
            key: 'gateways.4.enabled',
            label: {
              ar: 'مفعّلة — Tap',
              en: 'Enabled — Tap',
            },
            help: {
              ar: 'البوابة المعطّلة لا تُعرض أبدًا.',
              en: 'A disabled gateway is never offered.',
            },
            type: 'boolean',
            value: false,
            default: false,
            risk: 'high',
          },
          {
            key: 'gateways.4.methods',
            label: {
              ar: 'الطرق — Tap',
              en: 'Methods — Tap',
            },
            help: {
              ar: 'طرق الدفع المعروضة عبر هذه البوابة (card وknet وmada وapple_pay وغيرها).',
              en: 'Methods offered through this gateway (card, knet, mada, apple_pay and others).',
            },
            type: 'multi-enum',
            value: ['knet', 'mada', 'card', 'apple_pay', 'benefit'],
            default: ['knet', 'mada', 'card', 'apple_pay', 'benefit'],
            options: [
              {
                value: 'knet',
                label: {
                  ar: 'كي-نت',
                  en: 'KNET',
                },
              },
              {
                value: 'mada',
                label: {
                  ar: 'مدى',
                  en: 'mada',
                },
              },
              {
                value: 'card',
                label: {
                  ar: 'بطاقة',
                  en: 'Card',
                },
              },
              {
                value: 'apple_pay',
                label: {
                  ar: 'Apple Pay',
                  en: 'Apple Pay',
                },
              },
              {
                value: 'benefit',
                label: {
                  ar: 'بنفت',
                  en: 'BENEFIT',
                },
              },
            ],
          },
          {
            key: 'gateways.4.currencies',
            label: {
              ar: 'العملات — Tap',
              en: 'Currencies — Tap',
            },
            help: {
              ar: 'عملات التسوية التي يقبلها الحساب (ضمن ما تدعمه البوابة). PayTR: الليرة والدولار واليورو والجنيه (الأجنبية بعد تفعيلها في المتجر)؛ iyzico: الليرة.',
              en: 'Settlement currencies the account accepts (limited to what the gateway supports). PayTR: TRY, USD, EUR, GBP (the foreign ones activated on the store); iyzico: TRY.',
            },
            type: 'string-list',
            value: ['KWD', 'SAR', 'AED', 'BHD', 'QAR', 'OMR', 'EGP', 'USD', 'EUR', 'GBP'],
            default: ['KWD', 'SAR', 'AED', 'BHD', 'QAR', 'OMR', 'EGP', 'USD', 'EUR', 'GBP'],
            format: 'currency',
          },
          {
            key: 'gateways.5.enabled',
            label: {
              ar: 'مفعّلة — PayTR',
              en: 'Enabled — PayTR',
            },
            help: {
              ar: 'البوابة المعطّلة لا تُعرض أبدًا.',
              en: 'A disabled gateway is never offered.',
            },
            type: 'boolean',
            value: true,
            default: false,
            risk: 'high',
          },
          {
            key: 'gateways.5.methods',
            label: {
              ar: 'الطرق — PayTR',
              en: 'Methods — PayTR',
            },
            help: {
              ar: 'طرق الدفع المعروضة عبر هذه البوابة (card وknet وmada وapple_pay وغيرها).',
              en: 'Methods offered through this gateway (card, knet, mada, apple_pay and others).',
            },
            type: 'multi-enum',
            value: ['card'],
            default: ['card'],
            options: [
              {
                value: 'card',
                label: {
                  ar: 'بطاقة',
                  en: 'Card',
                },
              },
            ],
          },
          {
            key: 'gateways.5.currencies',
            label: {
              ar: 'العملات — PayTR',
              en: 'Currencies — PayTR',
            },
            help: {
              ar: 'عملات التسوية التي يقبلها الحساب (ضمن ما تدعمه البوابة). PayTR: الليرة والدولار واليورو والجنيه (الأجنبية بعد تفعيلها في المتجر)؛ iyzico: الليرة.',
              en: 'Settlement currencies the account accepts (limited to what the gateway supports). PayTR: TRY, USD, EUR, GBP (the foreign ones activated on the store); iyzico: TRY.',
            },
            type: 'string-list',
            value: ['TRY', 'USD', 'EUR', 'GBP'],
            default: ['TRY', 'USD', 'EUR', 'GBP'],
            format: 'currency',
          },
          {
            key: 'gateways.6.enabled',
            label: {
              ar: 'مفعّلة — iyzico',
              en: 'Enabled — iyzico',
            },
            help: {
              ar: 'البوابة المعطّلة لا تُعرض أبدًا.',
              en: 'A disabled gateway is never offered.',
            },
            type: 'boolean',
            value: false,
            default: false,
            risk: 'high',
          },
          {
            key: 'gateways.6.methods',
            label: {
              ar: 'الطرق — iyzico',
              en: 'Methods — iyzico',
            },
            help: {
              ar: 'طرق الدفع المعروضة عبر هذه البوابة (card وknet وmada وapple_pay وغيرها).',
              en: 'Methods offered through this gateway (card, knet, mada, apple_pay and others).',
            },
            type: 'multi-enum',
            value: ['card'],
            default: ['card'],
            options: [
              {
                value: 'card',
                label: {
                  ar: 'بطاقة',
                  en: 'Card',
                },
              },
            ],
          },
          {
            key: 'gateways.6.currencies',
            label: {
              ar: 'العملات — iyzico',
              en: 'Currencies — iyzico',
            },
            help: {
              ar: 'عملات التسوية التي يقبلها الحساب (ضمن ما تدعمه البوابة). PayTR: الليرة والدولار واليورو والجنيه (الأجنبية بعد تفعيلها في المتجر)؛ iyzico: الليرة.',
              en: 'Settlement currencies the account accepts (limited to what the gateway supports). PayTR: TRY, USD, EUR, GBP (the foreign ones activated on the store); iyzico: TRY.',
            },
            type: 'string-list',
            value: ['TRY'],
            default: ['TRY'],
            format: 'currency',
          },
        ],
      },
      {
        id: 'rules',
        title: {
          ar: 'قواعد الظهور',
          en: 'Visibility rules',
        },
        description: {
          ar: 'كل قاعدة مطابقة تُطبَّق بترتيب الأولوية: إظهار أو إخفاء أو ترتيب.',
          en: 'Every matching rule applies in priority order: show, hide or order.',
        },
        fields: [
          {
            key: 'rules',
            label: {
              ar: 'القواعد',
              en: 'Rules',
            },
            help: {
              ar: 'قواعد تُظهر الطرق أو تخفيها أو ترتّبها. تُطبَّق كل قاعدة مطابقة حسب الأولوية تصاعديًا.',
              en: 'Rules that show, hide or order methods. Every matching rule applies, by ascending priority.',
            },
            type: 'string-list',
            value: ['10 · العملة TRY ← PayTR أولًا (ترتيب)', '20 · الضيوف: إخفاء Apple Pay (إخفاء)'],
            default: [],
            structured: true,
          },
          {
            key: 'fallback.gateway',
            label: {
              ar: 'البوابة',
              en: 'Gateway',
            },
            help: {
              ar: 'بوابة الطريقة الاحتياطية.',
              en: 'Gateway of the fallback method.',
            },
            type: 'enum',
            value: 'STRIPE',
            default: 'STRIPE',
            options: [
              {
                value: 'STRIPE',
                label: {
                  ar: 'Stripe',
                  en: 'Stripe',
                },
              },
              {
                value: 'MYFATOORAH',
                label: {
                  ar: 'MyFatoorah',
                  en: 'MyFatoorah',
                },
              },
              {
                value: 'PAYMOB',
                label: {
                  ar: 'Paymob',
                  en: 'Paymob',
                },
              },
              {
                value: 'MOYASAR',
                label: {
                  ar: 'Moyasar',
                  en: 'Moyasar',
                },
              },
              {
                value: 'TAP',
                label: {
                  ar: 'Tap',
                  en: 'Tap',
                },
              },
              {
                value: 'PAYTR',
                label: {
                  ar: 'PayTR',
                  en: 'PayTR',
                },
              },
              {
                value: 'IYZICO',
                label: {
                  ar: 'iyzico',
                  en: 'iyzico',
                },
              },
            ],
          },
          {
            key: 'fallback.method',
            label: {
              ar: 'الطريقة',
              en: 'Method',
            },
            help: {
              ar: 'رمز طريقة الدفع، مثل card أو knet أو mada أو apple_pay أو benefit أو omannet أو fawry. أوقفه لتشمل كل طرق البوابة.',
              en: 'Payment method code, e.g. card, knet, mada, apple_pay, benefit, omannet or fawry. Switch it off for every method of the gateway.',
            },
            type: 'string',
            value: 'card',
            default: 'card',
          },
        ],
      },
      {
        id: 'wallet',
        title: {
          ar: 'الدفع من المحفظة',
          en: 'Wallet payments',
        },
        description: {
          ar: 'يظهر أيضًا في عرض «المحفظة».',
          en: 'Also shown in the Wallet view.',
        },
        fields: [
          {
            key: 'walletPayments.enabled',
            label: {
              ar: 'مفعّل',
              en: 'Enabled',
            },
            help: {
              ar: 'يمكن للعملاء المسجّلين الدفع من رصيد محفظتهم.',
              en: 'Signed-in customers may pay from their wallet balance.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'walletPayments.allowPartial',
            label: {
              ar: 'الدفع الجزئي من المحفظة',
              en: 'Partial wallet payments',
            },
            help: {
              ar: 'السماح بالجمع بين رصيد المحفظة وطريقة دفع أخرى.',
              en: 'Allow combining the wallet balance with another method.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'walletPayments.minPartialUsd',
            label: {
              ar: 'أصغر مبلغ جزئي (USD)',
              en: 'Smallest partial amount (USD)',
            },
            help: {
              ar: 'أصغر مبلغ من المحفظة في الدفع الجزئي.',
              en: 'Smallest wallet amount in a partial payment.',
            },
            type: 'money',
            value: 1,
            default: 1,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
          },
        ],
      },
    ],
  },
  {
    key: 'payment_gateways',
    section: 'payments',
    icon: 'KeyRound',
    title: {
      ar: 'بوابات الدفع',
      en: 'Payment gateways',
    },
    summary: {
      ar: 'مفاتيح البوابات، اختبار أو إنتاج، رابط الـ webhook (للمالك فقط)',
      en: 'Gateway keys, test or live, webhook URL (owner only)',
    },
    description: {
      ar: 'اربط حساب كل بوابة من هنا: مفاتيحها، وهل هي اختبار أم إنتاج، ورابط الـ webhook الذي تلصقه في لوحة البوابة. تُحفظ المفاتيح مشفّرة، وتتقدّم على مفاتيح الخادم (.env)، وتُطبَّق فوراً. لا يظهر السرّ المحفوظ مرة أخرى أبداً، بل آخر أربعة أحرف منه فقط.',
      en: 'Connect each gateway account here: its keys, test or live, and the webhook URL to paste in its portal. Saved keys are stored encrypted, win over the server (.env) and apply at once. A saved secret is never shown again: only its last four characters.',
    },
    kind: 'special',
    inDashboard: true,
    permission: {
      ar: 'للمالك فقط: payments.gateway_credentials، مع إعادة تسجيل الدخول قبل الحفظ.',
      en: 'Owner only: payments.gateway_credentials, with a recent sign-in before saving.',
    },
    approval: 'none',
    version: 6,
    schemaVersion: null,
    updatedAt: '2026-11-16T15:10:00.000Z',
    updatedBy: 'Sara Haddad',
    subsections: [
      {
        id: 'stripe',
        title: {
          ar: 'Stripe',
          en: 'Stripe',
        },
        description: {
          ar: 'بطاقات دولية وApple Pay وGoogle Pay.',
          en: 'International cards, Apple Pay and Google Pay.',
        },
        fields: [
          {
            key: 'STRIPE.source',
            label: {
              ar: 'مصدر المفاتيح',
              en: 'Keys source',
            },
            help: {
              ar: 'المحفوظ هنا يتقدم على متغيرات الخادم (.env).',
              en: 'Keys saved here win over the server variables (.env).',
            },
            type: 'enum',
            value: 'dashboard',
            default: 'none',
            options: [
              {
                value: 'dashboard',
                label: {
                  ar: 'محفوظة هنا',
                  en: 'Saved here',
                },
              },
              {
                value: 'environment',
                label: {
                  ar: 'من الخادم (.env)',
                  en: 'From the server (.env)',
                },
              },
              {
                value: 'none',
                label: {
                  ar: 'غير مضبوطة',
                  en: 'Not configured',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'STRIPE.mode',
            label: {
              ar: 'الوضع',
              en: 'Mode',
            },
            help: {
              ar: 'يُستنتج من المفاتيح: اختبار أو إنتاج. لا يُقبل مفتاح إنتاج على نسخة الاختبار.',
              en: 'Derived from the keys: test or live. Live keys are refused on the sandbox deployment.',
            },
            type: 'enum',
            value: 'live',
            default: 'unknown',
            options: [
              {
                value: 'test',
                label: {
                  ar: 'اختبار',
                  en: 'Test',
                },
              },
              {
                value: 'live',
                label: {
                  ar: 'إنتاج',
                  en: 'Live',
                },
              },
              {
                value: 'unknown',
                label: {
                  ar: 'غير معروف',
                  en: 'Unknown',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'STRIPE.secretKey',
            label: {
              ar: 'المفتاح السري',
              en: 'Secret key',
            },
            help: {
              ar: 'متغير الخادم: STRIPE_SECRET_KEY',
              en: 'Server variable: STRIPE_SECRET_KEY',
            },
            type: 'secret',
            value: '••••7Q2x',
            default: null,
            nullable: true,
            risk: 'high',
          },
          {
            key: 'STRIPE.publishableKey',
            label: {
              ar: 'المفتاح العام (Publishable)',
              en: 'Publishable key',
            },
            help: {
              ar: 'متغير الخادم: STRIPE_PUBLISHABLE_KEY',
              en: 'Server variable: STRIPE_PUBLISHABLE_KEY',
            },
            type: 'string',
            value: 'pk_live_51N…Hq8',
            default: null,
            nullable: true,
          },
          {
            key: 'STRIPE.webhookSecret',
            label: {
              ar: 'سرّ الـ webhook',
              en: 'Webhook secret',
            },
            help: {
              ar: 'متغير الخادم: STRIPE_WEBHOOK_SECRET',
              en: 'Server variable: STRIPE_WEBHOOK_SECRET',
            },
            type: 'secret',
            value: '••••c91d',
            default: null,
            nullable: true,
            risk: 'high',
          },
        ],
      },
      {
        id: 'myfatoorah',
        title: {
          ar: 'MyFatoorah',
          en: 'MyFatoorah',
        },
        description: {
          ar: 'الدفع المحلي في الخليج (SAR فقط في هذا الحساب).',
          en: 'GCC local payment (SAR only on this account).',
        },
        fields: [
          {
            key: 'MYFATOORAH.source',
            label: {
              ar: 'مصدر المفاتيح',
              en: 'Keys source',
            },
            help: {
              ar: 'المحفوظ هنا يتقدم على متغيرات الخادم (.env).',
              en: 'Keys saved here win over the server variables (.env).',
            },
            type: 'enum',
            value: 'environment',
            default: 'none',
            options: [
              {
                value: 'dashboard',
                label: {
                  ar: 'محفوظة هنا',
                  en: 'Saved here',
                },
              },
              {
                value: 'environment',
                label: {
                  ar: 'من الخادم (.env)',
                  en: 'From the server (.env)',
                },
              },
              {
                value: 'none',
                label: {
                  ar: 'غير مضبوطة',
                  en: 'Not configured',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'MYFATOORAH.mode',
            label: {
              ar: 'الوضع',
              en: 'Mode',
            },
            help: {
              ar: 'يُستنتج من المفاتيح: اختبار أو إنتاج. لا يُقبل مفتاح إنتاج على نسخة الاختبار.',
              en: 'Derived from the keys: test or live. Live keys are refused on the sandbox deployment.',
            },
            type: 'enum',
            value: 'live',
            default: 'unknown',
            options: [
              {
                value: 'test',
                label: {
                  ar: 'اختبار',
                  en: 'Test',
                },
              },
              {
                value: 'live',
                label: {
                  ar: 'إنتاج',
                  en: 'Live',
                },
              },
              {
                value: 'unknown',
                label: {
                  ar: 'غير معروف',
                  en: 'Unknown',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'MYFATOORAH.apiKey',
            label: {
              ar: 'مفتاح الـ API',
              en: 'API key',
            },
            help: {
              ar: 'متغير الخادم: MYFATOORAH_API_KEY',
              en: 'Server variable: MYFATOORAH_API_KEY',
            },
            type: 'secret',
            value: '••••a8F0',
            default: null,
            nullable: true,
            risk: 'high',
          },
          {
            key: 'MYFATOORAH.webhookSecret',
            label: {
              ar: 'سرّ الـ webhook',
              en: 'Webhook secret',
            },
            help: {
              ar: 'متغير الخادم: MYFATOORAH_WEBHOOK_SECRET',
              en: 'Server variable: MYFATOORAH_WEBHOOK_SECRET',
            },
            type: 'secret',
            value: '••••77b2',
            default: null,
            nullable: true,
            risk: 'high',
          },
          {
            key: 'MYFATOORAH.baseUrl',
            label: {
              ar: 'مضيف الـ API',
              en: 'API host',
            },
            help: {
              ar: 'متغير الخادم: MYFATOORAH_BASE_URL',
              en: 'Server variable: MYFATOORAH_BASE_URL',
            },
            type: 'enum',
            value: 'live_sa',
            default: 'test',
            options: [
              {
                value: 'test',
                label: {
                  ar: 'اختبار',
                  en: 'Test',
                },
              },
              {
                value: 'live',
                label: {
                  ar: 'إنتاج',
                  en: 'Live',
                },
              },
              {
                value: 'live_sa',
                label: {
                  ar: 'إنتاج (السعودية)',
                  en: 'Live (Saudi Arabia)',
                },
              },
              {
                value: 'live_qa',
                label: {
                  ar: 'إنتاج (قطر)',
                  en: 'Live (Qatar)',
                },
              },
              {
                value: 'live_eg',
                label: {
                  ar: 'إنتاج (مصر)',
                  en: 'Live (Egypt)',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'paymob',
        title: {
          ar: 'Paymob',
          en: 'Paymob',
        },
        description: {
          ar: 'مصر والخليج. غير مُعدّ.',
          en: 'Egypt and the Gulf. Not configured.',
        },
        fields: [
          {
            key: 'PAYMOB.source',
            label: {
              ar: 'مصدر المفاتيح',
              en: 'Keys source',
            },
            help: {
              ar: 'المحفوظ هنا يتقدم على متغيرات الخادم (.env).',
              en: 'Keys saved here win over the server variables (.env).',
            },
            type: 'enum',
            value: 'none',
            default: 'none',
            options: [
              {
                value: 'dashboard',
                label: {
                  ar: 'محفوظة هنا',
                  en: 'Saved here',
                },
              },
              {
                value: 'environment',
                label: {
                  ar: 'من الخادم (.env)',
                  en: 'From the server (.env)',
                },
              },
              {
                value: 'none',
                label: {
                  ar: 'غير مضبوطة',
                  en: 'Not configured',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'PAYMOB.mode',
            label: {
              ar: 'الوضع',
              en: 'Mode',
            },
            help: {
              ar: 'يُستنتج من المفاتيح: اختبار أو إنتاج. لا يُقبل مفتاح إنتاج على نسخة الاختبار.',
              en: 'Derived from the keys: test or live. Live keys are refused on the sandbox deployment.',
            },
            type: 'enum',
            value: 'unknown',
            default: 'unknown',
            options: [
              {
                value: 'test',
                label: {
                  ar: 'اختبار',
                  en: 'Test',
                },
              },
              {
                value: 'live',
                label: {
                  ar: 'إنتاج',
                  en: 'Live',
                },
              },
              {
                value: 'unknown',
                label: {
                  ar: 'غير معروف',
                  en: 'Unknown',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'PAYMOB.apiKey',
            label: {
              ar: 'مفتاح الـ API',
              en: 'API key',
            },
            help: {
              ar: 'متغير الخادم: PAYMOB_API_KEY',
              en: 'Server variable: PAYMOB_API_KEY',
            },
            type: 'secret',
            value: null,
            default: null,
            nullable: true,
            risk: 'high',
          },
          {
            key: 'PAYMOB.hmacSecret',
            label: {
              ar: 'سرّ HMAC',
              en: 'HMAC secret',
            },
            help: {
              ar: 'متغير الخادم: PAYMOB_HMAC_SECRET',
              en: 'Server variable: PAYMOB_HMAC_SECRET',
            },
            type: 'secret',
            value: null,
            default: null,
            nullable: true,
            risk: 'high',
          },
          {
            key: 'PAYMOB.publicKey',
            label: {
              ar: 'المفتاح العام',
              en: 'Public key',
            },
            help: {
              ar: 'متغير الخادم: PAYMOB_PUBLIC_KEY',
              en: 'Server variable: PAYMOB_PUBLIC_KEY',
            },
            type: 'string',
            value: null,
            default: null,
            nullable: true,
          },
          {
            key: 'PAYMOB.baseUrl',
            label: {
              ar: 'مضيف الـ API',
              en: 'API host',
            },
            help: {
              ar: 'متغير الخادم: PAYMOB_BASE_URL',
              en: 'Server variable: PAYMOB_BASE_URL',
            },
            type: 'enum',
            value: 'live_eg',
            default: 'live_eg',
            options: [
              {
                value: 'live_eg',
                label: {
                  ar: 'إنتاج (مصر)',
                  en: 'Live (Egypt)',
                },
              },
              {
                value: 'live_sa',
                label: {
                  ar: 'إنتاج (السعودية)',
                  en: 'Live (Saudi Arabia)',
                },
              },
              {
                value: 'live_ae',
                label: {
                  ar: 'إنتاج (الإمارات)',
                  en: 'Live (UAE)',
                },
              },
              {
                value: 'live_om',
                label: {
                  ar: 'إنتاج (عُمان)',
                  en: 'Live (Oman)',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'moyasar',
        title: {
          ar: 'Moyasar',
          en: 'Moyasar',
        },
        description: {
          ar: 'السعودية: مدى وSTC Pay. غير مُعدّ.',
          en: 'Saudi Arabia: mada and STC Pay. Not configured.',
        },
        fields: [
          {
            key: 'MOYASAR.source',
            label: {
              ar: 'مصدر المفاتيح',
              en: 'Keys source',
            },
            help: {
              ar: 'المحفوظ هنا يتقدم على متغيرات الخادم (.env).',
              en: 'Keys saved here win over the server variables (.env).',
            },
            type: 'enum',
            value: 'none',
            default: 'none',
            options: [
              {
                value: 'dashboard',
                label: {
                  ar: 'محفوظة هنا',
                  en: 'Saved here',
                },
              },
              {
                value: 'environment',
                label: {
                  ar: 'من الخادم (.env)',
                  en: 'From the server (.env)',
                },
              },
              {
                value: 'none',
                label: {
                  ar: 'غير مضبوطة',
                  en: 'Not configured',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'MOYASAR.mode',
            label: {
              ar: 'الوضع',
              en: 'Mode',
            },
            help: {
              ar: 'يُستنتج من المفاتيح: اختبار أو إنتاج. لا يُقبل مفتاح إنتاج على نسخة الاختبار.',
              en: 'Derived from the keys: test or live. Live keys are refused on the sandbox deployment.',
            },
            type: 'enum',
            value: 'unknown',
            default: 'unknown',
            options: [
              {
                value: 'test',
                label: {
                  ar: 'اختبار',
                  en: 'Test',
                },
              },
              {
                value: 'live',
                label: {
                  ar: 'إنتاج',
                  en: 'Live',
                },
              },
              {
                value: 'unknown',
                label: {
                  ar: 'غير معروف',
                  en: 'Unknown',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'MOYASAR.secretKey',
            label: {
              ar: 'المفتاح السري',
              en: 'Secret key',
            },
            help: {
              ar: 'متغير الخادم: MOYASAR_SECRET_KEY',
              en: 'Server variable: MOYASAR_SECRET_KEY',
            },
            type: 'secret',
            value: null,
            default: null,
            nullable: true,
            risk: 'high',
          },
          {
            key: 'MOYASAR.webhookSecret',
            label: {
              ar: 'سرّ الـ webhook',
              en: 'Webhook secret',
            },
            help: {
              ar: 'متغير الخادم: MOYASAR_WEBHOOK_SECRET',
              en: 'Server variable: MOYASAR_WEBHOOK_SECRET',
            },
            type: 'secret',
            value: null,
            default: null,
            nullable: true,
            risk: 'high',
          },
        ],
      },
      {
        id: 'tap',
        title: {
          ar: 'Tap',
          en: 'Tap',
        },
        description: {
          ar: 'الخليج ومصر. غير مُعدّ.',
          en: 'Gulf and Egypt. Not configured.',
        },
        fields: [
          {
            key: 'TAP.source',
            label: {
              ar: 'مصدر المفاتيح',
              en: 'Keys source',
            },
            help: {
              ar: 'المحفوظ هنا يتقدم على متغيرات الخادم (.env).',
              en: 'Keys saved here win over the server variables (.env).',
            },
            type: 'enum',
            value: 'none',
            default: 'none',
            options: [
              {
                value: 'dashboard',
                label: {
                  ar: 'محفوظة هنا',
                  en: 'Saved here',
                },
              },
              {
                value: 'environment',
                label: {
                  ar: 'من الخادم (.env)',
                  en: 'From the server (.env)',
                },
              },
              {
                value: 'none',
                label: {
                  ar: 'غير مضبوطة',
                  en: 'Not configured',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'TAP.mode',
            label: {
              ar: 'الوضع',
              en: 'Mode',
            },
            help: {
              ar: 'يُستنتج من المفاتيح: اختبار أو إنتاج. لا يُقبل مفتاح إنتاج على نسخة الاختبار.',
              en: 'Derived from the keys: test or live. Live keys are refused on the sandbox deployment.',
            },
            type: 'enum',
            value: 'unknown',
            default: 'unknown',
            options: [
              {
                value: 'test',
                label: {
                  ar: 'اختبار',
                  en: 'Test',
                },
              },
              {
                value: 'live',
                label: {
                  ar: 'إنتاج',
                  en: 'Live',
                },
              },
              {
                value: 'unknown',
                label: {
                  ar: 'غير معروف',
                  en: 'Unknown',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'TAP.secretKey',
            label: {
              ar: 'المفتاح السري',
              en: 'Secret key',
            },
            help: {
              ar: 'متغير الخادم: TAP_SECRET_KEY',
              en: 'Server variable: TAP_SECRET_KEY',
            },
            type: 'secret',
            value: null,
            default: null,
            nullable: true,
            risk: 'high',
          },
          {
            key: 'TAP.webhookSecret',
            label: {
              ar: 'سرّ الـ webhook',
              en: 'Webhook secret',
            },
            help: {
              ar: 'متغير الخادم: TAP_WEBHOOK_SECRET',
              en: 'Server variable: TAP_WEBHOOK_SECRET',
            },
            type: 'secret',
            value: null,
            default: null,
            nullable: true,
            risk: 'high',
          },
        ],
      },
      {
        id: 'paytr',
        title: {
          ar: 'PayTR',
          en: 'PayTR',
        },
        description: {
          ar: 'تركيا: الليرة والعملات الأجنبية، مع الأقساط.',
          en: 'Türkiye: TRY and foreign currencies, with installments.',
        },
        fields: [
          {
            key: 'PAYTR.source',
            label: {
              ar: 'مصدر المفاتيح',
              en: 'Keys source',
            },
            help: {
              ar: 'المحفوظ هنا يتقدم على متغيرات الخادم (.env).',
              en: 'Keys saved here win over the server variables (.env).',
            },
            type: 'enum',
            value: 'dashboard',
            default: 'none',
            options: [
              {
                value: 'dashboard',
                label: {
                  ar: 'محفوظة هنا',
                  en: 'Saved here',
                },
              },
              {
                value: 'environment',
                label: {
                  ar: 'من الخادم (.env)',
                  en: 'From the server (.env)',
                },
              },
              {
                value: 'none',
                label: {
                  ar: 'غير مضبوطة',
                  en: 'Not configured',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'PAYTR.mode',
            label: {
              ar: 'الوضع',
              en: 'Mode',
            },
            help: {
              ar: 'يُستنتج من المفاتيح: اختبار أو إنتاج. لا يُقبل مفتاح إنتاج على نسخة الاختبار.',
              en: 'Derived from the keys: test or live. Live keys are refused on the sandbox deployment.',
            },
            type: 'enum',
            value: 'live',
            default: 'unknown',
            options: [
              {
                value: 'test',
                label: {
                  ar: 'اختبار',
                  en: 'Test',
                },
              },
              {
                value: 'live',
                label: {
                  ar: 'إنتاج',
                  en: 'Live',
                },
              },
              {
                value: 'unknown',
                label: {
                  ar: 'غير معروف',
                  en: 'Unknown',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'PAYTR.merchantId',
            label: {
              ar: 'رقم التاجر',
              en: 'Merchant ID',
            },
            help: {
              ar: 'متغير الخادم: PAYTR_MERCHANT_ID',
              en: 'Server variable: PAYTR_MERCHANT_ID',
            },
            type: 'string',
            value: '412987',
            default: null,
            nullable: true,
          },
          {
            key: 'PAYTR.merchantKey',
            label: {
              ar: 'مفتاح التاجر',
              en: 'Merchant key',
            },
            help: {
              ar: 'متغير الخادم: PAYTR_MERCHANT_KEY',
              en: 'Server variable: PAYTR_MERCHANT_KEY',
            },
            type: 'secret',
            value: '••••K2mP',
            default: null,
            nullable: true,
            risk: 'high',
          },
          {
            key: 'PAYTR.merchantSalt',
            label: {
              ar: 'Salt التاجر',
              en: 'Merchant salt',
            },
            help: {
              ar: 'متغير الخادم: PAYTR_MERCHANT_SALT',
              en: 'Server variable: PAYTR_MERCHANT_SALT',
            },
            type: 'secret',
            value: '••••s9Qe',
            default: null,
            nullable: true,
            risk: 'high',
          },
          {
            key: 'PAYTR.testMode',
            label: {
              ar: 'وضع الاختبار',
              en: 'Test mode',
            },
            help: {
              ar: 'متغير الخادم: PAYTR_TEST_MODE',
              en: 'Server variable: PAYTR_TEST_MODE',
            },
            type: 'boolean',
            value: false,
            default: false,
            risk: 'high',
          },
          {
            key: 'PAYTR.fallbackIp',
            label: {
              ar: 'عنوان IP احتياطي (روابط الدفع)',
              en: 'Fallback IP (payment links)',
            },
            help: {
              ar: 'متغير الخادم: PAYTR_FALLBACK_IP',
              en: 'Server variable: PAYTR_FALLBACK_IP',
            },
            type: 'string',
            value: '85.105.12.40',
            default: null,
            nullable: true,
            format: 'cidr',
          },
          {
            key: 'PAYTR.maxInstallment',
            label: {
              ar: 'أقصى عدد للأقساط',
              en: 'Highest installment count',
            },
            help: {
              ar: 'متغير الخادم: PAYTR_MAX_INSTALLMENT',
              en: 'Server variable: PAYTR_MAX_INSTALLMENT',
            },
            type: 'integer',
            value: 6,
            default: 1,
            min: 1,
            max: 12,
          },
        ],
      },
      {
        id: 'iyzico',
        title: {
          ar: 'iyzico',
          en: 'iyzico',
        },
        description: {
          ar: 'تركيا: الليرة فقط، خيار ثانٍ بجانب PayTR. مفاتيح اختبار.',
          en: 'Türkiye: TRY only, second option next to PayTR. Test keys.',
        },
        fields: [
          {
            key: 'IYZICO.source',
            label: {
              ar: 'مصدر المفاتيح',
              en: 'Keys source',
            },
            help: {
              ar: 'المحفوظ هنا يتقدم على متغيرات الخادم (.env).',
              en: 'Keys saved here win over the server variables (.env).',
            },
            type: 'enum',
            value: 'dashboard',
            default: 'none',
            options: [
              {
                value: 'dashboard',
                label: {
                  ar: 'محفوظة هنا',
                  en: 'Saved here',
                },
              },
              {
                value: 'environment',
                label: {
                  ar: 'من الخادم (.env)',
                  en: 'From the server (.env)',
                },
              },
              {
                value: 'none',
                label: {
                  ar: 'غير مضبوطة',
                  en: 'Not configured',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'IYZICO.mode',
            label: {
              ar: 'الوضع',
              en: 'Mode',
            },
            help: {
              ar: 'يُستنتج من المفاتيح: اختبار أو إنتاج. لا يُقبل مفتاح إنتاج على نسخة الاختبار.',
              en: 'Derived from the keys: test or live. Live keys are refused on the sandbox deployment.',
            },
            type: 'enum',
            value: 'test',
            default: 'unknown',
            options: [
              {
                value: 'test',
                label: {
                  ar: 'اختبار',
                  en: 'Test',
                },
              },
              {
                value: 'live',
                label: {
                  ar: 'إنتاج',
                  en: 'Live',
                },
              },
              {
                value: 'unknown',
                label: {
                  ar: 'غير معروف',
                  en: 'Unknown',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'IYZICO.apiKey',
            label: {
              ar: 'مفتاح الـ API',
              en: 'API key',
            },
            help: {
              ar: 'متغير الخادم: IYZICO_API_KEY',
              en: 'Server variable: IYZICO_API_KEY',
            },
            type: 'secret',
            value: '••••sb01',
            default: null,
            nullable: true,
            risk: 'high',
          },
          {
            key: 'IYZICO.secretKey',
            label: {
              ar: 'المفتاح السري',
              en: 'Secret key',
            },
            help: {
              ar: 'متغير الخادم: IYZICO_SECRET_KEY',
              en: 'Server variable: IYZICO_SECRET_KEY',
            },
            type: 'secret',
            value: '••••sb02',
            default: null,
            nullable: true,
            risk: 'high',
          },
          {
            key: 'IYZICO.maxInstallment',
            label: {
              ar: 'أقصى عدد للأقساط',
              en: 'Highest installment count',
            },
            help: {
              ar: 'متغير الخادم: IYZICO_MAX_INSTALLMENT',
              en: 'Server variable: IYZICO_MAX_INSTALLMENT',
            },
            type: 'integer',
            value: 1,
            default: 1,
            min: 1,
            max: 12,
          },
          {
            key: 'IYZICO.baseUrl',
            label: {
              ar: 'مضيف الـ API',
              en: 'API host',
            },
            help: {
              ar: 'متغير الخادم: IYZICO_BASE_URL',
              en: 'Server variable: IYZICO_BASE_URL',
            },
            type: 'enum',
            value: 'test',
            default: 'test',
            options: [
              {
                value: 'test',
                label: {
                  ar: 'اختبار',
                  en: 'Test',
                },
              },
              {
                value: 'live',
                label: {
                  ar: 'إنتاج',
                  en: 'Live',
                },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'refund_policy',
    section: 'payments',
    icon: 'Undo2',
    title: {
      ar: 'سياسة الاسترداد',
      en: 'Refund policy',
    },
    summary: {
      ar: 'وجهة الاسترداد والاسترداد التلقائي',
      en: 'Refund destination and automation',
    },
    description: {
      ar: 'وجهة الاسترداد وحوافز المحفظة والاسترداد التلقائي.',
      en: 'Refund destination, wallet incentives and automatic refunds.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'second-approver',
    version: 17,
    schemaVersion: 6,
    updatedAt: '2026-11-15T12:05:00.000Z',
    updatedBy: 'Omar Kaya',
    subsections: [
      {
        id: 'destination',
        title: {
          ar: 'وجهة الاسترداد',
          en: 'Refund destination',
        },
        description: {
          ar: 'إلى البطاقة أو المحفظة أو باختيار العميل، والحافز على المحفظة.',
          en: 'To the card, the wallet or the customer’s choice, and the wallet bonus.',
        },
        fields: [
          {
            key: 'destination',
            label: {
              ar: 'وجهة الاسترداد',
              en: 'Refund destination',
            },
            help: {
              ar: 'وجهة المبالغ المستردة: وسيلة الدفع الأصلية أو محفظة العميل أو حسب اختيار العميل.',
              en: "Where refunds go: the original payment method, the customer wallet, or the customer's choice.",
            },
            type: 'enum',
            value: 'CUSTOMER_CHOICE',
            default: 'CUSTOMER_CHOICE',
            options: [
              {
                value: 'ORIGINAL_METHOD',
                label: {
                  ar: 'وسيلة الدفع الأصلية',
                  en: 'Original payment method',
                },
              },
              {
                value: 'WALLET',
                label: {
                  ar: 'المحفظة',
                  en: 'Wallet',
                },
              },
              {
                value: 'CUSTOMER_CHOICE',
                label: {
                  ar: 'حسب اختيار العميل',
                  en: "Customer's choice",
                },
              },
            ],
            risk: 'high',
          },
          {
            key: 'walletIncentivePercent',
            label: {
              ar: 'مكافأة الاسترداد إلى المحفظة (%)',
              en: 'Wallet refund bonus (%)',
            },
            help: {
              ar: 'رصيد إضافي بنسبة مئوية من المبلغ المسترد عندما يقبل العميل الاسترداد إلى المحفظة.',
              en: 'Extra credit, as a percent of the refund, when the customer accepts a wallet refund.',
            },
            type: 'number',
            value: 3,
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
        id: 'automation',
        title: {
          ar: 'الأتمتة والمدد',
          en: 'Automation & timing',
        },
        description: {
          ar: 'الاسترداد التلقائي وما يُعرض للعميل.',
          en: 'Automatic refunds and what customers are told.',
        },
        fields: [
          {
            key: 'autoRefundOnSupplierCancellation',
            label: {
              ar: 'استرداد تلقائي عند إلغاء شركة الطيران',
              en: 'Refund airline cancellations automatically',
            },
            help: {
              ar: 'الاسترداد تلقائيًا عندما تلغي شركة الطيران أو المورّد الحجز.',
              en: 'Refund automatically when the airline or the supplier cancels the booking.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'refundProcessingDays',
            label: {
              ar: 'مدة استرداد البطاقة (أيام عمل)',
              en: 'Card refund time (business days)',
            },
            help: {
              ar: 'عدد أيام العمل الظاهر للعملاء لاسترداد مبالغ البطاقات (تقديري).',
              en: 'Business days shown to customers for card refunds (an estimate).',
            },
            type: 'integer',
            value: 10,
            default: 10,
            min: 0,
            max: 60,
            unit: 'days',
          },
        ],
      },
      {
        id: 'approvals',
        title: {
          ar: 'الموافقات',
          en: 'Approvals',
        },
        description: {
          ar: 'استرداد الموظفين والتسويات خارج المنصة تنتظر موظفًا ثانيًا.',
          en: 'Staff refunds and offline settlements wait for a second staff member.',
        },
        fields: [
          {
            key: 'approvalThresholdUsd',
            label: {
              ar: 'الموافقة الثانية على الاسترداد من (USD)',
              en: 'Second approval of refunds from (USD)',
            },
            help: {
              ar: 'ينتظر الاسترداد الذي يجريه الموظف بهذه القيمة أو أكثر موافقةَ موظف ثانٍ يملك صلاحية اعتماد الاسترداد قبل تحريك أي مبلغ.',
              en: 'A staff refund worth this many USD or more waits for a second staff member who can approve refunds before any money moves.',
            },
            type: 'money',
            value: 250,
            default: 0,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'money',
            risk: 'high',
            note: {
              ar: 'يُخزَّن كنص عشري ("250.00").',
              en: 'Stored as a decimal string ("250.00").',
            },
          },
          {
            key: 'offlineSettlement.approvalRequired',
            label: {
              ar: 'التسويات الكبيرة تحتاج موظفًا ثانيًا',
              en: 'Large settlements need a second staff member',
            },
            help: {
              ar: 'المفتاح الرئيسي: التسوية خارج المنصة التي تزيد على الحد تُسجَّل فقط، وينتظر الاسترداد موظفًا ثانيًا يملك صلاحية اعتماد الاسترداد ليؤكدها. المالك لا يحتاج موافقة ثانية. عند إيقافه يسوّيها فورًا من يملك صلاحية التسوية. مفعّل افتراضيًا.',
              en: 'Main switch: an offline settlement above the threshold is only recorded, and the refund waits for a second staff member allowed to approve refunds to confirm it. The owner never needs a second approval. Off: whoever may settle it settles it at once. On by default.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
            twoPerson: true,
            risk: 'high',
          },
          {
            key: 'offlineSettlement.approvalThresholdUsd',
            label: {
              ar: 'حد الموافقة الثانية (USD)',
              en: 'Second approval threshold (USD)',
            },
            help: {
              ar: 'التسويات التي تزيد قيمتها على هذا المبلغ بالدولار تنتظر موظفًا ثانيًا، وما كان مساويًا له أو أقل يُسوّى فورًا. القيمة 0 تعني أن كل تسوية تنتظر. الافتراضي 500.',
              en: 'Settlements worth more than this many US dollars wait for a second staff member; at or under it they are settled at once. 0 means every settlement waits. Default 500.',
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
      {
        id: 'failed',
        title: {
          ar: 'الحجوزات الفاشلة بعد الدفع',
          en: 'Bookings failed after payment',
        },
        description: {
          ar: 'عندما ترفض شركة الطيران حجزًا مدفوعًا.',
          en: 'When the airline refuses a paid booking.',
        },
        fields: [
          {
            key: 'failedBooking.mode',
            label: {
              ar: 'وجهة الاسترداد',
              en: 'Refund destination',
            },
            help: {
              ar: 'حسب اختيار العميل (موصى به): يختار العميل المسجَّل بين المحفظة (مع المكافأة) والبطاقة. وسيلة الدفع الأصلية: يُعاد المبلغ دائمًا إلى البطاقة (السلوك الحالي). المحفظة: يُضاف دائمًا إلى المحفظة. الضيوف يُعاد لهم المبلغ دائمًا إلى البطاقة، والمدفوعات من المحفظة تعود دائمًا إلى المحفظة.',
              en: "Customer's choice (recommended): a signed-in customer picks the wallet (with the bonus) or the card. Original payment method: always back to the card (the current behaviour). Wallet: always to the wallet. Guests always get the card back; wallet payments always go back to the wallet.",
            },
            type: 'enum',
            value: 'CUSTOMER_CHOICE',
            default: 'ORIGINAL_METHOD',
            options: [
              {
                value: 'CUSTOMER_CHOICE',
                label: {
                  ar: 'حسب اختيار العميل',
                  en: "Customer's choice",
                },
              },
              {
                value: 'ORIGINAL_METHOD',
                label: {
                  ar: 'وسيلة الدفع الأصلية',
                  en: 'Original payment method',
                },
              },
              {
                value: 'WALLET',
                label: {
                  ar: 'المحفظة',
                  en: 'Wallet',
                },
              },
            ],
          },
          {
            key: 'failedBooking.defaultChoice',
            label: {
              ar: 'إذا لم يختر العميل',
              en: 'If the customer does not choose',
            },
            help: {
              ar: 'الوجهة المطبَّقة عند انتهاء مهلة الاختيار دون رد.',
              en: 'Destination applied when the choice window ends without an answer.',
            },
            type: 'enum',
            value: 'WALLET',
            default: 'WALLET',
            options: [
              {
                value: 'WALLET',
                label: {
                  ar: 'المحفظة',
                  en: 'Wallet',
                },
              },
              {
                value: 'ORIGINAL_METHOD',
                label: {
                  ar: 'وسيلة الدفع الأصلية',
                  en: 'Original payment method',
                },
              },
            ],
          },
          {
            key: 'failedBooking.choiceWindowHours',
            label: {
              ar: 'مهلة الاختيار (ساعات)',
              en: 'Time to choose (hours)',
            },
            help: {
              ar: 'المدة المتاحة للعميل ليختار بين المحفظة والبطاقة.',
              en: 'How long the customer has to choose the wallet or the card.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 168,
          },
          {
            key: 'failedBooking.walletIncentivePercent',
            label: {
              ar: 'مكافأة المحفظة للحجز الفاشل (%)',
              en: 'Wallet bonus for a failed booking (%)',
            },
            help: {
              ar: 'رصيد إضافي بنسبة مئوية من المبلغ المسترد عندما يختار العميل استرداد هذا المبلغ إلى المحفظة. أوقفه لاستخدام مكافأة الاسترداد إلى المحفظة العامة.',
              en: 'Extra credit, as a percent of the refund, when the customer takes this refund to the wallet. Switch it off to use the general wallet refund bonus.',
            },
            type: 'number',
            value: 5,
            default: null,
            nullable: true,
            min: 0,
            max: 20,
            unit: 'percent',
            step: 0.5,
            control: 'money',
          },
        ],
      },
      {
        id: 'topups',
        title: {
          ar: 'شحن المحفظة',
          en: 'Wallet top-ups',
        },
        description: {
          ar: 'حدود الشحن بالبطاقة وضوابط الحسابات الجديدة.',
          en: 'Card top-up limits and the new-account controls.',
        },
        fields: [
          {
            key: 'allowWalletTopup',
            label: {
              ar: 'شحن المحفظة',
              en: 'Wallet top-ups',
            },
            help: {
              ar: 'يمكن للعملاء شحن محفظتهم بالبطاقة.',
              en: 'Customers may top up their wallet by card.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'walletTopUp.minUsd',
            label: {
              ar: 'أصغر شحن (USD)',
              en: 'Smallest top-up (USD)',
            },
            help: {
              ar: 'أصغر مبلغ شحن يمكن للعميل طلبه.',
              en: 'Smallest top-up a customer may ask for.',
            },
            type: 'money',
            value: 5,
            default: 5,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
          },
          {
            key: 'walletTopUp.maxUsd',
            label: {
              ar: 'أكبر شحن (USD)',
              en: 'Largest top-up (USD)',
            },
            help: {
              ar: 'أكبر مبلغ لعملية شحن واحدة.',
              en: 'Largest single top-up.',
            },
            type: 'money',
            value: 3000,
            default: 5000,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
          },
          {
            key: 'walletTopUp.dailyMaxUsd',
            label: {
              ar: 'حد الشحن اليومي (USD)',
              en: 'Daily top-up limit (USD)',
            },
            help: {
              ar: 'أقصى ما يمكن للعميل شحنه خلال أي 24 ساعة، ويشمل الشحن المعلّق والمكتمل.',
              en: 'Most a customer may top up in any 24 hours, pending and completed top-ups together.',
            },
            type: 'money',
            value: 10000,
            default: 10000,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
          },
          {
            key: 'walletTopUp.requireVerifiedEmail',
            label: {
              ar: 'بريد موثّق قبل الشحن',
              en: 'Verified e-mail before a top-up',
            },
            help: {
              ar: 'مفعّل (موصى به): يجب أن يوثّق العميل بريده الإلكتروني قبل شحن المحفظة. معطّل: يمكن لأي عميل مسجّل الشحن، مما يسمح لحساب مؤقت بتحميل بطاقة مسروقة. إعداد مالي حساس.',
              en: 'On (recommended): a customer must verify their e-mail address before topping up the wallet. Off: any signed-in customer may top up, which lets a throw-away account load a stolen card. Money control.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
            risk: 'high',
          },
          {
            key: 'walletTopUp.minAccountAgeHours',
            label: {
              ar: 'أقل عمر للحساب (ساعات)',
              en: 'Minimum account age (hours)',
            },
            help: {
              ar: 'يجب أن يكون عمر الحساب هذا العدد من الساعات على الأقل (من التسجيل) قبل أن يشحن. 0 يعني فورًا (الافتراضي). إعداد مالي حساس.',
              en: 'An account must be at least this many hours old (counted from sign-up) before it may top up. 0 means at once (default). Money control.',
            },
            type: 'duration',
            value: 0,
            default: 0,
            unit: 'hours',
            min: 0,
            max: 720,
            control: 'money',
          },
          {
            key: 'walletTopUp.newAccountDays',
            label: {
              ar: 'فترة الحساب الجديد (أيام)',
              en: 'New account period (days)',
            },
            help: {
              ar: 'عدد الأيام التي يُعدّ فيها الحساب جديدًا. خلالها تُطبَّق حدود الحساب الجديد الثلاثة أدناه إضافة إلى الحدود العادية. 0 يعطّل حدود الحساب الجديد. الافتراضي 7. إعداد مالي حساس.',
              en: 'How many days an account counts as new. While new, the three new-account caps below apply on top of the normal limits. 0 switches the new-account caps off. Default 7. Money control.',
            },
            type: 'duration',
            value: 7,
            default: 7,
            unit: 'days',
            min: 0,
            max: 90,
            control: 'money',
          },
          {
            key: 'walletTopUp.newAccountMaxUsd',
            label: {
              ar: 'حساب جديد: أكبر شحنة (دولار)',
              en: 'New account: largest top-up (USD)',
            },
            help: {
              ar: 'أكبر شحنة واحدة يمكن أن يقوم بها حساب جديد. الافتراضي 500. إعداد مالي حساس.',
              en: 'Largest single top-up a new account may make. Default 500. Money control.',
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
          {
            key: 'walletTopUp.newAccountDailyMaxUsd',
            label: {
              ar: 'حساب جديد: لكل 24 ساعة (دولار)',
              en: 'New account: per 24 hours (USD)',
            },
            help: {
              ar: 'أقصى ما يشحنه حساب جديد خلال 24 ساعة متحركة (المعلّق والمكتمل معًا) بدلًا من الحد اليومي العادي إن كان أعلى. الافتراضي 500. إعداد مالي حساس.',
              en: 'Most a new account may top up per rolling 24 hours (pending and completed together), instead of the normal daily maximum when that is higher. Default 500. Money control.',
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
          {
            key: 'walletTopUp.newAccountTotalMaxUsd',
            label: {
              ar: 'حساب جديد: طوال الفترة (دولار)',
              en: 'New account: whole period (USD)',
            },
            help: {
              ar: 'أقصى ما يشحنه حساب جديد طوال فترة الحساب الجديد (المعلّق والمكتمل معًا). الافتراضي 1,000. إعداد مالي حساس.',
              en: 'Most a new account may top up over its whole new-account period (pending and completed together). Default 1,000. Money control.',
            },
            type: 'money',
            value: 1000,
            default: 1000,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'money',
          },
          {
            key: 'walletTopUp.maxTopUpsPerDay',
            label: {
              ar: 'عدد الشحنات لكل 24 ساعة',
              en: 'Top-ups per 24 hours',
            },
            help: {
              ar: 'أقصى عدد من طلبات الشحن للعميل خلال 24 ساعة متحركة مهما كانت المبالغ: كابح لتجربة البطاقات المسروقة بشحنات صغيرة. الافتراضي 5. إعداد مالي حساس.',
              en: 'Most top-up requests per customer per rolling 24 hours, whatever the amounts: a brake on testing stolen cards with small top-ups. Default 5. Money control.',
            },
            type: 'integer',
            value: 5,
            default: 5,
            min: 1,
            max: 100,
            control: 'money',
          },
        ],
      },
      {
        id: 'funds',
        title: {
          ar: 'ترتيب صرف أموال المحفظة',
          en: 'Wallet money order',
        },
        description: {
          ar: 'أي نوع من أموال المحفظة يُصرف أولًا.',
          en: 'Which kind of wallet money is spent first.',
        },
        fields: [
          {
            key: 'walletFunds.spendOrder',
            label: {
              ar: 'ترتيب الصرف',
              en: 'Spend order',
            },
            help: {
              ar: 'الترتيب الذي تستخدم به دفعة المحفظة (أو أي خصم) أصناف الأموال؛ ويظهر كل صنف مرة واحدة. الموصى به (الافتراضي): ترويجي، ولاء، تعويض، استرداد بطاقة، نقدي: يُصرف المال الترويجي أولًا ويُترك المال الذي يمكن للعميل استرداده للنهاية. وضع النقدي أولًا يجعل العملاء يصرفون أموالهم قبل العروض. إعداد مالي حساس.',
              en: 'The order in which a wallet payment (or any debit) uses the classes of money; every class appears once. Recommended (default): Promotional, Loyalty, Compensation, Card refund, Cash: promotional money is used first and the money a customer could take back out is kept for last. Putting Cash first makes customers spend their own money before the promotions. Money control.',
            },
            type: 'string-list',
            value: ['PROMO', 'LOYALTY', 'COMPENSATION', 'CARD_REFUND', 'CASH'],
            default: ['PROMO', 'LOYALTY', 'COMPENSATION', 'CARD_REFUND', 'CASH'],
            options: [
              {
                value: 'PROMO',
                label: {
                  ar: 'ترويجي',
                  en: 'Promotional',
                },
              },
              {
                value: 'LOYALTY',
                label: {
                  ar: 'نقاط الولاء',
                  en: 'Loyalty points',
                },
              },
              {
                value: 'COMPENSATION',
                label: {
                  ar: 'تعويض',
                  en: 'Compensation',
                },
              },
              {
                value: 'CARD_REFUND',
                label: {
                  ar: 'استرداد بطاقة',
                  en: 'Card refund',
                },
              },
              {
                value: 'CASH',
                label: {
                  ar: 'نقدي (الشحن)',
                  en: 'Cash (top-ups)',
                },
              },
            ],
            control: 'money',
            ordered: true,
          },
        ],
      },
    ],
  },
  {
    key: 'fraud_policy',
    section: 'payments',
    icon: 'ShieldX',
    title: {
      ar: 'الحماية من الاحتيال',
      en: 'Fraud protection',
    },
    summary: {
      ar: 'مراجعة المخاطر قبل التذكرة وقواعد الاحتيال و3-D Secure وتجربة البطاقات',
      en: 'Risk review before ticketing, fraud rules, 3-D Secure and card testing',
    },
    description: {
      ar: 'الحماية من البطاقات المسروقة: مراجعة المخاطر التي تحجز الحجز المدفوع المشبوه قبل تذكرته، والقواعد التي تجمع درجة مخاطره، ومتى يُطلب 3-D Secure، وحدود محاولات البطاقات المرفوضة. كل مفتاح إعداد أمني: التغيير من غير المالك يُرسل للموافقة ولا يُطبَّق إلا بعد موافقة مدير ثانٍ. تسري التغييرات على الدفعات التي تُفتح بعدها.',
      en: 'Protection against stolen cards: the risk review that holds a suspicious paid booking before its ticket, the rules that add up its risk score, when 3-D Secure is asked for, and the limits on declined card attempts. Every key is a security control: a change by anyone but the owner is sent for approval and applied only when a second admin approves it. Changes apply to payments opened afterwards.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'second-approver',
    version: 8,
    schemaVersion: 3,
    updatedAt: '2026-11-02T18:40:00.000Z',
    updatedBy: 'Sara Haddad',
    masterSwitch: 'review.enabled',
    enabled: true,
    subsections: [
      {
        id: 'review',
        title: {
          ar: 'مراجعة المخاطر',
          en: 'Risk review',
        },
        description: {
          ar: 'حجز بدرجة مخاطر عالية ينتظر شخصًا قبل إصدار التذكرة.',
          en: 'A booking with a high risk score waits for a person before the ticket is issued.',
        },
        fields: [
          {
            key: 'review.enabled',
            label: {
              ar: 'حجز الحجوزات الخطرة للمراجعة',
              en: 'Hold risky bookings for review',
            },
            help: {
              ar: 'مفعّل (موصى به): الحجز الذي تحصل دفعة بطاقته على درجة المراجعة أو أكثر ينتظر في قائمة مراجعة المخاطر؛ ويُفرج عنه الموظف (فيُؤكَّد كالمعتاد) أو يرفضه (فيُلغى ويُسترد). معطّل: يُؤكَّد كل حجز مدفوع فورًا، وتبقى الدرجات تُسجَّل.',
              en: 'On (recommended): a booking whose card payment scores at or above the review score waits in the risk review queue; staff release it (confirmed as usual) or reject it (cancelled and refunded). Off: every paid booking is confirmed at once; scores are still recorded.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
            risk: 'high',
          },
          {
            key: 'review.reviewScore',
            label: {
              ar: 'درجة المراجعة',
              en: 'Review score',
            },
            help: {
              ar: 'درجة المخاطر التي ينتظر الحجز عندها أو فوقها قرار شخص. الدرجة مجموع نقاط القواعد التي انطبقت. بالنقاط الافتراضية تكفي إشارة قوية واحدة (بطاقة لعدة حسابات، 60) أو إشارتان متوسطتان (سفر في اليوم نفسه 30 + مبلغ مرتفع 30) لبلوغ الافتراضي 60. رفعها يعني حجز حجوزات أقل.',
              en: 'Risk score at or above which the booking waits for a person. The score is the sum of the points of the rules that matched. With the default points, one strong signal (a card shared by several accounts, 60) or two medium ones (same-day travel 30 + a high amount 30) reach the default of 60. Higher means fewer bookings held.',
            },
            type: 'integer',
            value: 60,
            default: 60,
            min: 1,
            max: 1000,
            control: 'security',
            unit: 'score',
          },
          {
            key: 'review.reminderMinutes',
            label: {
              ar: 'التذكير أثناء الانتظار (دقائق)',
              en: 'Reminder while waiting (minutes)',
            },
            help: {
              ar: 'يكرّر التنبيه لفريق التشغيل ما دام الحجز ينتظر في مراجعة المخاطر دون قرار: أول تذكير بعد هذا العدد من الدقائق من حجزه، ثم كل المدة نفسها حتى يُفرج عنه أحد أو يرفضه (قد تنتهي صلاحية الأجرة أثناء الانتظار). 0 يوقف التذكيرات (يبقى فقط التنبيه عند الحجز). الافتراضي 60.',
              en: 'Repeats the alert to operations while a booking waits in risk review with no decision: the first reminder this many minutes after the booking was held, then again every as many minutes until someone releases or rejects it (the fare may expire meanwhile). 0 switches the reminders off (only the alert raised when it was held). Default 60.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 0,
            max: 10080,
            control: 'security',
          },
        ],
      },
      {
        id: 'rules',
        title: {
          ar: 'قواعد التقييم',
          en: 'Scoring rules',
        },
        description: {
          ar: 'تُجمع درجات القواعد المطابقة في درجة الدفعة.',
          en: 'The scores of matching rules add up to the payment’s score.',
        },
        fields: [
          {
            key: 'rules.cardSharedAcrossAccounts.enabled',
            label: {
              ar: 'تطبيق هذه القاعدة',
              en: 'Apply this rule',
            },
            help: {
              ar: 'مفعّل: تضيف القاعدة نقاطها عندما تنطبق. معطّل: تُتجاهل.',
              en: 'On: the rule adds its points when it matches. Off: it is ignored.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'rules.cardSharedAcrossAccounts.maxAccounts',
            label: {
              ar: 'أقصى عدد حسابات للبطاقة',
              en: 'Most accounts per card',
            },
            help: {
              ar: 'أقصى عدد من الحسابات يمكن أن تدفع لها بطاقة واحدة خلال النافذة. حساب إضافي واحد يجعل القاعدة تنطبق.',
              en: 'Most accounts one card may pay for in the window. One more matches the rule.',
            },
            type: 'integer',
            value: 2,
            default: 2,
            min: 1,
            max: 100,
            control: 'security',
          },
          {
            key: 'rules.cardSharedAcrossAccounts.windowHours',
            label: {
              ar: 'النافذة (ساعات)',
              en: 'Window (hours)',
            },
            help: {
              ar: 'عدد الساعات التي يعود إليها العدّ (نافذة متحركة تنتهي عند الدفع). الأطول يلتقط الاحتيال البطيء لكنه يلتقط أيضًا عملاء حقيقيين متكررين أكثر.',
              en: 'How many hours back the count looks (a rolling window ending at the payment). Longer catches slower abuse but also more genuine repeat customers.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 720,
            control: 'security',
          },
          {
            key: 'rules.cardSharedAcrossAccounts.score',
            label: {
              ar: 'النقاط',
              en: 'Points',
            },
            help: {
              ar: 'النقاط التي تضيفها القاعدة إلى درجة المخاطر عندما تنطبق (0 إلى 100). قارنها بدرجة المراجعة: النقاط التي تساويها أو تتجاوزها تحجز الحجز وحدها.',
              en: 'Points this rule adds to the risk score when it matches (0 to 100). Compare with the review score: points at or above it hold the booking on their own.',
            },
            type: 'integer',
            value: 60,
            default: 60,
            min: 0,
            max: 100,
            control: 'security',
            unit: 'score',
          },
          {
            key: 'rules.cardsPerAccount.enabled',
            label: {
              ar: 'تطبيق هذه القاعدة',
              en: 'Apply this rule',
            },
            help: {
              ar: 'مفعّل: تضيف القاعدة نقاطها عندما تنطبق. معطّل: تُتجاهل.',
              en: 'On: the rule adds its points when it matches. Off: it is ignored.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'rules.cardsPerAccount.maxCards',
            label: {
              ar: 'أقصى عدد بطاقات للحساب',
              en: 'Most cards per account',
            },
            help: {
              ar: 'أقصى عدد من البطاقات المختلفة يمكن أن يدفع بها حساب واحد خلال النافذة.',
              en: 'Most different cards one account may pay with in the window.',
            },
            type: 'integer',
            value: 3,
            default: 3,
            min: 1,
            max: 100,
            control: 'security',
          },
          {
            key: 'rules.cardsPerAccount.windowHours',
            label: {
              ar: 'النافذة (ساعات)',
              en: 'Window (hours)',
            },
            help: {
              ar: 'عدد الساعات التي يعود إليها العدّ (نافذة متحركة تنتهي عند الدفع). الأطول يلتقط الاحتيال البطيء لكنه يلتقط أيضًا عملاء حقيقيين متكررين أكثر.',
              en: 'How many hours back the count looks (a rolling window ending at the payment). Longer catches slower abuse but also more genuine repeat customers.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 720,
            control: 'security',
          },
          {
            key: 'rules.cardsPerAccount.score',
            label: {
              ar: 'النقاط',
              en: 'Points',
            },
            help: {
              ar: 'النقاط التي تضيفها القاعدة إلى درجة المخاطر عندما تنطبق (0 إلى 100). قارنها بدرجة المراجعة: النقاط التي تساويها أو تتجاوزها تحجز الحجز وحدها.',
              en: 'Points this rule adds to the risk score when it matches (0 to 100). Compare with the review score: points at or above it hold the booking on their own.',
            },
            type: 'integer',
            value: 40,
            default: 40,
            min: 0,
            max: 100,
            control: 'security',
            unit: 'score',
          },
          {
            key: 'rules.accountsPerDevice.enabled',
            label: {
              ar: 'تطبيق هذه القاعدة',
              en: 'Apply this rule',
            },
            help: {
              ar: 'مفعّل: تضيف القاعدة نقاطها عندما تنطبق. معطّل: تُتجاهل.',
              en: 'On: the rule adds its points when it matches. Off: it is ignored.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'rules.accountsPerDevice.maxAccounts',
            label: {
              ar: 'أقصى عدد حسابات للجهاز',
              en: 'Most accounts per device',
            },
            help: {
              ar: 'أقصى عدد من الحسابات يمكن أن تدفع من جهاز واحد خلال النافذة.',
              en: 'Most accounts that may pay from one device in the window.',
            },
            type: 'integer',
            value: 3,
            default: 3,
            min: 1,
            max: 100,
            control: 'security',
          },
          {
            key: 'rules.accountsPerDevice.windowHours',
            label: {
              ar: 'النافذة (ساعات)',
              en: 'Window (hours)',
            },
            help: {
              ar: 'عدد الساعات التي يعود إليها العدّ (نافذة متحركة تنتهي عند الدفع). الأطول يلتقط الاحتيال البطيء لكنه يلتقط أيضًا عملاء حقيقيين متكررين أكثر.',
              en: 'How many hours back the count looks (a rolling window ending at the payment). Longer catches slower abuse but also more genuine repeat customers.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 720,
            control: 'security',
          },
          {
            key: 'rules.accountsPerDevice.score',
            label: {
              ar: 'النقاط',
              en: 'Points',
            },
            help: {
              ar: 'النقاط التي تضيفها القاعدة إلى درجة المخاطر عندما تنطبق (0 إلى 100). قارنها بدرجة المراجعة: النقاط التي تساويها أو تتجاوزها تحجز الحجز وحدها.',
              en: 'Points this rule adds to the risk score when it matches (0 to 100). Compare with the review score: points at or above it hold the booking on their own.',
            },
            type: 'integer',
            value: 40,
            default: 40,
            min: 0,
            max: 100,
            control: 'security',
            unit: 'score',
          },
          {
            key: 'rules.paymentsPerIp.enabled',
            label: {
              ar: 'تطبيق هذه القاعدة',
              en: 'Apply this rule',
            },
            help: {
              ar: 'مفعّل: تضيف القاعدة نقاطها عندما تنطبق. معطّل: تُتجاهل.',
              en: 'On: the rule adds its points when it matches. Off: it is ignored.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'rules.paymentsPerIp.maxPayments',
            label: {
              ar: 'أقصى عدد دفعات لعنوان IP',
              en: 'Most payments per IP',
            },
            help: {
              ar: 'أقصى عدد من دفعات البطاقة الناجحة من عنوان IP عام واحد خلال النافذة.',
              en: 'Most successful card payments from one public IP address in the window.',
            },
            type: 'integer',
            value: 5,
            default: 5,
            min: 1,
            max: 10000,
            control: 'security',
          },
          {
            key: 'rules.paymentsPerIp.windowHours',
            label: {
              ar: 'النافذة (ساعات)',
              en: 'Window (hours)',
            },
            help: {
              ar: 'عدد الساعات التي يعود إليها العدّ (نافذة متحركة تنتهي عند الدفع). الأطول يلتقط الاحتيال البطيء لكنه يلتقط أيضًا عملاء حقيقيين متكررين أكثر.',
              en: 'How many hours back the count looks (a rolling window ending at the payment). Longer catches slower abuse but also more genuine repeat customers.',
            },
            type: 'duration',
            value: 1,
            default: 1,
            unit: 'hours',
            min: 1,
            max: 720,
            control: 'security',
          },
          {
            key: 'rules.paymentsPerIp.score',
            label: {
              ar: 'النقاط',
              en: 'Points',
            },
            help: {
              ar: 'النقاط التي تضيفها القاعدة إلى درجة المخاطر عندما تنطبق (0 إلى 100). قارنها بدرجة المراجعة: النقاط التي تساويها أو تتجاوزها تحجز الحجز وحدها.',
              en: 'Points this rule adds to the risk score when it matches (0 to 100). Compare with the review score: points at or above it hold the booking on their own.',
            },
            type: 'integer',
            value: 30,
            default: 30,
            min: 0,
            max: 100,
            control: 'security',
            unit: 'score',
          },
          {
            key: 'rules.countryMismatch.enabled',
            label: {
              ar: 'تطبيق هذه القاعدة',
              en: 'Apply this rule',
            },
            help: {
              ar: 'مفعّل: تضيف القاعدة نقاطها عندما تنطبق. معطّل: تُتجاهل.',
              en: 'On: the rule adds its points when it matches. Off: it is ignored.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'rules.countryMismatch.score',
            label: {
              ar: 'النقاط',
              en: 'Points',
            },
            help: {
              ar: 'النقاط التي تضيفها القاعدة إلى درجة المخاطر عندما تنطبق (0 إلى 100). قارنها بدرجة المراجعة: النقاط التي تساويها أو تتجاوزها تحجز الحجز وحدها.',
              en: 'Points this rule adds to the risk score when it matches (0 to 100). Compare with the review score: points at or above it hold the booking on their own.',
            },
            type: 'integer',
            value: 25,
            default: 25,
            min: 0,
            max: 100,
            control: 'security',
            unit: 'score',
          },
          {
            key: 'rules.sameDayTravel.enabled',
            label: {
              ar: 'تطبيق هذه القاعدة',
              en: 'Apply this rule',
            },
            help: {
              ar: 'مفعّل: تضيف القاعدة نقاطها عندما تنطبق. معطّل: تُتجاهل.',
              en: 'On: the rule adds its points when it matches. Off: it is ignored.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'rules.sameDayTravel.withinHours',
            label: {
              ar: 'خلال (ساعات)',
              en: 'Within (hours)',
            },
            help: {
              ar: 'تنطبق القاعدة عندما تقلع أول رحلة خلال هذا العدد من الساعات بعد الدفع.',
              en: 'The rule matches when the first flight leaves within this many hours of the payment.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 168,
            control: 'security',
          },
          {
            key: 'rules.sameDayTravel.score',
            label: {
              ar: 'النقاط',
              en: 'Points',
            },
            help: {
              ar: 'النقاط التي تضيفها القاعدة إلى درجة المخاطر عندما تنطبق (0 إلى 100). قارنها بدرجة المراجعة: النقاط التي تساويها أو تتجاوزها تحجز الحجز وحدها.',
              en: 'Points this rule adds to the risk score when it matches (0 to 100). Compare with the review score: points at or above it hold the booking on their own.',
            },
            type: 'integer',
            value: 35,
            default: 30,
            min: 0,
            max: 100,
            control: 'security',
            unit: 'score',
          },
          {
            key: 'rules.highAmount.enabled',
            label: {
              ar: 'تطبيق هذه القاعدة',
              en: 'Apply this rule',
            },
            help: {
              ar: 'مفعّل: تضيف القاعدة نقاطها عندما تنطبق. معطّل: تُتجاهل.',
              en: 'On: the rule adds its points when it matches. Off: it is ignored.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'rules.highAmount.amountUsd',
            label: {
              ar: 'ابتداءً من (دولار)',
              en: 'From (USD)',
            },
            help: {
              ar: 'إجمالي الحجز بالدولار الأمريكي الذي تنطبق القاعدة ابتداءً منه.',
              en: 'Booking total in US dollars from which the rule matches.',
            },
            type: 'money',
            value: 1000,
            default: 1000,
            min: 1,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'security',
          },
          {
            key: 'rules.highAmount.score',
            label: {
              ar: 'النقاط',
              en: 'Points',
            },
            help: {
              ar: 'النقاط التي تضيفها القاعدة إلى درجة المخاطر عندما تنطبق (0 إلى 100). قارنها بدرجة المراجعة: النقاط التي تساويها أو تتجاوزها تحجز الحجز وحدها.',
              en: 'Points this rule adds to the risk score when it matches (0 to 100). Compare with the review score: points at or above it hold the booking on their own.',
            },
            type: 'integer',
            value: 30,
            default: 30,
            min: 0,
            max: 100,
            control: 'security',
            unit: 'score',
          },
          {
            key: 'rules.noLiabilityShift.enabled',
            label: {
              ar: 'تطبيق هذه القاعدة',
              en: 'Apply this rule',
            },
            help: {
              ar: 'مفعّل: تضيف القاعدة نقاطها عندما تنطبق. معطّل: تُتجاهل.',
              en: 'On: the rule adds its points when it matches. Off: it is ignored.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'rules.noLiabilityShift.score',
            label: {
              ar: 'النقاط',
              en: 'Points',
            },
            help: {
              ar: 'النقاط التي تضيفها القاعدة إلى درجة المخاطر عندما تنطبق (0 إلى 100). قارنها بدرجة المراجعة: النقاط التي تساويها أو تتجاوزها تحجز الحجز وحدها.',
              en: 'Points this rule adds to the risk score when it matches (0 to 100). Compare with the review score: points at or above it hold the booking on their own.',
            },
            type: 'integer',
            value: 30,
            default: 30,
            min: 0,
            max: 100,
            control: 'security',
            unit: 'score',
          },
        ],
      },
      {
        id: 'blocklists',
        title: {
          ar: 'قوائم الحظر',
          en: 'Block lists',
        },
        description: {
          ar: 'مقترح: حظر يدوي لنطاقات بريد ودول إصدار بطاقات معروفة بالاحتيال.',
          en: 'Proposed: manual blocks for known fraud e-mail domains and card issuing countries.',
        },
        fields: [
          {
            key: 'blocklist.emailDomains',
            label: {
              ar: 'نطاقات بريد محظورة',
              en: 'Blocked e-mail domains',
            },
            help: {
              ar: 'لا يُسمح بالدفع أو شحن المحفظة من حساب بريده في هذه النطاقات. لا توجد اليوم أي قائمة حظر يدوية.',
              en: 'No payment or top-up from an account whose e-mail is on these domains. No manual block list exists today.',
            },
            type: 'string-list',
            value: ['mailinator.com'],
            default: [],
            control: 'security',
            proposed: true,
            proposalId: 'S-14',
            priority: 'P1',
            needsBackend: true,
          },
          {
            key: 'blocklist.cardIssuerCountries',
            label: {
              ar: 'دول إصدار بطاقات للمراجعة',
              en: 'Card issuing countries to review',
            },
            help: {
              ar: 'بطاقة صادرة من هذه الدول تذهب دائمًا إلى مراجعة المخاطر، أيًّا كانت درجتها.',
              en: 'A card issued in these countries always goes to risk review, whatever its score.',
            },
            type: 'string-list',
            value: [],
            default: [],
            format: 'country',
            control: 'security',
            proposed: true,
            proposalId: 'S-15',
            priority: 'P1',
            needsBackend: true,
          },
        ],
      },
      {
        id: 'threeDs',
        title: {
          ar: 'التحقق 3-D Secure',
          en: '3-D Secure',
        },
        description: {
          ar: 'متى يُطلب 3-D Secure فتتحمل الجهة المصدرة المسؤولية.',
          en: 'When 3-D Secure is asked for, so the issuer carries the liability.',
        },
        fields: [
          {
            key: 'threeDs.mode',
            label: {
              ar: 'متى يُطلب',
              en: 'When to ask',
            },
            help: {
              ar: 'دائمًا: كل دفعة بطاقة تطلب 3-D Secure (الأكثر أمانًا، وخطوة إضافية للجميع). فوق مبلغ: فقط الدفعات ابتداءً من المبلغ أدناه. حسب المخاطر (الافتراضي): ابتداءً من المبلغ أدناه، وأيضًا تحته عندما تبلغ المخاطر المعروفة قبل الدفع (عنوان IP، الجهاز، تاريخ الرحلة، المبلغ، دولة IP) درجة المخاطر أدناه.',
              en: 'Always: every card payment asks for 3-D Secure (safest, one more step for everyone). Above amount: only payments from the amount below. Risk based (default): from the amount below, and also below it when the risk known before the payment (IP, device, trip date, amount, IP country) reaches the risk score below.',
            },
            type: 'enum',
            value: 'RISK_BASED',
            default: 'RISK_BASED',
            options: [
              {
                value: 'ALWAYS',
                label: {
                  ar: 'دائمًا',
                  en: 'Always',
                },
              },
              {
                value: 'ABOVE_AMOUNT',
                label: {
                  ar: 'فوق مبلغ',
                  en: 'Above an amount',
                },
              },
              {
                value: 'RISK_BASED',
                label: {
                  ar: 'حسب المخاطر',
                  en: 'Risk based',
                },
              },
            ],
            control: 'security',
            risk: 'high',
          },
          {
            key: 'threeDs.aboveUsd',
            label: {
              ar: 'ابتداءً من مبلغ (دولار)',
              en: 'From amount (USD)',
            },
            help: {
              ar: 'مبلغ الدفع بالدولار الأمريكي الذي يُطلب ابتداءً منه 3-D Secure (في وضعي «فوق مبلغ» و«حسب المخاطر»). 0 يعني كل دفعة. الافتراضي 300.',
              en: 'Payment amount in US dollars from which 3-D Secure is asked for (Above amount and Risk based). 0 means every payment. Default 300.',
            },
            type: 'money',
            value: 250,
            default: 300,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'security',
          },
          {
            key: 'threeDs.riskScore',
            label: {
              ar: 'درجة المخاطر التي تستدعيه',
              en: 'Risk score that asks for it',
            },
            help: {
              ar: 'في وضع «حسب المخاطر» فقط: الدفعة الأقل من المبلغ تطلب 3-D Secure أيضًا عندما تبلغ درجة مخاطرها المعروفة قبل الدفع هذه القيمة. الافتراضي 30.',
              en: 'Risk based only: a payment below the amount still asks for 3-D Secure when its risk score known before paying reaches this. Default 30.',
            },
            type: 'integer',
            value: 30,
            default: 30,
            min: 0,
            max: 1000,
            control: 'security',
            unit: 'score',
          },
        ],
      },
      {
        id: 'cardTesting',
        title: {
          ar: 'تجربة البطاقات',
          en: 'Card testing',
        },
        description: {
          ar: 'حدود الرفض لكل جلسة وحساب وعنوان IP، والحظر الذي يليها.',
          en: 'Decline limits per session, account and IP, and the block that follows.',
        },
        fields: [
          {
            key: 'cardTesting.enabled',
            label: {
              ar: 'عدّ الرفض والحظر',
              en: 'Count declines and block',
            },
            help: {
              ar: 'مفعّل (موصى به): تُعدّ محاولات الرفض وتُطبَّق الحدود أدناه. إن تعذّر الوصول إلى مخزن العدّ تُرفض دفعات البطاقة الجديدة مؤقتًا بدلًا من تمريرها دون عدّ. معطّل: لا حد لمحاولات الرفض.',
              en: 'On (recommended): declines are counted and the limits below apply. While the counter store is unreachable new card payments are refused (try again later) instead of being let through uncounted. Off: no limit on declined attempts.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
            risk: 'high',
          },
          {
            key: 'cardTesting.maxDeclinesPerSession',
            label: {
              ar: 'رفض لكل جلسة دفع',
              en: 'Declines per payment session',
            },
            help: {
              ar: 'بعد هذا العدد من البطاقات المرفوضة في جلسة دفع واحدة تُغلق الجلسة لدى البوابة ولا يمكن تجربة بطاقة أخرى فيها. الافتراضي 3.',
              en: 'After this many declined cards on one payment session the session is closed at the gateway: no other card can be tried on it. Default 3.',
            },
            type: 'integer',
            value: 3,
            default: 3,
            min: 1,
            max: 100,
            control: 'security',
          },
          {
            key: 'cardTesting.maxDeclinesPerAccount',
            label: {
              ar: 'رفض لكل حساب',
              en: 'Declines per account',
            },
            help: {
              ar: 'عدد مرات رفض حساب واحد (أو جلسة ضيف) خلال نافذة الحساب الذي بعده لا يستطيع فتح دفعة بطاقة طوال مدة الحظر. الافتراضي 5.',
              en: 'Declines of one account (or guest session) within the account window after which it cannot open a card payment for the block time. Default 5.',
            },
            type: 'integer',
            value: 5,
            default: 5,
            min: 1,
            max: 1000,
            control: 'security',
          },
          {
            key: 'cardTesting.accountWindowHours',
            label: {
              ar: 'نافذة الحساب (ساعات)',
              en: 'Account window (hours)',
            },
            help: {
              ar: 'عدد الساعات التي تُعدّ خلالها حالات رفض الحساب. الافتراضي 24.',
              en: 'Hours over which the declines of an account are counted. Default 24.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 720,
            control: 'security',
          },
          {
            key: 'cardTesting.maxDeclinesPerIp',
            label: {
              ar: 'رفض لكل عنوان IP',
              en: 'Declines per IP address',
            },
            help: {
              ar: 'عدد حالات الرفض من عنوان IP عام واحد خلال نافذة IP الذي بعده لا يمكنه فتح دفعة بطاقة طوال مدة الحظر. الافتراضي 10.',
              en: 'Declines from one public IP address within the IP window after which it cannot open a card payment for the block time. Default 10.',
            },
            type: 'integer',
            value: 10,
            default: 10,
            min: 1,
            max: 10000,
            control: 'security',
          },
          {
            key: 'cardTesting.ipWindowMinutes',
            label: {
              ar: 'نافذة IP (دقائق)',
              en: 'IP window (minutes)',
            },
            help: {
              ar: 'عدد الدقائق التي تُعدّ خلالها حالات رفض عنوان IP. الافتراضي 60.',
              en: 'Minutes over which the declines of an IP address are counted. Default 60.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 1,
            max: 1440,
            control: 'security',
          },
          {
            key: 'cardTesting.blockMinutes',
            label: {
              ar: 'مدة الحظر (دقائق)',
              en: 'Block time (minutes)',
            },
            help: {
              ar: 'المدة التي يبقى فيها الحساب أو عنوان IP ممنوعًا من دفعات البطاقة بعد بلوغ حده (يُطلب من العميل المحاولة لاحقًا). الافتراضي 60.',
              en: 'How long an account or IP address stays blocked from card payments after reaching its limit (the customer is told to try later). Default 60.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 1,
            max: 10080,
            control: 'security',
          },
          {
            key: 'cardTesting.waveDeclines',
            label: {
              ar: 'موجة على مستوى المنصة (رفض)',
              en: 'Platform-wide wave (declines)',
            },
            help: {
              ar: 'عدد حالات الرفض على مستوى المنصة كلها خلال نافذة الموجة التي ترسل تنبيه «اشتباه في تجربة بطاقات» إلى فريق التشغيل. الافتراضي 30.',
              en: 'Declines across the whole platform within the wave window that raise the "card testing suspected" alert to operations. Default 30.',
            },
            type: 'integer',
            value: 30,
            default: 30,
            min: 1,
            max: 1000000,
            control: 'security',
          },
          {
            key: 'cardTesting.waveWindowMinutes',
            label: {
              ar: 'نافذة الموجة (دقائق)',
              en: 'Wave window (minutes)',
            },
            help: {
              ar: 'عدد الدقائق التي تُعدّ خلالها حالات الرفض على مستوى المنصة. الافتراضي 10.',
              en: 'Minutes over which the platform-wide declines are counted. Default 10.',
            },
            type: 'duration',
            value: 10,
            default: 10,
            unit: 'minutes',
            min: 1,
            max: 1440,
            control: 'security',
          },
        ],
      },
    ],
  },
  {
    key: 'disputes',
    section: 'payments',
    icon: 'Gavel',
    title: {
      ar: 'نزاعات الدفع',
      en: 'Payment disputes',
    },
    summary: {
      ar: 'مواعيد النزاعات البنكية والتذكير وما يجمّده النزاع',
      en: 'Chargeback deadlines, reminders and what a dispute freezes',
    },
    description: {
      ar: 'كيف تتصرف المنصة عندما يفتح بنك حامل البطاقة نزاعًا (استردادًا بنكيًا) على دفعة: متى يُذكَّر فريق التشغيل بموعد الأدلة، والموعد الافتراضي، وهل تُجمَّد محفظة العميل ونقاطه أثناء النزاع وتُسحب النقاط عند خسارته. المفاتيح الثلاثة إعدادات مالية حساسة.',
      en: "How the platform reacts when a card holder's bank opens a dispute (chargeback) on a payment: when operations are reminded of the evidence deadline, the default deadline, and whether the customer's wallet and points are frozen while it runs and the points taken back when it is lost. The three switches are money controls.",
    },
    kind: 'server',
    inDashboard: true,
    approval: 'controls',
    version: 3,
    schemaVersion: 2,
    updatedAt: '2026-11-04T08:30:00.000Z',
    updatedBy: 'Omar Kaya',
    subsections: [
      {
        id: 'deadlines',
        title: {
          ar: 'المواعيد',
          en: 'Deadlines',
        },
        description: {
          ar: 'تذكير الفريق قبل موعد تقديم الأدلة.',
          en: 'Reminding the team before the evidence deadline.',
        },
        fields: [
          {
            key: 'reminderHoursBeforeDue',
            label: {
              ar: 'التذكير قبل الموعد (ساعات)',
              en: 'Reminder before the deadline (hours)',
            },
            help: {
              ar: 'كم ساعة قبل موعد الأدلة يصل تنبيه «النزاع مستحق قريبًا» إلى فريق التشغيل (مرة لكل نزاع). إن لم تصل الأدلة في الموعد يقرر البنك ضدنا تلقائيًا، لذا اترك هامش يوم عمل على الأقل. الافتراضي 48.',
              en: 'How many hours before the evidence deadline operations get the "dispute due soon" alert (once per dispute). Without evidence by the deadline the bank decides against us automatically, so keep at least one working day of margin. Default 48.',
            },
            type: 'duration',
            value: 72,
            default: 48,
            unit: 'hours',
            min: 1,
            max: 336,
          },
          {
            key: 'defaultEvidenceDays',
            label: {
              ar: 'الموعد الافتراضي (أيام)',
              en: 'Default deadline (days)',
            },
            help: {
              ar: 'عدد الأيام حتى موعد الأدلة عندما لا تحدده البوابة ولا الموظف. البنوك تمنح عادة من 7 إلى 21 يومًا؛ والتاريخ الذي ترسله البوابة يُقدَّم دائمًا. الافتراضي 7.',
              en: 'Days until the evidence deadline when neither the gateway nor the staff member gives one. Banks usually allow 7 to 21 days; a date from the gateway always wins. Default 7.',
            },
            type: 'duration',
            value: 7,
            default: 7,
            unit: 'days',
            min: 1,
            max: 60,
          },
        ],
      },
      {
        id: 'open',
        title: {
          ar: 'أثناء النزاع',
          en: 'While a dispute is open',
        },
        description: {
          ar: 'ما يُجمَّد حتى يُحسم النزاع.',
          en: 'What is frozen until the dispute is decided.',
        },
        fields: [
          {
            key: 'freezeWalletOnOpen',
            label: {
              ar: 'تجميد المحفظة ما دام النزاع مفتوحًا',
              en: 'Freeze the wallet while a dispute is open',
            },
            help: {
              ar: 'مفعّل (موصى به): ما دام النزاع جاريًا لا يمكن الصرف من محفظة العميل، فلا يُستهلك رصيد شُحن أو استُرد من البطاقة المتنازع عليها (والإضافات تصل كالمعتاد). يُفك التجميد عند كسب النزاع وعدم وجود نزاع آخر مفتوح للعميل. بعد خسارة النزاع أو قبوله تبقى المحفظة مجمّدة حتى يفك الموظفون تجميدها. والمحفظة التي جمّدها موظف من قبل لا يفكها النزاع أبدًا. معطّل: تبقى المحفظة قابلة للاستخدام. إعداد مالي حساس: تغييره يحتاج صلاحية الضوابط.',
              en: "On (recommended): while a dispute runs, the customer's wallet cannot be spent, so store credit bought or refunded from the disputed card cannot be used up (credits still land). It is released when the dispute is won and no other dispute of the customer is open. After a lost or accepted dispute the wallet stays frozen until staff unfreeze it. A wallet staff froze earlier is never released by a dispute. Off: the wallet stays usable. Money control: changing it needs the controls permission.",
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
          },
          {
            key: 'freezePointsOnOpen',
            label: {
              ar: 'تجميد النقاط ما دام النزاع مفتوحًا',
              en: 'Freeze the points while a dispute is open',
            },
            help: {
              ar: 'مفعّل (موصى به): لا يستطيع العميل استبدال نقاط الولاء ما دام هناك نزاع مفتوح (يظهر له «النقاط مجمّدة») حتى يُكسب النزاع أو يُغلق. معطّل: تبقى النقاط قابلة للاستبدال. إعداد مالي حساس.',
              en: 'On (recommended): the customer cannot redeem loyalty points while a dispute is open (the website gets "points frozen") until it is won or closed. Off: points stay redeemable. Money control.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
          },
        ],
      },
      {
        id: 'lost',
        title: {
          ar: 'عند خسارة النزاع',
          en: 'When a dispute is lost',
        },
        description: {
          ar: 'ما يُستعاد من العميل.',
          en: 'What is taken back from the customer.',
        },
        fields: [
          {
            key: 'reversePointsOnLost',
            label: {
              ar: 'سحب النقاط عند خسارة النزاع',
              en: 'Take the points back when a dispute is lost',
            },
            help: {
              ar: 'مفعّل (موصى به): عند خسارة النزاع أو قبوله تُسحب كل النقاط المكتسبة من حجزه (ما لم يُستبدل منها فقط). معطّل: يحتفظ العميل بنقاط حجز استرده البنك. إعداد مالي حساس.',
              en: 'On (recommended): when a dispute is lost or accepted, every point earned on its booking is taken back (only what is still unredeemed). Off: the customer keeps the points of a booking the bank refunded. Money control.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'money',
          },
          {
            key: 'debitWalletOnLostTopUp',
            label: {
              ar: 'استرجاع الشحن الخاسر من المحفظة',
              en: 'Take a lost top-up back from the wallet',
            },
            help: {
              ar: 'عند خسارة نزاع على شحن محفظة أو قبوله، يُسحب المبلغ المتنازع عليه (بالدولار كما أضافه الشحن) من محفظة العميل تلقائيًا، من نقدي الشحن أولًا، وبحد أقصى المتاح ودون النزول تحت الصفر. معطّل (الافتراضي): لا يُسحب شيء ويراجع الموظفون المحفظة المجمّدة يدويًا. إعداد مالي حساس.',
              en: "When a dispute on a wallet top-up is lost or accepted, the disputed amount (in USD, as the top-up credited it) is taken back from the customer's wallet automatically, top-up cash first, at most what is available and never below zero. Off (default): nothing is taken; staff review the frozen wallet by hand. Money control.",
            },
            type: 'boolean',
            value: false,
            default: false,
            control: 'money',
            risk: 'high',
          },
        ],
      },
    ],
  },
];

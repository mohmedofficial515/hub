// Settings groups of the "flights" section.
// Generated from the backend groups (src/modules/settings/groups) and the dashboard dictionaries; see audit.md
// in dashboard/settings. Fields with `proposed: true` are NOT in the real API (audit proposals, P0/P1).

import type { SettingsGroup } from '../types';

export const FLIGHT_GROUPS: SettingsGroup[] = [
  {
    key: 'flights',
    section: 'flights',
    icon: 'Plane',
    title: {
      ar: 'الطيران',
      en: 'Flights',
    },
    summary: {
      ar: 'مهل الدفع وحدود البحث',
      en: 'Checkout timings and search limits',
    },
    description: {
      ar: 'مهل الدفع في حجوزات الطيران، وهامش تغيّر السعر، والتغييرات التي تجريها شركات الطيران، وحدود البحث (إعدادات الحجز المؤقت والإلغاء والتغيير ضمن مورّد الطيران).',
      en: 'Flight checkout timings, price tolerance, airline-initiated changes and search limits (hold, cancellation and change settings are under Flight supplier).',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 10,
    schemaVersion: 4,
    updatedAt: '2026-11-14T09:25:00.000Z',
    updatedBy: 'Khaled Nasser',
    subsections: [
      {
        id: 'checkout',
        title: {
          ar: 'مهل الدفع',
          en: 'Checkout timings',
        },
        description: {
          ar: 'مدة تثبيت السعر وصلاحية جلسة الدفع.',
          en: 'How long a price is held and a checkout stays open.',
        },
        fields: [
          {
            key: 'priceLockMinutes',
            label: {
              ar: 'تثبيت السعر (دقائق)',
              en: 'Price lock (minutes)',
            },
            help: {
              ar: 'عدد الدقائق التي يُضمن فيها سعر العرض المختار بعد إعادة تسعيره عند بدء الدفع.',
              en: 'Minutes a selected offer price is guaranteed after it is re-priced at the start of checkout.',
            },
            type: 'duration',
            value: 15,
            default: 15,
            unit: 'minutes',
            min: 0,
            max: 525600,
          },
          {
            key: 'checkoutTtlMinutes',
            label: {
              ar: 'مدة الدفع (دقائق)',
              en: 'Checkout lifetime (minutes)',
            },
            help: {
              ar: 'عدد الدقائق التي تبقى فيها عملية الدفع (مسودة الحجز) مفتوحة قبل انتهائها.',
              en: 'Minutes a checkout (draft booking) stays open before it expires.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'minutes',
            min: 0,
            max: 525600,
          },
          {
            key: 'bookingCutoffMinutes',
            label: {
              ar: 'أقرب موعد للحجز قبل الإقلاع',
              en: 'Booking cut-off before departure',
            },
            help: {
              ar: 'يُرفض الحجز الفوري لرحلة تقلع خلال هذه المدة، لأن إصدار التذكرة قد لا يتم في الوقت. اليوم لا يوجد أي حد (قاعدة «السفر في اليوم نفسه» ترفع درجة المخاطر فقط).',
              en: 'An instant booking of a flight leaving within this time is refused, because the ticket may not be issued in time. Today there is no limit (the same-day travel fraud rule only adds to the score).',
            },
            type: 'duration',
            value: 120,
            default: 120,
            unit: 'minutes',
            min: 0,
            max: 1440,
            risk: 'high',
            proposed: true,
            proposalId: 'S-23',
            priority: 'P1',
            needsBackend: true,
          },
        ],
      },
      {
        id: 'price',
        title: {
          ar: 'تغيّر السعر',
          en: 'Price changes',
        },
        description: {
          ar: 'ما نتحمله من زيادة السعر عند إعادة التسعير قبل الطلب.',
          en: 'What we absorb when the supplier price rises at the final re-price.',
        },
        fields: [
          {
            key: 'priceChangeToleranceUsd',
            label: {
              ar: 'هامش تغيّر السعر بعد الدفع (USD)',
              en: 'Price change tolerance after payment (USD)',
            },
            help: {
              ar: 'قبل إنشاء طلب شركة الطيران مباشرةً يُسعَّر الحجز من جديد. إن طلبت الشركة أكثر مما دفعه العميل، نتحمّل الزيادة حتى هذا المبلغ ويُؤكَّد الحجز؛ والزيادة الأكبر تُفشل الحجز ويُسترد للعميل. تُحوَّل الزيادة دائمًا إلى الدولار الأمريكي بسعر الصرف المثبّت على الحجز، أيًّا كانت العملة التي دفع بها العميل، فالقيمة 5 تعني 5 دولارات لكل عميل. الافتراضي 5، والقيمة 0 لا تتحمّل شيئًا.',
              en: 'Right before the airline order is created the fare is priced again. If the airline now asks for more than the customer paid, an increase up to this amount is absorbed by us and the booking is confirmed; a larger increase fails the booking and the customer is refunded. The increase is always converted to US dollars at the exchange rate locked on the booking, whatever currency the customer paid in, so 5 means 5 USD for every customer. Default 5; 0 absorbs nothing.',
            },
            type: 'money',
            value: 5,
            default: 5,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'money',
          },
        ],
      },
      {
        id: 'aic',
        title: {
          ar: 'تغييرات شركة الطيران',
          en: 'Airline schedule changes',
        },
        description: {
          ar: 'قبول التغييرات البسيطة تلقائيًا.',
          en: 'Accepting minor changes automatically.',
        },
        fields: [
          {
            key: 'autoAcceptMinorAic',
            label: {
              ar: 'قبول تغييرات شركة الطيران البسيطة',
              en: 'Accept minor airline changes',
            },
            help: {
              ar: 'قبول تغييرات الجدول التي تجريها شركة الطيران تلقائيًا إذا كانت دون حد التغيير البسيط (تغيير الوقت فقط).',
              en: 'Accept airline schedule changes below the minor threshold automatically (time shifts only).',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'minorAicThresholdMinutes',
            label: {
              ar: 'حد التغيير البسيط (دقائق)',
              en: 'Minor change threshold (minutes)',
            },
            help: {
              ar: 'تغييرات الجدول حتى هذا العدد من الدقائق تُعد بسيطة.',
              en: 'Schedule changes up to this many minutes count as minor.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 0,
            max: 525600,
          },
        ],
      },
      {
        id: 'search',
        title: {
          ar: 'البحث',
          en: 'Search',
        },
        description: {
          ar: 'حدود الركاب والدرجات والنتائج.',
          en: 'Passenger, cabin and result limits.',
        },
        fields: [
          {
            key: 'maxPassengers',
            label: {
              ar: 'أقصى عدد من المسافرين',
              en: 'Most passengers',
            },
            help: {
              ar: 'أقصى عدد من المسافرين في البحث أو الحجز الواحد.',
              en: 'Most passengers per search or booking.',
            },
            type: 'integer',
            value: 9,
            default: 9,
            min: 1,
            max: 9,
          },
          {
            key: 'maxInfantsPerAdult',
            label: {
              ar: 'الرضّع لكل بالغ',
              en: 'Infants per adult',
            },
            help: {
              ar: 'عدد الرضّع المسموح به لكل بالغ.',
              en: 'Infants allowed per adult.',
            },
            type: 'integer',
            value: 1,
            default: 1,
            min: 0,
            max: 1,
          },
          {
            key: 'allowedCabinClasses',
            label: {
              ar: 'درجات المقصورة',
              en: 'Cabin classes',
            },
            help: {
              ar: 'درجات المقصورة المتاحة في البحث.',
              en: 'Cabin classes offered in search.',
            },
            type: 'multi-enum',
            value: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'],
            default: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'],
            options: [
              {
                value: 'ECONOMY',
                label: {
                  ar: 'السياحية',
                  en: 'Economy',
                },
              },
              {
                value: 'PREMIUM_ECONOMY',
                label: {
                  ar: 'السياحية المميزة',
                  en: 'Premium economy',
                },
              },
              {
                value: 'BUSINESS',
                label: {
                  ar: 'رجال الأعمال',
                  en: 'Business',
                },
              },
              {
                value: 'FIRST',
                label: {
                  ar: 'الأولى',
                  en: 'First',
                },
              },
            ],
          },
          {
            key: 'searchResultsLimit',
            label: {
              ar: 'النتائج لكل بحث',
              en: 'Results per search',
            },
            help: {
              ar: 'أقصى عدد من العروض في كل بحث بعد التسعير.',
              en: 'Most offers returned per search after pricing.',
            },
            type: 'integer',
            value: 150,
            default: 200,
            min: 10,
            max: 500,
          },
        ],
      },
      {
        id: 'calendar',
        title: {
          ar: 'تقويم الأسعار',
          en: 'Fare calendar',
        },
        description: {
          ar: 'أرخص سعر ذهاب لكل يوم، مع حدود البحث الحي.',
          en: 'Cheapest one-way price per day, with limits on live searches.',
        },
        fields: [
          {
            key: 'fareCalendar.enabled',
            label: {
              ar: 'تشغيل تقويم الأسعار',
              en: 'Fare calendar on',
            },
            help: {
              ar: 'يقدّم تقويم الأسعار؛ عند الإيقاف يُجيب الطلب بـ 404.',
              en: 'Serve the fare calendar; off answers 404.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'fareCalendar.reuseIdenticalSearches',
            label: {
              ar: 'إعادة استخدام البحث المطابق',
              en: 'Reuse identical searches',
            },
            help: {
              ar: 'يُجاب البحث المكرر من النسخة المخزنة إن لم تتجاوز مدة الحداثة.',
              en: 'A repeated identical search is answered from the cached one while it is fresh.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'fareCalendar.freshnessSeconds',
            label: {
              ar: 'مدة الحداثة',
              en: 'Freshness',
            },
            help: {
              ar: 'العمر الذي يُعدّ فيه البحث المخزن سعرًا حيًّا.',
              en: 'Age up to which a cached search is shown as a live price.',
            },
            type: 'duration',
            value: 600,
            default: 600,
            unit: 'seconds',
            min: 60,
            max: 1800,
          },
          {
            key: 'fareCalendar.liveProbeDays',
            label: {
              ar: 'أيام البحث الحي حول التاريخ',
              en: 'Live probe days',
            },
            help: {
              ar: 'أيام قبل التاريخ المختار وبعده يُبحث فيها مباشرة لدى المورّد (0 = اليوم المختار فقط).',
              en: 'Days before and after the chosen date searched live at the supplier (0 = the chosen day only).',
            },
            type: 'duration',
            value: 3,
            default: 3,
            unit: 'days',
            min: 0,
            max: 7,
          },
          {
            key: 'fareCalendar.maxProbesPerMinute',
            label: {
              ar: 'بحث التقويم في الدقيقة (للمنصة)',
              en: 'Calendar searches per minute (platform)',
            },
            help: {
              ar: 'عمليات بحث التقويم لدى المورّد في الدقيقة لكل المنصة (0 = لا شيء).',
              en: 'Calendar supplier searches per minute across the platform (0 = none).',
            },
            type: 'integer',
            value: 60,
            default: 60,
            min: 0,
            max: 600,
          },
          {
            key: 'fareCalendar.probesPerVisitor',
            label: {
              ar: 'بحث التقويم لكل زائر',
              en: 'Calendar searches per visitor',
            },
            help: {
              ar: 'عمليات بحث التقويم المسموحة لكل زائر في النافذة.',
              en: 'Calendar supplier searches allowed per visitor per window.',
            },
            type: 'integer',
            value: 14,
            default: 14,
            min: 0,
            max: 100,
          },
          {
            key: 'fareCalendar.probeWindowMinutes',
            label: {
              ar: 'نافذة الزائر',
              en: 'Visitor window',
            },
            help: {
              ar: 'طول نافذة حدّ الزائر بالدقائق.',
              en: 'Length of the per-visitor window in minutes.',
            },
            type: 'duration',
            value: 10,
            default: 10,
            unit: 'minutes',
            min: 1,
            max: 60,
          },
          {
            key: 'fareCalendar.recentMaxAgeHours',
            label: {
              ar: 'أقدم سعر «حديث»',
              en: 'Oldest "recent" price',
            },
            help: {
              ar: 'أقدم بحث سابق يُعرض سعره كسعر حديث.',
              en: 'Oldest past search whose price is shown as a recent price.',
            },
            type: 'duration',
            value: 6,
            default: 6,
            unit: 'hours',
            min: 1,
            max: 48,
          },
        ],
      },
    ],
  },
  {
    key: 'flight_provider',
    section: 'flights',
    icon: 'PlugZap',
    title: {
      ar: 'مورّد الطيران',
      en: 'Flight supplier',
    },
    summary: {
      ar: 'مفاتيح المورّد وسياساته',
      en: 'Supplier switches and policies',
    },
    description: {
      ar: 'التحكم في مورّد الطيران: مفاتيح الإيقاف، وقاطع الدائرة، والتغطية، وسياسات الحجز المؤقت والإلغاء والتغيير، ومفاتيح القدرات.',
      en: 'Flight supplier control: kill switches, circuit breaker, coverage, hold, cancellation and change policies, and capability toggles.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 34,
    schemaVersion: 6,
    updatedAt: '2026-11-17T22:10:00.000Z',
    updatedBy: 'Khaled Nasser',
    notes: {
      ar: 'التسامح مع تغيّر السعر يُضبط في «الطيران». تنبيه انخفاض الرصيد هنا قديم: الرصيد يُراقب في «حراس المورد والكلفة».',
      en: 'The price tolerance lives in Flights. The low-balance alert here is legacy: the balance is watched in Supplier and cost guards.',
    },
    subsections: [
      {
        id: 'switches',
        title: {
          ar: 'مفاتيح الإيقاف والرسائل',
          en: 'Kill switches & messages',
        },
        description: {
          ar: 'إيقاف البحث أو الحجز أو العمليات بعد الحجز فورًا.',
          en: 'Stop search, booking or post-booking operations at once.',
        },
        fields: [
          {
            key: 'searchEnabled',
            label: {
              ar: 'البحث عن الرحلات',
              en: 'Flight search',
            },
            help: {
              ar: 'المفتاح الرئيسي للبحث عن الرحلات.',
              en: 'Master switch for flight search.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'bookingEnabled',
            label: {
              ar: 'حجز الرحلات',
              en: 'Flight booking',
            },
            help: {
              ar: 'المفتاح الرئيسي لإنشاء طلبات الطيران.',
              en: 'Master switch for creating flight orders.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'postBookingEnabled',
            label: {
              ar: 'العمليات بعد الحجز',
              en: 'After-booking operations',
            },
            help: {
              ar: 'المفتاح الرئيسي لعمليات ما بعد الحجز (الإلغاء والتغيير والإضافات).',
              en: 'Master switch for operations after booking (cancel, change, extras).',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'searchDisabledMessage.ar',
            label: {
              ar: 'العربية',
              en: 'Arabic',
            },
            help: {
              ar: 'النص بالعربية. أوقفه لاستخدام النص الإنجليزي.',
              en: 'Arabic text. Switch it off to use the English text.',
            },
            type: 'string',
            value: null,
            default: null,
            nullable: true,
            max: 500,
          },
          {
            key: 'searchDisabledMessage.en',
            label: {
              ar: 'الإنجليزية',
              en: 'English',
            },
            help: {
              ar: 'النص بالإنجليزية (مطلوب).',
              en: 'English text (required).',
            },
            type: 'string',
            value: null,
            default: null,
            nullable: true,
            max: 500,
          },
          {
            key: 'bookingDisabledMessage.ar',
            label: {
              ar: 'العربية',
              en: 'Arabic',
            },
            help: {
              ar: 'النص بالعربية. أوقفه لاستخدام النص الإنجليزي.',
              en: 'Arabic text. Switch it off to use the English text.',
            },
            type: 'string',
            value: null,
            default: null,
            nullable: true,
            max: 500,
          },
          {
            key: 'bookingDisabledMessage.en',
            label: {
              ar: 'الإنجليزية',
              en: 'English',
            },
            help: {
              ar: 'النص بالإنجليزية (مطلوب).',
              en: 'English text (required).',
            },
            type: 'string',
            value: null,
            default: null,
            nullable: true,
            max: 500,
          },
        ],
      },
      {
        id: 'connection',
        title: {
          ar: 'الاتصال بالمورّد',
          en: 'Supplier connection',
        },
        description: {
          ar: 'المهل وقاطع الدائرة والـ webhooks.',
          en: 'Timeouts, circuit breaker and webhooks.',
        },
        fields: [
          {
            key: 'supplierTimeoutMs',
            label: {
              ar: 'مهلة المورّد (ملّي ثانية)',
              en: 'Supplier timeout (ms)',
            },
            help: {
              ar: 'المهلة بالملّي ثانية لاستدعاء واحد للمورّد قبل اعتباره منتهي المهلة.',
              en: 'Time limit in milliseconds of one supplier call before it counts as a timeout.',
            },
            type: 'duration',
            value: 15000,
            default: 15000,
            unit: 'ms',
            min: 2000,
            max: 60000,
          },
          {
            key: 'supplierTimeouts.priceMs',
            label: {
              ar: 'مهلة إعادة التسعير (ملّي ثانية)',
              en: 'Re-pricing timeout (ms)',
            },
            help: {
              ar: 'المهلة بالملّي ثانية للتحقق الأخير من السعر قبل إنشاء الحجز مباشرة. عند انتهاء المهلة يُعاد المحاولة مرة واحدة فورًا.',
              en: 'Time limit in milliseconds of the final price check right before the order is placed. A timeout is retried once at once.',
            },
            type: 'duration',
            value: 8000,
            default: 8000,
            unit: 'ms',
            min: 2000,
            max: 60000,
          },
          {
            key: 'defaultMaxConnections',
            label: {
              ar: 'الحد الافتراضي للتوقفات',
              en: 'Default stops limit',
            },
            help: {
              ar: 'حد التوقفات للبحث الذي لا يحدد حدًا. أوقفه لإلغاء الحد.',
              en: 'Stops limit of a search that sets none. Switch it off for no limit.',
            },
            type: 'integer',
            value: null,
            default: null,
            nullable: true,
            min: 0,
            max: 2,
          },
          {
            key: 'circuitBreaker.enabled',
            label: {
              ar: 'مفعّل',
              en: 'Enabled',
            },
            help: {
              ar: 'فتح القاطع بعد إخفاقات المورّد المتكررة.',
              en: 'Trip the breaker after repeated supplier failures.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'circuitBreaker.failureThreshold',
            label: {
              ar: 'الإخفاقات اللازمة للفتح',
              en: 'Failures to open',
            },
            help: {
              ar: 'عدد الإخفاقات خلال النافذة الزمنية التي تفتح القاطع.',
              en: 'Failures inside the window that open the breaker.',
            },
            type: 'integer',
            value: 5,
            default: 5,
            min: 1,
            max: 1000,
          },
          {
            key: 'circuitBreaker.windowSeconds',
            label: {
              ar: 'النافذة (ثوانٍ)',
              en: 'Window (seconds)',
            },
            help: {
              ar: 'النافذة الزمنية المتحركة التي تُحتسب خلالها الإخفاقات.',
              en: 'Rolling window the failures are counted over.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'seconds',
            min: 5,
            max: 3600,
          },
          {
            key: 'circuitBreaker.openSeconds',
            label: {
              ar: 'مدة الفتح (ثوانٍ)',
              en: 'Open for (seconds)',
            },
            help: {
              ar: 'عدد الثواني التي يبقى فيها القاطع مفتوحًا قبل السماح باستدعاء تجريبي.',
              en: 'Seconds the breaker stays open before a trial call is allowed.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'seconds',
            min: 1,
            max: 3600,
          },
          {
            key: 'circuitBreaker.halfOpenMaxCalls',
            label: {
              ar: 'الاستدعاءات التجريبية',
              en: 'Trial calls',
            },
            help: {
              ar: 'عدد الاستدعاءات التجريبية المسموح بها في حالة نصف الفتح قبل أن يقرر القاطع.',
              en: 'Trial calls allowed while half open before the breaker decides.',
            },
            type: 'integer',
            value: 1,
            default: 1,
            min: 1,
            max: 100,
          },
          {
            key: 'circuitBreaker.countTimeouts',
            label: {
              ar: 'احتساب انتهاء المهلة',
              en: 'Count timeouts',
            },
            help: {
              ar: 'احتساب انتهاء مهلة المورّد إخفاقًا.',
              en: 'Count supplier timeouts as failures.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'circuitBreaker.countServerErrors',
            label: {
              ar: 'احتساب أخطاء الخادم',
              en: 'Count server errors',
            },
            help: {
              ar: 'احتساب ردود المورّد 5xx إخفاقًا.',
              en: 'Count supplier 5xx responses as failures.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'circuitBreaker.countRateLimits',
            label: {
              ar: 'احتساب تجاوز حد الطلبات',
              en: 'Count rate limits',
            },
            help: {
              ar: 'احتساب ردود 429 إخفاقًا (عند الإيقاف: التمهّل دون فتح القاطع).',
              en: 'Count 429 responses as failures (off: slow down without opening the breaker).',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'webhookEvents',
            label: {
              ar: 'أحداث المورّد',
              en: 'Supplier events',
            },
            help: {
              ar: 'أحداث إشعارات المورّد (webhook) التي نشترك فيها. القائمة الفارغة تعني لا شيء.',
              en: 'Supplier webhook events we subscribe to. An empty list means none.',
            },
            type: 'string-list',
            value: [
              'order.created',
              'order.creation_failed',
              'order.airline_initiated_change_detected',
              'order_cancellation.created',
              'order_cancellation.confirmed',
              'air.order.changed',
              'air.payment.succeeded',
              'air.payment.pending',
              'air.payment.failed',
              'air.payment.cancelled',
              'air.airline_credit.created',
              'air.airline_credit.spent',
              'air.airline_credit.invalidated',
            ],
            default: [
              'order.created',
              'order.creation_failed',
              'order.airline_initiated_change_detected',
              'order_cancellation.created',
              'order_cancellation.confirmed',
              'air.order.changed',
              'air.payment.succeeded',
              'air.payment.pending',
              'air.payment.failed',
              'air.payment.cancelled',
              'air.airline_credit.created',
              'air.airline_credit.spent',
              'air.airline_credit.invalidated',
            ],
            advanced: true,
            max: 50,
          },
        ],
      },
      {
        id: 'coverage',
        title: {
          ar: 'التغطية',
          en: 'Coverage',
        },
        description: {
          ar: 'شركات الطيران والمسارات والدول التي نبيعها، والأسعار الخاصة.',
          en: 'Airlines, routes and countries we sell, and private fares.',
        },
        fields: [
          {
            key: 'excludedAirlines',
            label: {
              ar: 'شركات الطيران المستبعدة',
              en: 'Excluded airlines',
            },
            help: {
              ar: 'شركات طيران لا تُعرض أبدًا، وتُحذف عروضها من النتائج.',
              en: 'Airlines never offered. Their offers are dropped from the results.',
            },
            type: 'string-list',
            value: ['W6', 'FR'],
            default: [],
            format: 'iata',
            max: 500,
          },
          {
            key: 'allowedAirlines',
            label: {
              ar: 'شركات الطيران المسموح بها',
              en: 'Allowed airlines',
            },
            help: {
              ar: 'تُعرض هذه الشركات فقط. القائمة الفارغة تعني كل الشركات عدا المستبعدة.',
              en: 'Only these airlines are offered. An empty list means every airline except the excluded ones.',
            },
            type: 'string-list',
            value: [],
            default: [],
            format: 'iata',
            max: 500,
          },
          {
            key: 'excludedRoutes',
            label: {
              ar: 'المسارات المستبعدة',
              en: 'Excluded routes',
            },
            help: {
              ar: 'أزواج المنشأ والوجهة التي لا نبيعها ("*" تطابق أي طرف).',
              en: 'Origin and destination pairs we do not sell ("*" matches any side).',
            },
            type: 'string-list',
            value: ['SAW → ESB'],
            default: [],
            structured: true,
            max: 500,
          },
          {
            key: 'allowedOriginCountries',
            label: {
              ar: 'دول المنشأ المسموح بها',
              en: 'Allowed origin countries',
            },
            help: {
              ar: 'دول المنشأ المسموح بها فقط. القائمة الفارغة تعني كل الدول.',
              en: 'Only these origin countries. An empty list means every country.',
            },
            type: 'string-list',
            value: [],
            default: [],
            format: 'country',
            max: 300,
          },
          {
            key: 'allowedDestinationCountries',
            label: {
              ar: 'دول الوجهة المسموح بها',
              en: 'Allowed destination countries',
            },
            help: {
              ar: 'دول الوجهة المسموح بها فقط. القائمة الفارغة تعني كل الدول.',
              en: 'Only these destination countries. An empty list means every country.',
            },
            type: 'string-list',
            value: [],
            default: [],
            format: 'country',
            max: 300,
          },
          {
            key: 'privateFares',
            label: {
              ar: 'الأسعار الخاصة',
              en: 'Private fares',
            },
            help: {
              ar: 'بيانات الأسعار المتفاوض عليها لكل شركة طيران (رمز IATA وإدخالاته).',
              en: 'Negotiated fare credentials per airline (IATA code to its entries).',
            },
            type: 'string-list',
            value: ['TK · رمز شركة ••••01'],
            default: [],
            structured: true,
          },
        ],
      },
      {
        id: 'holds',
        title: {
          ar: 'الحجز المؤقت',
          en: 'Holds',
        },
        description: {
          ar: '«احجز الآن وادفع لاحقًا» والحجز الصامت قبل الخصم.',
          en: '"Hold now, pay later" and the silent hold before charging.',
        },
        fields: [
          {
            key: 'holdPolicy.enabled',
            label: {
              ar: 'الحجز المؤقت',
              en: 'Holds',
            },
            help: {
              ar: 'إتاحة طلبات "احجز الآن وادفع لاحقًا" عندما يسمح المورّد بذلك.',
              en: 'Offer "hold now, pay later" orders when the supplier allows it.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'holdPolicy.maxHoldHours',
            label: {
              ar: 'أطول حجز مؤقت (ساعات)',
              en: 'Longest hold (hours)',
            },
            help: {
              ar: 'الحد الأعلى لمدة الحجز المؤقت، وتبقى مهلة المورّد هي المعتمدة إن كانت أقصر.',
              en: 'Upper limit of a hold. A shorter supplier deadline still wins.',
            },
            type: 'duration',
            value: 48,
            default: 72,
            unit: 'hours',
            min: 1,
            max: 336,
          },
          {
            key: 'holdPolicy.requireVerifiedPhone',
            label: {
              ar: 'يلزم هاتف موثّق',
              en: 'Verified phone needed',
            },
            help: {
              ar: 'لا يمكن الحجز المؤقت إلا للعملاء الذين لديهم رقم هاتف موثّق.',
              en: 'Only customers with a verified phone number may place a hold.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'holdPolicy.requireAuthenticatedUser',
            label: {
              ar: 'للعملاء المسجّلين فقط',
              en: 'Signed-in customers only',
            },
            help: {
              ar: 'لا يمكن للضيوف الحجز المؤقت.',
              en: 'Guests cannot place holds.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'holdPolicy.maxActiveHoldsPerUser',
            label: {
              ar: 'الحجوزات المؤقتة النشطة لكل عميل',
              en: 'Active holds per customer',
            },
            help: {
              ar: 'عدد الحجوزات المؤقتة غير المدفوعة المسموح بها للعميل في الوقت نفسه.',
              en: 'Unpaid holds one customer may have at the same time.',
            },
            type: 'integer',
            value: 3,
            default: 3,
            min: 1,
            max: 50,
          },
          {
            key: 'holdPolicy.autoCancelOnExpiry',
            label: {
              ar: 'الإلغاء عند الانتهاء',
              en: 'Cancel on expiry',
            },
            help: {
              ar: 'إلغاء الطلب لدى المورّد تلقائيًا عند انتهاء الحجز المؤقت دون دفع.',
              en: 'Cancel the order at the supplier automatically when the hold expires unpaid.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'holdPolicy.paymentCutoffMinutes',
            label: {
              ar: 'آخر موعد للدفع (دقائق)',
              en: 'Payment cut-off (minutes)',
            },
            help: {
              ar: 'عدد الدقائق قبل مهلة المورّد التي يُرفض بعدها دفع ثمن الحجز المؤقت.',
              en: 'Minutes before the supplier hold deadline after which payment for a held order is refused.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'minutes',
            min: 0,
            max: 525600,
          },
          {
            key: 'holdPolicy.reminderOffsetsHours',
            label: {
              ar: 'التذكيرات (ساعات قبل)',
              en: 'Reminders (hours before)',
            },
            help: {
              ar: 'الساعات السابقة لمهلة الحجز المؤقت التي تُرسل فيها التذكيرات (الأكبر أولًا).',
              en: 'Hours before the hold deadline when reminders are sent (largest first).',
            },
            type: 'string-list',
            value: [24, 6, 1],
            default: [24, 6, 1],
            itemType: 'integer',
            itemUnit: 'hours',
            max: 10,
          },
          {
            key: 'holdPolicy.servicesOnHold',
            label: {
              ar: 'الأمتعة بعد دفع الحجز المؤقت',
              en: 'Bags after a hold is paid',
            },
            help: {
              ar: 'حين لا تُرسل الأمتعة مع الحجز المؤقت (خيار "الأمتعة مع الحجز المؤقت" متوقف، أو رفضتها شركة الطيران)، اسمح بها على الحجز المؤقت مع ذلك واشترها فور دفعه. إن رفضتها شركة الطيران حينها، تُفتح حالة إضافة متعثرة. لا يُسمح بالمقاعد والوجبات في الحجز المؤقت أبدًا.',
              en: 'When bags are not sent with the hold ("Bags with the hold" off, or the airline refused them), still allow them on a held booking and buy them right after the hold is paid. If the airline refuses them then, a failed-extra case opens. Seats and meals are never allowed on a hold.',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'holdPolicy.bagsWithHold',
            label: {
              ar: 'الأمتعة مع الحجز المؤقت',
              en: 'Bags with the hold',
            },
            help: {
              ar: 'إرسال الأمتعة التي اختارها العميل مع طلب الحجز المؤقت نفسه، فتحتفظ بها شركة الطيران مع المقاعد المحجوزة وتُدفع مع الحجز. إن رفضت شركة الطيران حجزًا مؤقتًا يحمل أمتعة، يُثبَّت الحجز من جديد دونها (يُسجَّل ذلك على الحجز ويُنبَّه الموظفون لإبلاغ العميل)، ثم تتبع الأمتعة خيار "الأمتعة بعد دفع الحجز المؤقت". لا تُرسل المقاعد والوجبات مع الحجز المؤقت أبدًا. مفعّل افتراضيًا.',
              en: 'Send the bags the customer chose with the hold order itself, so the airline keeps them with the held seats and they are paid with the hold. If the airline refuses a hold carrying bags, the hold is placed again without them (recorded on the booking, and staff are told to inform the customer); the bags then follow "Bags after a hold is paid". Seats and meals are never sent with a hold. On by default.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'holdPolicy.default',
            label: {
              ar: 'القرار الافتراضي',
              en: 'Default decision',
            },
            help: {
              ar: 'القرار المطبَّق عندما لا تطابق أي قاعدة.',
              en: 'Decision applied when no rule matches.',
            },
            type: 'enum',
            value: 'allow',
            default: 'allow',
            options: [
              {
                value: 'allow',
                label: {
                  ar: 'سماح',
                  en: 'Allow',
                },
              },
              {
                value: 'deny',
                label: {
                  ar: 'رفض',
                  en: 'Deny',
                },
              },
            ],
          },
          {
            key: 'holdPolicy.rules',
            label: {
              ar: 'القواعد',
              en: 'Rules',
            },
            help: {
              ar: 'تُطبَّق أول قاعدة مفعّلة (حسب الأولوية تصاعديًا) تتحقق كل شروطها.',
              en: 'The first enabled rule (by ascending priority) whose conditions all match wins.',
            },
            type: 'string-list',
            value: ['10 · شركات منخفضة التكلفة ← رفض'],
            default: [],
            structured: true,
          },
          {
            key: 'preChargeHold.enabled',
            label: {
              ar: 'حجز المقعد قبل الخصم',
              en: 'Hold the seat before charging',
            },
            help: {
              ar: 'يحجز الأجرة عند شركة الطيران (دون أن يراه العميل) قبل الدفع، فلا يدفع العميل أبدًا ثمن أجرة ترفضها الشركة. متوقف افتراضيًا: يُخصم المبلغ من العميل أولًا ثم يُنشأ الحجز كما كان سابقًا.',
              en: 'Hold the fare at the airline (the customer does not see it) before the payment, so a fare the airline refuses is never paid for. Off by default: the customer is charged first, then the booking is made, as before.',
            },
            type: 'boolean',
            value: true,
            default: false,
            risk: 'high',
          },
          {
            key: 'preChargeHold.default',
            label: {
              ar: 'القرار الافتراضي',
              en: 'Default decision',
            },
            help: {
              ar: 'القرار المطبَّق عندما لا تطابق أي قاعدة.',
              en: 'Decision applied when no rule matches.',
            },
            type: 'enum',
            value: 'allow',
            default: 'allow',
            options: [
              {
                value: 'allow',
                label: {
                  ar: 'سماح',
                  en: 'Allow',
                },
              },
              {
                value: 'deny',
                label: {
                  ar: 'رفض',
                  en: 'Deny',
                },
              },
            ],
          },
          {
            key: 'preChargeHold.rules',
            label: {
              ar: 'القواعد',
              en: 'Rules',
            },
            help: {
              ar: 'تُطبَّق أول قاعدة مفعّلة (حسب الأولوية تصاعديًا) تتحقق كل شروطها. الحقول نفسها في قواعد سياسة الحجز المؤقت، مثل الرفض عندما يكون السفر بعد أكثر من 30 يومًا.',
              en: 'The first enabled rule (by ascending priority) whose conditions all match wins. Same fields as the hold policy rules, e.g. deny when departure is more than 30 days away.',
            },
            type: 'string-list',
            value: [],
            default: [],
            structured: true,
          },
          {
            key: 'preChargeHold.channels',
            label: {
              ar: 'القنوات',
              en: 'Channels',
            },
            help: {
              ar: 'أين يُطبَّق الحجز المؤقت قبل الخصم: الموقع (العملاء) ولوحة التحكم (حجوزات الموظفين).',
              en: 'Where the hold before charging applies: the website (customers) and the dashboard (staff bookings).',
            },
            type: 'multi-enum',
            value: ['WEB', 'ADMIN'],
            default: ['WEB', 'ADMIN'],
            options: [
              {
                value: 'WEB',
                label: {
                  ar: 'الموقع (العملاء)',
                  en: 'Website (customers)',
                },
              },
              {
                value: 'ADMIN',
                label: {
                  ar: 'لوحة التحكم (الموظفون)',
                  en: 'Dashboard (staff)',
                },
              },
            ],
          },
          {
            key: 'preChargeHold.onIncompatibleServices',
            label: {
              ar: 'الإضافات التي لا يحملها الحجز المؤقت',
              en: 'Extras the hold cannot carry',
            },
            help: {
              ar: 'احجز ثم بِع: يُحجز المقعد الآن وتُشترى الإضافات بعد الدفع مباشرة (وإن رفضت الشركة إضافة ما يُسترد مبلغها وحده). فوري: يُتجاوز الحجز المؤقت ويتم الحجز كما كان سابقًا. الأمتعة تتبع هذا الاختيار. أما المقاعد والوجبات وتغطية الإلغاء لأي سبب فتسلك دائمًا المسار الفوري، لأن مورّد الطيران لا يستطيع بيعها بعد حجز مؤقت.',
              en: 'Hold then sell: hold the seat now and buy the extras right after payment (an extra the airline refuses then is refunded on its own). Instant: skip the hold and book as before. Bags follow this choice. Seats, meals and cancel-for-any-reason cover always take the instant path, because the airline supplier cannot sell them after a hold.',
            },
            type: 'enum',
            value: 'holdThenSell',
            default: 'holdThenSell',
            options: [
              {
                value: 'instant',
                label: {
                  ar: 'فوري (كما كان سابقًا)',
                  en: 'Instant (as before)',
                },
              },
              {
                value: 'holdThenSell',
                label: {
                  ar: 'احجز ثم بِع',
                  en: 'Hold then sell',
                },
              },
            ],
          },
          {
            key: 'preChargeHold.onHoldRefused',
            label: {
              ar: 'عند رفض شركة الطيران للحجز المؤقت',
              en: 'When the airline refuses the hold',
            },
            help: {
              ar: 'لرفض لسبب غير "الأجرة لم تعد متاحة" أو "تغيّر السعر" (فهذان يوقفان العملية دائمًا قبل الخصم). رفض: تتوقف العملية ولا يُخصم شيء. فوري: يُخصم المبلغ ويتم الحجز كما كان سابقًا.',
              en: 'For a refusal other than "fare gone" or "price changed" (those always stop before the charge). Refuse: stop and charge nothing. Instant: charge and book as before.',
            },
            type: 'enum',
            value: 'refuse',
            default: 'refuse',
            options: [
              {
                value: 'instant',
                label: {
                  ar: 'فوري (كما كان سابقًا)',
                  en: 'Instant (as before)',
                },
              },
              {
                value: 'refuse',
                label: {
                  ar: 'رفض (دون خصم)',
                  en: 'Refuse (charge nothing)',
                },
              },
            ],
          },
          {
            key: 'preChargeHold.holdTimeoutMs',
            label: {
              ar: 'مهلة الحجز المؤقت (ملّي ثانية)',
              en: 'Hold timeout (ms)',
            },
            help: {
              ar: 'المهلة بالملّي ثانية لطلب الحجز المؤقت. عند انتهائها يُطلب من العميل المحاولة مجددًا ولا يُخصم منه شيء.',
              en: 'Time limit in milliseconds of the hold call. On a timeout the customer is asked to try again and is not charged.',
            },
            type: 'duration',
            value: 30000,
            default: 30000,
            unit: 'ms',
            min: 2000,
            max: 60000,
          },
          {
            key: 'preChargeHold.minGuaranteeMinutes',
            label: {
              ar: 'أقصر ضمان للسعر (دقائق)',
              en: 'Shortest price guarantee (minutes)',
            },
            help: {
              ar: 'عدد الدقائق التي يجب أن تضمن فيها شركة الطيران السعر المحجوز حتى يدفع العميل. إذا كان الضمان أقصر يُتجاوز الحجز المؤقت ويتم الحجز كما كان سابقًا.',
              en: 'Minutes the airline must keep the held price for the payment. A shorter guarantee skips the hold and books as before.',
            },
            type: 'duration',
            value: 15,
            default: 15,
            unit: 'minutes',
            min: 5,
            max: 120,
          },
        ],
      },
      {
        id: 'cancellation',
        title: {
          ar: 'الإلغاء والتعديل',
          en: 'Cancellation & change',
        },
        description: {
          ar: 'رسوم الخدمة وما يُرد، ونافذة الإلغاء المجاني.',
          en: 'Service fees, what is refunded, and the void window.',
        },
        fields: [
          {
            key: 'cancellationPolicy.feeUsd',
            label: {
              ar: 'رسوم الإلغاء (USD)',
              en: 'Cancellation fee (USD)',
            },
            help: {
              ar: 'رسوم الخدمة لكل عملية إلغاء.',
              en: 'Service fee charged per cancellation.',
            },
            type: 'money',
            value: 15,
            default: 15,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'money',
          },
          {
            key: 'cancellationPolicy.feePercent',
            label: {
              ar: 'رسوم الإلغاء (% مما دُفع)',
              en: 'Cancellation fee (% of what was paid)',
            },
            help: {
              ar: 'نسبة مما دفعه العميل. تُحتسب الرسوم الأكبر بين هذه النسبة ورسوم الإلغاء الثابتة. 0 = الرسوم الثابتة فقط.',
              en: 'Percent of what the customer paid. The fee charged is the larger of this and the fixed cancellation fee. 0 = the fixed fee only.',
            },
            type: 'number',
            value: 5,
            default: 5,
            min: 0,
            max: 100,
            unit: 'percent',
            step: 0.5,
            control: 'money',
          },
          {
            key: 'cancellationPolicy.refundMarkupOnCancel',
            label: {
              ar: 'استرداد الهامش عند الإلغاء',
              en: 'Refund our markup on cancellation',
            },
            help: {
              ar: 'تضمين هامشنا في المبلغ المسترد عند إلغاء الحجز (عند الإيقاف: استرداد شركة الطيران فقط).',
              en: 'Include our markup in the refund when a booking is cancelled (off: the airline refund only).',
            },
            type: 'boolean',
            value: false,
            default: false,
            control: 'money',
          },
          {
            key: 'cancellationPolicy.refundFxMarginOnCancel',
            label: {
              ar: 'رد هامش الصرف عند الإلغاء',
              en: 'Refund the exchange margin on cancellation',
            },
            help: {
              ar: 'الرد بسعر العرض شاملًا هامش الأمان في الصرف. عند الإيقاف: الرد بالسعر الخام المثبّت وقت الحجز.',
              en: 'Refund at the display rate, our exchange safety margin included. Off: refund at the raw rate locked when the booking was made.',
            },
            type: 'boolean',
            value: false,
            default: false,
            control: 'money',
          },
          {
            key: 'cancellationPolicy.voidWindow.mode',
            label: {
              ar: 'ما يسترده العميل داخل المهلة',
              en: 'What the customer gets back inside the window',
            },
            help: {
              ar: 'يُرد كل ما دُفع (الافتراضي): بلا رسوم إلغاء، ويُرد معه هامش خدمتنا وهامش الصرف، فيسترد العميل كل ما دفعه. بلا رسوم إلغاء: تُلغى رسوم الإلغاء، لكن نحتفظ بهامش خدمتنا وهامش الصرف كما في الإلغاء العادي. قواعد الإلغاء العادية: المهلة لا تغيّر شيئًا (تُحتسب الرسوم ونحتفظ بالهوامش وتُرفض الأجرة غير القابلة للاسترداد). مع الخيارين الأولين يمكن أيضًا إلغاء الأجرة غير القابلة للاسترداد ما دامت المهلة مفتوحة، إذا ردّت شركة الطيران الأجرة كاملة.',
              en: 'Everything paid comes back (default): no cancellation fee, and our service fee and exchange margin are refunded too, so the customer gets back all they paid. No cancellation fee: the fee is waived, but our service fee and exchange margin are kept as on a normal cancellation. Normal cancellation rules: the window changes nothing (fee charged, margins kept, non-refundable fares refused). With the first two choices a non-refundable fare can also be cancelled while the window is open, if the airline returns the whole fare.',
            },
            type: 'enum',
            value: 'FULL_REFUND',
            default: 'FULL_REFUND',
            options: [
              {
                value: 'FULL_REFUND',
                label: {
                  ar: 'يُرد كل ما دُفع',
                  en: 'Everything paid comes back',
                },
              },
              {
                value: 'FEE_WAIVED',
                label: {
                  ar: 'بلا رسوم إلغاء (مع الاحتفاظ بالهوامش)',
                  en: 'No cancellation fee (margins kept)',
                },
              },
              {
                value: 'STANDARD',
                label: {
                  ar: 'قياسية',
                  en: 'Standard',
                },
              },
            ],
            risk: 'high',
          },
          {
            key: 'cancellationPolicy.voidWindow.safetyMarginMinutes',
            label: {
              ar: 'هامش الأمان قبل نهاية المهلة (دقائق)',
              en: 'Safety margin before the window ends (minutes)',
            },
            help: {
              ar: 'قبل كم دقيقة من نهاية مهلة شركة الطيران نتوقف عن عرض شروط المهلة، حتى تؤكد شركة الطيران الإلغاء والمهلة ما زالت مفتوحة. من 0 إلى 720، الافتراضي 60.',
              en: 'Minutes before the airline window ends when we stop offering the window terms, so the airline confirms the cancellation while the window is still open. 0 to 720, default 60.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 0,
            max: 720,
          },
          {
            key: 'cancellationPolicy.default',
            label: {
              ar: 'القرار الافتراضي',
              en: 'Default decision',
            },
            help: {
              ar: 'القرار المطبَّق عندما لا تطابق أي قاعدة.',
              en: 'Decision applied when no rule matches.',
            },
            type: 'enum',
            value: 'allow',
            default: 'allow',
            options: [
              {
                value: 'allow',
                label: {
                  ar: 'سماح',
                  en: 'Allow',
                },
              },
              {
                value: 'deny',
                label: {
                  ar: 'رفض',
                  en: 'Deny',
                },
              },
            ],
          },
          {
            key: 'cancellationPolicy.rules',
            label: {
              ar: 'القواعد',
              en: 'Rules',
            },
            help: {
              ar: 'تُطبَّق أول قاعدة مفعّلة (حسب الأولوية تصاعديًا) تتحقق كل شروطها.',
              en: 'The first enabled rule (by ascending priority) whose conditions all match wins.',
            },
            type: 'string-list',
            value: ['10 · أسعار غير قابلة للاسترداد خارج النافذة ← رفض'],
            default: [],
            structured: true,
          },
          {
            key: 'changePolicy.feeUsd',
            label: {
              ar: 'رسوم التغيير (USD)',
              en: 'Change fee (USD)',
            },
            help: {
              ar: 'رسوم الخدمة لكل تغيير في الطلب.',
              en: 'Service fee charged per order change.',
            },
            type: 'money',
            value: 10,
            default: 0,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            control: 'money',
          },
          {
            key: 'changePolicy.default',
            label: {
              ar: 'القرار الافتراضي',
              en: 'Default decision',
            },
            help: {
              ar: 'القرار المطبَّق عندما لا تطابق أي قاعدة.',
              en: 'Decision applied when no rule matches.',
            },
            type: 'enum',
            value: 'allow',
            default: 'allow',
            options: [
              {
                value: 'allow',
                label: {
                  ar: 'سماح',
                  en: 'Allow',
                },
              },
              {
                value: 'deny',
                label: {
                  ar: 'رفض',
                  en: 'Deny',
                },
              },
            ],
          },
          {
            key: 'changePolicy.rules',
            label: {
              ar: 'القواعد',
              en: 'Rules',
            },
            help: {
              ar: 'تُطبَّق أول قاعدة مفعّلة (حسب الأولوية تصاعديًا) تتحقق كل شروطها.',
              en: 'The first enabled rule (by ascending priority) whose conditions all match wins.',
            },
            type: 'string-list',
            value: [],
            default: [],
            structured: true,
          },
        ],
      },
      {
        id: 'extras',
        title: {
          ar: 'الخدمات والقدرات',
          en: 'Extras & capabilities',
        },
        description: {
          ar: 'ما نبيعه مع الرحلة وطريقة البحث.',
          en: 'What we sell with the flight and how we search.',
        },
        fields: [
          {
            key: 'postBookingServicesEnabled',
            label: {
              ar: 'الإضافات بعد الحجز',
              en: 'Extras after booking',
            },
            help: {
              ar: 'بيع الإضافات (الحقائب، والمقاعد حين تبيعها شركة الطيران) على الحجوزات المؤكدة، في الموقع ومن صفحة الحجز. مفعّل افتراضيًا؛ أوقفه لإيقاف بيعها.',
              en: 'Sell extras (bags; seats once the airline sells them) on booked trips, on the website and from the booking sheet. On by default; switch off to stop selling them.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'upsellEnabled',
            label: {
              ar: 'عروض الترقية',
              en: 'Upgrades',
            },
            help: {
              ar: 'عرض ترقيات المقصورة وفئة السعر على العرض.',
              en: 'Offer cabin and fare brand upgrades on the offer.',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'mealsEnabled',
            label: {
              ar: 'بيع الوجبات',
              en: 'Sell meals',
            },
            help: {
              ar: 'بيع الوجبات التي تعرضها شركة الطيران مع العرض (الحجز الفوري فقط، ولا تُباع في الحجز المؤقت). متوقف افتراضيًا لأن شركة الطيران التجريبية لدى المورّد لا تعرض وجبات، فلم يُثبت المسار بعد. فعّله فقط بعد أن يثبت عرض من شركة طيران حقيقية أن الوجبات تعمل من البداية إلى النهاية.',
              en: "Sell the meals an airline lists with an offer (instant booking only; never on a hold). Off by default because the supplier's test airline lists no meals, so the flow is unproven. Switch it on only after a real airline offer has shown meals working end to end.",
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'cfarEnabled',
            label: {
              ar: 'بيع الإلغاء لأي سبب',
              en: 'Sell cancel for any reason',
            },
            help: {
              ar: 'بيع تغطية الإلغاء لأي سبب التي تعرضها شركة الطيران مع العرض (الحجز الفوري فقط، ولا تُباع في الحجز المؤقت). متوقف افتراضيًا لأن شركة الطيران التجريبية لدى المورّد لا تعرض هذه التغطية، فلم يُثبت الشراء والمطالبة بعد. فعّله فقط بعد أن يثبتهما عرض من شركة طيران حقيقية. تبقى التغطية المشتراة قابلة للمطالبة وإن كان الخيار متوقفًا.',
              en: "Sell the cancel-for-any-reason cover an airline lists with an offer (instant booking only; never on a hold). Off by default because the supplier's test airline offers no cover, so purchase and claim are unproven. Switch it on only after a real airline offer has proved them. A cover already bought can still be claimed while this is off.",
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'splitTicketEnabled',
            label: {
              ar: 'التذاكر المجزأة',
              en: 'Split tickets',
            },
            help: {
              ar: 'دمج عرضين باتجاه واحد في رحلة واحدة عندما يكون ذلك أرخص.',
              en: 'Combine two one-way offers into one trip when it is cheaper.',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'multiStepSearchEnabled',
            label: {
              ar: 'البحث خطوة بخطوة',
              en: 'Step-by-step search',
            },
            help: {
              ar: 'البحث عن كل مقطع على حدة ثم دمج الاختيارات.',
              en: 'Search one leg at a time and combine the selections.',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'progressiveSearchEnabled',
            label: {
              ar: 'النتائج التدريجية',
              en: 'Progressive results',
            },
            help: {
              ar: 'عرض نتائج البحث الجزئية بينما لا يزال المورّد يجيب.',
              en: 'Show partial search results while the supplier is still answering.',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'progressiveDrainSeconds',
            label: {
              ar: 'مدة البحث التدريجي (ثوانٍ)',
              en: 'Progressive search length (seconds)',
            },
            help: {
              ar: 'عدد الثواني التي يستمر فيها البحث التدريجي في جمع النتائج قبل اكتماله.',
              en: 'Seconds a progressive search keeps collecting results before it completes.',
            },
            type: 'duration',
            value: 20,
            default: 20,
            unit: 'seconds',
            min: 1,
            max: 300,
          },
          {
            key: 'syncLoyaltyToOffer',
            label: {
              ar: 'إرسال أرقام المسافر الدائم',
              en: 'Send frequent flyer numbers',
            },
            help: {
              ar: 'إرسال أرقام برامج المسافر الدائم عند التسعير. إيقاف؛ مرن (تجاهل الرفض)؛ صارم (فشل العملية).',
              en: 'Send frequent flyer numbers when pricing. Off; soft (ignore rejections); strict (fail).',
            },
            type: 'enum',
            value: 'soft',
            default: 'off',
            options: [
              {
                value: 'off',
                label: {
                  ar: 'إيقاف',
                  en: 'Off',
                },
              },
              {
                value: 'soft',
                label: {
                  ar: 'مرن (تجاهل الرفض)',
                  en: 'Soft (ignore rejections)',
                },
              },
              {
                value: 'strict',
                label: {
                  ar: 'صارم (فشل العملية)',
                  en: 'Strict (fail)',
                },
              },
            ],
          },
          {
            key: 'advancedFilters.arrivalWindows',
            label: {
              ar: 'نوافذ وقت الوصول',
              en: 'Arrival time windows',
            },
            help: {
              ar: 'إرسال نوافذ وقت الوصول إلى المورّد كفلتر للبحث.',
              en: 'Send arrival time windows to the supplier as a search filter.',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'advancedFilters.fareTypes',
            label: {
              ar: 'أنواع الأسعار',
              en: 'Fare types',
            },
            help: {
              ar: 'أنواع أسعار المورّد المطلوبة في البحث. القائمة الفارغة تستخدم الافتراضي لدى المورّد.',
              en: 'Supplier fare types requested in search. An empty list uses the supplier default.',
            },
            type: 'string-list',
            value: [],
            default: [],
            max: 20,
          },
          {
            key: 'advancedFilters.youngAdult',
            label: {
              ar: 'أسعار الشباب',
              en: 'Young adult fares',
            },
            help: {
              ar: 'طلب أسعار الشباب حيث تتيحها شركة الطيران.',
              en: 'Ask for young adult fares where the airline offers them.',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'sendDeviceHeaders',
            label: {
              ar: 'إرسال بيانات الجهاز',
              en: 'Send device details',
            },
            help: {
              ar: 'تمرير بيانات جهاز العميل وعنوان IP إلى المورّد.',
              en: "Forward the customer's device and IP details to the supplier.",
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'metadataSync',
            label: {
              ar: 'كتابة مرجعنا لدى المورّد',
              en: 'Write our reference at the supplier',
            },
            help: {
              ar: 'كتابة مرجع الحجز والوسوم لدينا على طلب المورّد.',
              en: 'Write our booking reference and tags on the supplier order.',
            },
            type: 'boolean',
            value: true,
            default: false,
          },
        ],
      },
      {
        id: 'after',
        title: {
          ar: 'بعد الدفع',
          en: 'After payment',
        },
        description: {
          ar: 'التسعير الأخير، أمان التأكيد، الخدمات الفاشلة، التذاكر المتأخرة والمطابقة.',
          en: 'Final pricing, confirmation safety, failed extras, late tickets and reconciliation.',
        },
        fields: [
          {
            key: 'finalPricingBeforeOrder',
            label: {
              ar: 'التحقق النهائي من السعر قبل الطلب',
              en: 'Final price check before ordering',
            },
            help: {
              ar: 'إعادة تسعير العرض لدى المورّد قبل إنشاء الطلب مباشرة، مقارنةً بهامش تغيّر السعر في إعدادات الطيران.',
              en: 'Re-price the offer at the supplier just before creating the order, against the price change tolerance of the Flights settings.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'confirmationSafety.retryWindowMinutes',
            label: {
              ar: 'مهلة إعادة المحاولة بعد الدفع (دقائق)',
              en: 'Retry window after payment (minutes)',
            },
            help: {
              ar: 'المدة التي يظل فيها الحجز المدفوع يعيد محاولة التأكيد عند الأعطال المؤقتة (تأخر رد شركة الطيران، أو تعذّر الوصول إلى المورّد، أو انقطاع قصير في قاعدة البيانات). إذا انتهت المهلة دون إصدار تذكرة، يُعتبر الحجز فاشلًا ويُسترد المبلغ للعميل تلقائيًا ويتلقى الموظفون تنبيهًا حرجًا. المهلة الأطول تنقذ حجوزات أكثر لكنها تُطيل انتظار العميل (من 5 إلى 240، والافتراضي 30).',
              en: 'How long a paid booking keeps retrying its confirmation through temporary failures (airline timeout, supplier unavailable, database blip). When the window closes without a ticket, the booking fails, the customer is refunded automatically and staff get a critical alert. A longer window saves more bookings but keeps the customer waiting longer (5 to 240, default 30).',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'minutes',
            min: 5,
            max: 240,
          },
          {
            key: 'confirmationSafety.stuckAfterMinutes',
            label: {
              ar: 'إعادة تشغيل الحجز العالق بعد (دقائق)',
              en: 'Restart a stuck booking after (minutes)',
            },
            help: {
              ar: 'إذا بقي حجز مدفوع أو تعديل مدفوع أو إضافة مدفوعة هذه المدة دون أي عملية تعمل عليه، يعيد نظام المراقبة تشغيله. لا يُرسَل الطلب إلى شركة الطيران مرتين أبدًا، إذ يُتحقق من الطلب أولًا في كل مرة (من 2 إلى 60، والافتراضي 5).',
              en: 'If a paid booking, a paid change or a paid extra sits this long with no background job working on it, the safety sweeper starts it again. It is never sent to the airline twice: the order is always checked first (2 to 60, default 5).',
            },
            type: 'duration',
            value: 5,
            default: 5,
            unit: 'minutes',
            min: 2,
            max: 60,
          },
          {
            key: 'confirmationSafety.alertAfterRedrives',
            label: {
              ar: 'تنبيه الموظفين بعد (مرات إعادة التشغيل)',
              en: 'Alert staff after (restarts)',
            },
            help: {
              ar: 'عدد المرات التي يعيد فيها نظام المراقبة تشغيل الحجز أو التعديل أو الإضافة نفسها قبل أن يتلقى الموظفون تنبيهًا حرجًا لمتابعته يدويًا. كلما قلّ الرقم وصل التنبيه أبكر (من 1 إلى 10، والافتراضي 3).',
              en: 'How many times the sweeper restarts the same booking, change or extra before staff get a critical alert to look at it by hand. A lower number means earlier alerts (1 to 10, default 3).',
            },
            type: 'integer',
            value: 3,
            default: 3,
            min: 1,
            max: 10,
          },
          {
            key: 'confirmationSafety.autoCancelOrphanOrders',
            label: {
              ar: 'إلغاء طلبات الطيران اليتيمة تلقائيًا',
              en: 'Cancel orphan airline orders automatically',
            },
            help: {
              ar: 'الطلب اليتيم هو طلب لدى شركة الطيران دُفع من رصيدنا لدى المورّد ولم يعد يتبعه أي حجز (ظهر متأخرًا بعد استرداد مبلغ الحجز، أو أُنشئ مرتين). عند التفعيل يلغيه النظام بنفسه لدى شركة الطيران إن سمحت بذلك. وعند الإيقاف، أو إذا رفضت الشركة الإلغاء، تُفتح مهمة للموظفين في صفحة «مهام تحتاج إلى الموظفين» ويُرسَل تنبيه.',
              en: 'An orphan order is an airline order paid from our supplier balance that no booking owns any more (it appeared late after the booking was refunded, or was created twice). When on, the system cancels it at the airline by itself when the airline allows it. When off, or when the airline refuses, it opens a task for staff under "Tasks that need staff" and raises an alert.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'failedServicesPolicy.enabled',
            label: {
              ar: 'فتح حالات الإضافات المتعثرة',
              en: 'Open failed-extra cases',
            },
            help: {
              ar: 'فتح حالة على الحجز حين لا تحجز شركة الطيران إضافة مدفوعة. عند الإيقاف: تبقى الإضافة متعثرة ويعالجها الموظفون يدويًا (لا حالة ولا استرداد تلقائي، وتُسترد الأمتعة المرفوضة بعد دفع الحجز المؤقت فورًا).',
              en: 'Open a case on the booking when the airline does not book a paid extra. Off: the extra stays failed and staff handle it by hand (no case and no automatic refund; a bag refused after a hold is paid is refunded at once).',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'failedServicesPolicy.notifyCustomer',
            label: {
              ar: 'إبلاغ العميل',
              en: 'Tell the customer',
            },
            help: {
              ar: 'إرسال بريد إلكتروني ورسالة واتساب للعميل بأن إضافة تعذّر إضافتها، وما يمكنه فعله، وموعد استردادها تلقائيًا.',
              en: 'E-mail and WhatsApp the customer that an extra could not be added, what they can do, and when it is refunded automatically.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'failedServicesPolicy.alertStaff',
            label: {
              ar: 'تنبيه الموظفين',
              en: 'Alert staff',
            },
            help: {
              ar: 'رفع تنبيه تشغيلي لكل حالة جديدة، ليعيد الموظفون المحاولة أو يستردوا المبلغ من قائمة الإضافات المتعثرة.',
              en: 'Raise an operations alert for every new case, so staff can retry or refund it from the Failed extras queue.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'failedServicesPolicy.allowCustomerChoice',
            label: {
              ar: 'السماح للعميل بالاختيار',
              en: 'Let the customer choose',
            },
            help: {
              ar: 'السماح للعميل بالاختيار من حجزه (أو جلسة إدارة الحجز): إعادة المحاولة (فقط حين تبيع شركة الطيران هذه الإضافة بعد الحجز) أو الاسترداد. عند الإيقاف: يقرر الموظفون وحدهم.',
              en: 'Let the customer choose in their booking (or a manage-booking session): try again (only when the airline sells that extra after booking) or get a refund. Off: only staff decide.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'failedServicesPolicy.refundRequiresAdminConfirmation',
            label: {
              ar: 'تأكيد الموظفين لاسترداد العميل',
              en: 'Staff confirm customer refunds',
            },
            help: {
              ar: 'الاسترداد الذي يختاره العميل ينتظر تأكيد أحد الموظفين في لوحة التحكم بدل صرفه فورًا. استرداد الموظفين والاسترداد التلقائي لا ينتظران أبدًا.',
              en: 'A refund the customer chooses waits until a staff member confirms it in the dashboard, instead of being issued at once. Refunds by staff and the automatic refund never wait.',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'failedServicesPolicy.autoRefundEnabled',
            label: {
              ar: 'الاسترداد التلقائي',
              en: 'Refund automatically',
            },
            help: {
              ar: 'استرداد الإضافة المتعثرة تلقائيًا إن لم يُتخذ قرار قبل الموعد: سعر هذه الإضافة فقط، إلى وسيلة الدفع الأصلية.',
              en: "Refund the failed extra automatically when nobody decided before the deadline: only that extra's price, to the original payment method.",
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'failedServicesPolicy.autoRefundAfterHours',
            label: {
              ar: 'الاسترداد التلقائي بعد (ساعات)',
              en: 'Automatic refund after (hours)',
            },
            help: {
              ar: 'عدد الساعات بعد التعثر قبل الاسترداد التلقائي، حين يكون مفعّلًا (من 1 إلى 720). الاسترداد الذي ينتظر تأكيد الموظفين لا يوقفه.',
              en: 'Hours after the failure before the automatic refund, when it is on (1 to 720). A refund waiting for staff confirmation does not stop it.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 720,
          },
          {
            key: 'ticketingAlert.enabled',
            label: {
              ar: 'التنبيه عند فقد التذاكر الإلكترونية',
              en: 'Alert on missing e-tickets',
            },
            help: {
              ar: 'تنبيه الموظفين بالحجوزات المؤكدة التي لا تزال دون تذكرة إلكترونية من شركة الطيران. عند الإيقاف: لا فحص ولا تنبيه.',
              en: 'Alert staff about confirmed bookings that still have no airline e-ticket. Off: no check and no alert.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'ticketingAlert.afterHours',
            label: {
              ar: 'التنبيه بعد (ساعات)',
              en: 'Alert after (hours)',
            },
            help: {
              ar: 'عدد الساعات بعد الدفع دون تذكرة إلكترونية قبل تنبيه الموظفين (من 1 إلى 72).',
              en: 'Hours after payment without an airline e-ticket before staff are alerted (1 to 72).',
            },
            type: 'duration',
            value: 4,
            default: 6,
            unit: 'hours',
            min: 1,
            max: 72,
          },
          {
            key: 'ticketingAlert.everyMinutes',
            label: {
              ar: 'الفحص كل (دقائق)',
              en: 'Check every (minutes)',
            },
            help: {
              ar: 'عدد الدقائق بين فحصين للتذاكر الإلكترونية المفقودة (من 15 إلى 1440).',
              en: 'Minutes between two missing e-ticket checks (15 to 1440).',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 15,
            max: 1440,
          },
          {
            key: 'ticketingAlert.departureShare',
            label: {
              ar: 'التنبيه أبكر قرب المغادرة (نسبة)',
              en: 'Alert sooner near departure (share)',
            },
            help: {
              ar: 'حين تقترب المغادرة، يُرسل التنبيه بعد هذه النسبة من الوقت بين الدفع والمغادرة بدل الساعات أعلاه، أيهما أقرب. 0.25 = الربع: حجز دُفع قبل المغادرة بأربع ساعات يُفحص بعد ساعة. 0 = الساعات أعلاه دائمًا. بين 0 و1.',
              en: 'When departure is close, alert after this share of the time between payment and departure instead of the hours above, whichever is sooner. 0.25 = a quarter: a booking paid 4 hours before departure is checked after 1 hour. 0 = always use the hours above. Between 0 and 1.',
            },
            type: 'number',
            value: 0.25,
            default: 0.25,
            min: 0,
            max: 1,
            unit: 'ratio',
            step: 0.05,
          },
          {
            key: 'ticketingAlert.minWaitMinutes',
            label: {
              ar: 'أقل انتظار قبل التنبيه (دقائق)',
              en: 'Shortest wait before an alert (minutes)',
            },
            help: {
              ar: 'عدد الدقائق بعد الدفع قبل أي تنبيه عن تذكرة مفقودة مهما اقتربت المغادرة، لأن شركات الطيران تحتاج دقائق لإصدار التذكرة. من 5 إلى 1440، الافتراضي 30.',
              en: 'Minutes after payment before any missing e-ticket alert, however close departure is, because airlines take a few minutes to issue. 5 to 1440, default 30.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'minutes',
            min: 5,
            max: 1440,
          },
          {
            key: 'ticketingAlert.criticalWithinHours',
            label: {
              ar: 'تنبيه حرج إذا كانت المغادرة خلال (ساعات)',
              en: 'Critical when departure is within (hours)',
            },
            help: {
              ar: 'يكون التنبيه حرجًا (يُرسل على كل قنوات المناوبة) إذا كانت المغادرة بعد هذا العدد من الساعات أو أقل، وتحذيرًا فيما عدا ذلك. 0 = تحذير دائمًا. من 0 إلى 168، الافتراضي 24.',
              en: 'The alert is critical (sent on every on-call channel) when departure is this many hours away or less, and a warning otherwise. 0 = always a warning. 0 to 168, default 24.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 0,
            max: 168,
          },
          {
            key: 'orderListReconcile.enabled',
            label: {
              ar: 'مفعّلة',
              en: 'Enabled',
            },
            help: {
              ar: 'عرض طلبات المورّد دوريًا ومطابقتها مع طلباتنا (مفعّلة افتراضيًا).',
              en: "Regularly list the supplier's orders and reconcile them with ours (on by default).",
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'orderListReconcile.everyMinutes',
            label: {
              ar: 'كل (دقائق)',
              en: 'Every (minutes)',
            },
            help: {
              ar: 'عدد الدقائق بين عمليتي مطابقة (من 5 إلى 1440، الافتراضي 60).',
              en: 'Minutes between two reconciliation runs (5 to 1440, default 60).',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 5,
            max: 1440,
          },
          {
            key: 'orderListReconcile.autoCancelOrphanHolds',
            label: {
              ar: 'إلغاء الحجوزات المؤقتة اليتيمة',
              en: 'Cancel orphan holds',
            },
            help: {
              ar: 'إلغاء أي حجز مؤقت لدى المورّد لا يقابله حجز لدينا، حتى لا يبقى محتجزًا لمقاعد أو مهلة لا يتابعها أحد (مفعّل افتراضيًا). أوقفه إذا كانت بيئة أخرى (مثل موقع تجريبي) تستخدم حساب المورّد نفسه، لأن حجوزاتها ستبدو يتيمة هنا وستُلغى.',
              en: 'Cancel a hold at the supplier that has no booking of ours, so it never keeps seats or a deadline nobody watches (on by default). Switch it off if another environment (for example a test site) uses the same supplier account: its holds look like orphans here and would be cancelled.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'balanceAlertUsdPerDay',
            label: {
              ar: 'تنبيه رصيد المورّد (USD)',
              en: 'Supplier balance alert (USD)',
            },
            help: {
              ar: 'تنبيه عندما ينخفض رصيد المورّد عن هذا المبلغ بالدولار. أوقفه لإيقاف التنبيه.',
              en: 'Alert when the supplier balance falls below this many USD. Switch it off to turn the alert off.',
            },
            type: 'money',
            value: null,
            default: null,
            nullable: true,
            min: 0,
            max: 1000000,
            unit: 'USD',
            step: 0.01,
            deprecated: true,
            note: {
              ar: 'مكرر مع «حد الرصيد المنخفض» في حراس المورد؛ يُقترح إخفاؤه ثم حذفه.',
              en: 'Duplicates the low-balance alert of the supplier guards; hide, then retire.',
            },
          },
        ],
      },
      {
        id: 'ranking',
        title: {
          ar: 'ترتيب النتائج',
          en: 'Ranking',
        },
        description: {
          ar: 'أوزان ترتيب «الأفضل» (مجموعها 1) وشركات الطيران المفضلة.',
          en: 'Weights of the "best" ranking (sum 1) and preferred airlines.',
        },
        fields: [
          {
            key: 'resultsRankingWeights.price',
            label: {
              ar: 'السعر',
              en: 'Price',
            },
            help: {
              ar: 'وزن السعر بعد التطبيع.',
              en: 'Weight of the normalised price.',
            },
            type: 'number',
            value: 0.5,
            default: 0.55,
            min: 0,
            max: 1,
            unit: 'ratio',
            step: 0.05,
          },
          {
            key: 'resultsRankingWeights.duration',
            label: {
              ar: 'المدة',
              en: 'Duration',
            },
            help: {
              ar: 'وزن المدة الإجمالية بعد التطبيع.',
              en: 'Weight of the normalised total duration.',
            },
            type: 'number',
            value: 0.3,
            default: 0.3,
            min: 0,
            max: 1,
            unit: 'ratio',
            step: 0.05,
          },
          {
            key: 'resultsRankingWeights.stops',
            label: {
              ar: 'التوقفات',
              en: 'Stops',
            },
            help: {
              ar: 'وزن عدد التوقفات بعد التطبيع.',
              en: 'Weight of the normalised number of stops.',
            },
            type: 'number',
            value: 0.15,
            default: 0.15,
            min: 0,
            max: 1,
            unit: 'ratio',
            step: 0.05,
          },
          {
            key: 'resultsRankingWeights.preferredAirline',
            label: {
              ar: 'شركة الطيران المفضلة',
              en: 'Preferred airline',
            },
            help: {
              ar: 'وزن تعزيز شركات الطيران المفضلة (0: لا تؤثر التفضيلات في الترتيب).',
              en: 'Weight of the preferred airline boost (0: preferences do not affect the ranking).',
            },
            type: 'number',
            value: 0.05,
            default: 0,
            min: 0,
            max: 1,
            unit: 'ratio',
            step: 0.05,
          },
          {
            key: 'preferredAirlines',
            label: {
              ar: 'شركات الطيران المفضلة',
              en: 'Preferred airlines',
            },
            help: {
              ar: 'شركات طيران تُقدَّم في ترتيب "الأفضل".',
              en: 'Airlines boosted in the "best" ranking.',
            },
            type: 'string-list',
            value: ['TK · 0.6', 'PC · 0.3'],
            default: [],
            structured: true,
            max: 100,
          },
        ],
      },
    ],
  },
  {
    key: 'flight_guards',
    section: 'flights',
    icon: 'ShieldAlert',
    title: {
      ar: 'حراس المورد والكلفة',
      en: 'Supplier and cost guards',
    },
    summary: {
      ar: 'رصيد المورد وكلفة البحث وضوابط الحجز',
      en: 'Supplier balance, search cost and booking guards',
    },
    description: {
      ar: 'مراقبة رصيدنا المدفوع مسبقًا لدى مورد الطيران، وحدود البحث اليومية واختبار التحقق للزوار، ودمج عمليات البحث المتطابقة، والحماية من الحجز المكرر والحجوزات المؤقتة المتروكة.',
      en: 'Watches our prepaid balance with the flight supplier, limits daily searches and asks guests for a robot check, shares identical searches, and guards against duplicate bookings and abandoned holds.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 7,
    schemaVersion: 1,
    updatedAt: '2026-11-09T09:05:00.000Z',
    updatedBy: 'Ayşe Demir',
    masterSwitch: 'supplierBalance.enabled',
    enabled: true,
    attention: {
      ar: 'آخر قراءة لرصيد Duffel قبل 9 أيام (8,400 $): التقدير قد يكون بعيدًا عن الحقيقة. سجّل القراءة بعد كل شحن.',
      en: 'The last Duffel balance reading is 9 days old (8,400 USD): the estimate may be far off. Record a reading after every top-up.',
    },
    subsections: [
      {
        id: 'balance',
        title: {
          ar: 'رصيد المورّد',
          en: 'Supplier balance',
        },
        description: {
          ar: 'رصيد Duffel المسبق لا يُقرأ من الـ API؛ يسجّله فريق المالية.',
          en: 'The prepaid Duffel balance cannot be read from the API; finance records it.',
        },
        fields: [
          {
            key: 'supplierBalance.enabled',
            label: {
              ar: 'مراقبة رصيد المورد',
              en: 'Watch the supplier balance',
            },
            help: {
              ar: 'عند إيقافها لا تقدير ولا تنبيه، ولا يتوقف تأكيد أي حجز بسبب الرصيد.',
              en: 'Off: no estimate, no alert, and a booking confirmation is never paused because of the balance.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'supplierBalance.lastReading.amountUsd',
            label: {
              ar: 'الرصيد (دولار)',
              en: 'Balance (USD)',
            },
            help: {
              ar: 'الرصيد الظاهر في لوحة المورد بالدولار الأمريكي.',
              en: 'The balance shown in the supplier dashboard, in US dollars.',
            },
            type: 'money',
            value: 8400,
            default: null,
            nullable: true,
            min: 0,
            max: 100000000,
            unit: 'USD',
            step: 0.01,
          },
          {
            key: 'supplierBalance.lastReading.at',
            label: {
              ar: 'وقت القراءة',
              en: 'Read at',
            },
            help: {
              ar: 'متى قُرئ الرصيد؛ تُطرح منه المدفوعات للمورد بعد هذا الوقت.',
              en: 'When the balance was read. Supplier payments after this moment are subtracted from it.',
            },
            type: 'string',
            value: '2026-11-09T12:00:00+03:00',
            default: null,
            nullable: true,
            format: 'datetime',
          },
          {
            key: 'supplierBalance.lowBalanceUsd',
            label: {
              ar: 'حد تنبيه الرصيد المنخفض (دولار)',
              en: 'Low balance alert (USD)',
            },
            help: {
              ar: 'يصل تنبيه تحذيري حين يقل الرصيد المقدَّر عن هذا المبلغ. الافتراضي 2,000.',
              en: 'A warning alert is sent when the estimated balance falls below this amount. Default 2,000.',
            },
            type: 'money',
            value: 3000,
            default: 2000,
            min: 0,
            max: 100000000,
            unit: 'USD',
            step: 0.01,
          },
          {
            key: 'supplierBalance.minCoverDays',
            label: {
              ar: 'أقل أيام تغطية قبل التنبيه',
              en: 'Fewest days of cover before an alert',
            },
            help: {
              ar: 'يصل تنبيه تحذيري حين يكفي الرصيد المقدَّر أقل من هذا العدد من الأيام بمتوسط الإنفاق اليومي. من 0 إلى 60، الافتراضي 2.',
              en: 'A warning alert is sent when the estimated balance covers fewer days than this at the average daily spend. 0 to 60, default 2.',
            },
            type: 'number',
            value: 2,
            default: 2,
            min: 0,
            max: 60,
            unit: 'count',
            step: 0.5,
          },
          {
            key: 'supplierBalance.consumptionWindowDays',
            label: {
              ar: 'أيام حساب متوسط الإنفاق',
              en: 'Days for the average daily spend',
            },
            help: {
              ar: 'كم يومًا من المدفوعات للمورد يُحسب منها متوسط الإنفاق اليومي. من 1 إلى 90، الافتراضي 7.',
              en: 'How many days of supplier payments make up the average daily spend. 1 to 90, default 7.',
            },
            type: 'duration',
            value: 7,
            default: 7,
            unit: 'days',
            min: 1,
            max: 90,
          },
          {
            key: 'supplierBalance.pauseConfirmationWhenInsufficient',
            label: {
              ar: 'إيقاف التأكيد مؤقتًا عند نقص الرصيد',
              en: 'Pause confirmations when the balance is too low',
            },
            help: {
              ar: 'حين يُعرف أن الرصيد لا يكفي التذكرة، ينتظر الحجز المدفوع (تنبيه حرج وإعادة محاولة كل دقيقة) بدل أن يفشل ويُرد للعميل. عند الإيقاف: يفشل الحجز ويُرد المبلغ فورًا.',
              en: 'When the balance is known to be too small for a ticket, the paid booking waits (critical alert, retried every minute) instead of failing and being refunded. Off: it fails and the customer is refunded at once.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'supplierBalance.pauseMaxMinutes',
            label: {
              ar: 'أقصى مدة انتظار للشحن (دقائق)',
              en: 'Longest wait for a top-up (minutes)',
            },
            help: {
              ar: 'بعدها يفشل الحجز المنتظر ويُرد مبلغه للعميل كالمعتاد. من 10 إلى 720، الافتراضي 240.',
              en: 'After this, a booking still waiting fails and the customer is refunded as usual. 10 to 720, default 240.',
            },
            type: 'duration',
            value: 240,
            default: 240,
            unit: 'minutes',
            min: 10,
            max: 720,
          },
        ],
      },
      {
        id: 'search',
        title: {
          ar: 'ميزانية البحث وCAPTCHA',
          en: 'Search budgets & CAPTCHA',
        },
        description: {
          ar: 'حدود يومية للبحث وتنبيه نسبة البحث إلى الحجز.',
          en: 'Daily search limits and the look-to-book alert.',
        },
        fields: [
          {
            key: 'searchGuard.perIpDailySearches',
            label: {
              ar: 'عمليات البحث اليومية لكل عنوان IP',
              en: 'Daily searches per IP address',
            },
            help: {
              ar: 'الحد اليومي لعمليات البحث من عنوان IP واحد (يوم بتوقيت UTC). الافتراضي 500. أوقفه لإلغاء الحد.',
              en: 'Searches one IP address may run per day (UTC day). Default 500. Switch it off for no limit.',
            },
            type: 'integer',
            value: 500,
            default: 500,
            min: 1,
            max: 1000000,
          },
          {
            key: 'searchGuard.perAccountDailySearches',
            label: {
              ar: 'عمليات البحث اليومية لكل حساب',
              en: 'Daily searches per account',
            },
            help: {
              ar: 'الحد اليومي لعمليات بحث الحساب المسجّل الواحد (يوم بتوقيت UTC). الافتراضي 500. أوقفه لإلغاء الحد.',
              en: 'Searches one signed-in account may run per day (UTC day). Default 500. Switch it off for no limit.',
            },
            type: 'integer',
            value: 500,
            default: 500,
            min: 1,
            max: 1000000,
          },
          {
            key: 'searchGuard.dailySupplierSearchBudget',
            label: {
              ar: 'الميزانية اليومية لنداءات البحث لدى المورد',
              en: 'Daily supplier search budget',
            },
            help: {
              ar: 'عدد نداءات البحث لدى المورد المسموح للمنصة كلها يوميًا (يوم بتوقيت UTC). عند نفادها يُطلب من الزوار المحاولة لاحقًا، ويستمر بحث العملاء المسجّلين والموظفين. موقوفة افتراضيًا (بلا ميزانية).',
              en: 'Supplier search calls the whole platform may make per day (UTC day). When it is used up, guests are asked to try later while signed-in customers and staff keep searching. Off by default (no budget).',
            },
            type: 'integer',
            value: 40000,
            default: null,
            nullable: true,
            min: 1,
            max: 1000000,
          },
          {
            key: 'searchGuard.lookToBookAlertRatio',
            label: {
              ar: 'حد تنبيه نسبة البحث إلى الحجز',
              en: 'Search-to-booking alert ratio',
            },
            help: {
              ar: 'تنبيه تحذيري (مرة يوميًا) حين يتجاوز عدد نداءات البحث لدى المورد لكل حجز مدفوع هذا الرقم (10 أو أكثر). موقوف افتراضيًا (بلا تنبيه).',
              en: 'A warning alert (once a day) when the day has more supplier searches per paid booking than this number (10 or more). Off by default (no alert).',
            },
            type: 'integer',
            value: 1500,
            default: null,
            nullable: true,
            min: 10,
            max: 1000000,
          },
          {
            key: 'searchGuard.captcha.enabled',
            label: {
              ar: 'طلب اختبار التحقق من الزوار',
              en: 'Ask guests for a robot check',
            },
            help: {
              ar: 'يحتاج مفتاح Turnstile السري على الخادم؛ بدونه تُتخطى الخطوة. موقوف افتراضيًا.',
              en: 'Needs the Turnstile secret key on the server; without it the check is skipped. Off by default.',
            },
            type: 'boolean',
            value: true,
            default: false,
          },
          {
            key: 'searchGuard.captcha.guestSearchesBeforeChallenge',
            label: {
              ar: 'عمليات بحث الزائر قبل الاختبار',
              en: 'Guest searches before the check',
            },
            help: {
              ar: 'كم بحثًا يجريه الزائر يوميًا قبل أن يُطلب منه الاختبار. 0 = قبل أول بحث. الافتراضي 30.',
              en: 'Searches a guest may run per day before the check is asked. 0 = before the first search. Default 30.',
            },
            type: 'integer',
            value: 30,
            default: 30,
            min: 0,
            max: 10000,
          },
          {
            key: 'searchGuard.captcha.passMinutes',
            label: {
              ar: 'مدة صلاحية الاختبار بعد اجتيازه (دقائق)',
              en: 'A passed check lasts (minutes)',
            },
            help: {
              ar: 'كم دقيقة يبحث الزائر بحرية بعد اجتياز الاختبار. من 1 إلى 1440، الافتراضي 60.',
              en: 'Minutes a guest searches freely after passing the check. 1 to 1440, default 60.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 1,
            max: 1440,
          },
        ],
      },
      {
        id: 'coalescing',
        title: {
          ar: 'مشاركة البحث المتطابق',
          en: 'Shared identical searches',
        },
        description: {
          ar: 'بحثان متطابقان في الوقت نفسه يتشاركان طلبًا واحدًا.',
          en: 'Two identical searches at the same time share one supplier call.',
        },
        fields: [
          {
            key: 'searchCoalescing.enabled',
            label: {
              ar: 'دمج عمليات البحث المتطابقة',
              en: 'Share identical searches',
            },
            help: {
              ar: 'عمليات البحث المتطابقة الجارية في اللحظة نفسها تشترك في نداء واحد للمورد. مفعّل افتراضيًا.',
              en: 'Identical searches running at the same moment share one supplier call. On by default.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'searchCoalescing.scope',
            label: {
              ar: 'من يشترك في البحث',
              en: 'Who shares a search',
            },
            help: {
              ar: 'الزائر نفسه فقط (الافتراضي): نقرتان أو نافذتان للزائر نفسه تشتركان في النداء. الجميع: يشترك فيه زوار مختلفون أيضًا فتقل نداءات المورد أكثر، لكن المورد يقبل حجزًا واحدًا لكل بحث، فقد يجد المشتري الثاني من البحث المشترك أن الأجرة لم تعد متاحة ويحتاج إلى بحث جديد.',
              en: 'Same visitor only (default): a double click or two tabs of one visitor share the call. Everyone: different visitors share it too, which saves more supplier calls, but the supplier books each search once, so a second buyer from the same shared search may find the fare gone and have to search again.',
            },
            type: 'enum',
            value: 'visitor',
            default: 'visitor',
            options: [
              {
                value: 'visitor',
                label: {
                  ar: 'الزائر نفسه فقط',
                  en: 'Same visitor only',
                },
              },
              {
                value: 'everyone',
                label: {
                  ar: 'الجميع',
                  en: 'Everyone',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'duplicates',
        title: {
          ar: 'الحجوزات المكررة',
          en: 'Duplicate bookings',
        },
        description: {
          ar: 'المسافر نفسه على الرحلة نفسها في حجز آخر حي.',
          en: 'The same traveller on the same flight in another live booking.',
        },
        fields: [
          {
            key: 'duplicateBooking.policy',
            label: {
              ar: 'عند وجود المسافر في حجز آخر',
              en: 'When a traveller is already booked',
            },
            help: {
              ar: 'إيقاف: لا يحدث شيء. تحذير (الافتراضي): يظهر تحذير عند إدخال المسافرين. منع: يُرفض حجز العميل قبل الدفع. الموظف الذي يحجز لعميل يتلقى التحذير فقط دائمًا.',
              en: 'Off: nothing happens. Warn (default): a warning when the passengers are entered. Block: the customer is refused before paying. Staff booking for a customer only ever get the warning.',
            },
            type: 'enum',
            value: 'block',
            default: 'warn',
            options: [
              {
                value: 'off',
                label: {
                  ar: 'إيقاف',
                  en: 'Off',
                },
              },
              {
                value: 'warn',
                label: {
                  ar: 'تحذير',
                  en: 'Warn',
                },
              },
              {
                value: 'block',
                label: {
                  ar: 'منع',
                  en: 'Block',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'holds',
        title: {
          ar: 'إساءة الحجز المؤقت',
          en: 'Hold abuse',
        },
        description: {
          ar: 'مهلة تبريد بعد ترك حجوزات مؤقتة وسقف المقاعد المحجوزة.',
          en: 'Cool-down after abandoned holds and a cap on held seats.',
        },
        fields: [
          {
            key: 'holdAbuse.abandonmentWindowDays',
            label: {
              ar: 'نافذة الحجوزات المؤقتة المتروكة (أيام)',
              en: 'Look back for expired holds (days)',
            },
            help: {
              ar: 'كم يومًا يُنظر إلى الوراء لعدّ الحجوزات المؤقتة التي انتهت دون دفع. من 1 إلى 365، الافتراضي 30.',
              en: 'Days looked back to count the holds that expired without payment. 1 to 365, default 30.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'days',
            min: 1,
            max: 365,
          },
          {
            key: 'holdAbuse.maxExpiredUnpaidInWindow',
            label: {
              ar: 'أقصى حجوزات مؤقتة متروكة',
              en: 'Most expired unpaid holds',
            },
            help: {
              ar: 'بعد هذا العدد من الحجوزات المؤقتة المنتهية دون دفع خلال النافذة، لا يستطيع العميل الحجز المؤقت حتى انتهاء مدة الإيقاف. الافتراضي 3. أوقفه لإلغاء الإيقاف.',
              en: 'After this many holds expired unpaid in the look-back period, the customer cannot hold a fare until the pause ends. Default 3. Switch it off for no pause.',
            },
            type: 'integer',
            value: 3,
            default: 3,
            min: 1,
            max: 100,
          },
          {
            key: 'holdAbuse.cooldownDays',
            label: {
              ar: 'مدة إيقاف الحجز المؤقت (أيام)',
              en: 'Hold pause (days)',
            },
            help: {
              ar: 'أيام بلا حجز مؤقت بعد بلوغ الحد، تُحسب من آخر حجز منتهٍ. من 1 إلى 90، الافتراضي 7.',
              en: 'Days without holds once the limit is reached, counted from the last expired hold. 1 to 90, default 7.',
            },
            type: 'duration',
            value: 7,
            default: 7,
            unit: 'days',
            min: 1,
            max: 90,
          },
          {
            key: 'holdAbuse.maxHeldSeatsPerFlight',
            label: {
              ar: 'أقصى مقاعد محجوزة مؤقتًا على الرحلة',
              en: 'Most held seats per flight',
            },
            help: {
              ar: 'مجموع المقاعد التي تحجزها كل الحجوزات المؤقتة الحية على رحلة واحدة (رقم الرحلة والتاريخ). موقوف افتراضيًا (بلا حد).',
              en: 'Seats all live holds together may keep on one flight (flight number and date). Off by default (no cap).',
            },
            type: 'integer',
            value: null,
            default: null,
            nullable: true,
            min: 1,
            max: 1000,
          },
        ],
      },
    ],
  },
];

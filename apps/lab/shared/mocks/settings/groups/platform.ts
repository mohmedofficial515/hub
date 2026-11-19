// Settings groups of the "platform" section.
// Generated from the backend groups (src/modules/settings/groups) and the dashboard dictionaries; see audit.md
// in dashboard/settings. Fields with `proposed: true` are NOT in the real API (audit proposals, P0/P1).

import type { SettingsGroup } from '../types';

export const PLATFORM_GROUPS: SettingsGroup[] = [
  {
    key: 'platform',
    section: 'platform',
    icon: 'Globe',
    title: {
      ar: 'المنصّة',
      en: 'Platform',
    },
    summary: {
      ar: 'العلامة والتواصل واللغات ومفاتيح المنتجات',
      en: 'Brand, contact, locales and product switches',
    },
    description: {
      ar: 'العلامة التجارية وبيانات التواصل واللغات والعملة والمنطقة الزمنية ومفاتيح المنتجات والروابط القانونية. انتقل وضع الصيانة إلى مجموعة مستقلة.',
      en: 'Brand, contact details, locales, currency, time zone, product switches and legal links. Maintenance mode moved to its own group.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 9,
    schemaVersion: 3,
    updatedAt: '2026-11-18T07:40:00.000Z',
    updatedBy: 'Sara Haddad',
    subsections: [
      {
        id: 'brand',
        title: {
          ar: 'العلامة والتواصل',
          en: 'Brand & contact',
        },
        description: {
          ar: 'الاسم الظاهر للعملاء وقنوات الدعم.',
          en: 'The name customers see and the support channels.',
        },
        fields: [
          {
            key: 'siteName',
            label: {
              ar: 'اسم الموقع',
              en: 'Site name',
            },
            help: {
              ar: 'اسم العلامة التجارية الذي يظهر في الرسائل وفي الواجهة.',
              en: 'Brand name shown in emails and in the interface.',
            },
            type: 'string',
            value: 'Goteav',
            default: 'Goteav',
            min: 1,
            max: 80,
          },
          {
            key: 'supportEmail',
            label: {
              ar: 'بريد الدعم',
              en: 'Support email',
            },
            help: {
              ar: 'عنوان البريد الإلكتروني لدعم العملاء.',
              en: 'Customer support email address.',
            },
            type: 'string',
            value: 'support@goteav.com',
            default: 'support@goteav.com',
            format: 'email',
            max: 254,
          },
          {
            key: 'supportPhone',
            label: {
              ar: 'هاتف الدعم',
              en: 'Support phone',
            },
            help: {
              ar: 'رقم هاتف دعم العملاء بالصيغة الدولية (E.164). أوقفه لإخفائه.',
              en: 'Customer support phone number in international format (E.164). Switch it off to hide it.',
            },
            type: 'string',
            value: '+905321234567',
            default: null,
            nullable: true,
            format: 'phone',
            max: 32,
          },
          {
            key: 'supportWhatsapp',
            label: {
              ar: 'واتساب الدعم',
              en: 'Support WhatsApp',
            },
            help: {
              ar: 'رقم واتساب دعم العملاء بالصيغة الدولية (E.164). أوقفه لإخفائه.',
              en: 'Customer support WhatsApp number in international format (E.164). Switch it off to hide it.',
            },
            type: 'string',
            value: '+905321234567',
            default: null,
            nullable: true,
            format: 'phone',
            max: 32,
          },
        ],
      },
      {
        id: 'region',
        title: {
          ar: 'اللغات والمنطقة',
          en: 'Languages & region',
        },
        description: {
          ar: 'اللغة والعملة الافتراضيتان والمنطقة الزمنية للتقارير.',
          en: 'Default language and currency, and the time zone of reports.',
        },
        fields: [
          {
            key: 'defaultLocale',
            label: {
              ar: 'اللغة الافتراضية',
              en: 'Default language',
            },
            help: {
              ar: 'اللغة المستخدمة عندما لا يحدد الزائر لغة مفضلة.',
              en: 'Language used when the visitor has no preference.',
            },
            type: 'enum',
            value: 'ar',
            default: 'en',
            options: [
              {
                value: 'en',
                label: {
                  ar: 'الإنجليزية',
                  en: 'English',
                },
              },
              {
                value: 'ar',
                label: {
                  ar: 'العربية',
                  en: 'Arabic',
                },
              },
              {
                value: 'tr',
                label: {
                  ar: 'التركية',
                  en: 'Turkish',
                },
              },
            ],
          },
          {
            key: 'supportedLocales',
            label: {
              ar: 'اللغات المتاحة',
              en: 'Offered languages',
            },
            help: {
              ar: 'اللغات التي يعرضها تطبيق الويب، ويجب أن تشمل اللغة الافتراضية.',
              en: 'Languages offered by the web app. They must include the default language.',
            },
            type: 'multi-enum',
            value: ['ar', 'en', 'tr'],
            default: ['en', 'ar', 'tr'],
            options: [
              {
                value: 'en',
                label: {
                  ar: 'الإنجليزية',
                  en: 'English',
                },
              },
              {
                value: 'ar',
                label: {
                  ar: 'العربية',
                  en: 'Arabic',
                },
              },
              {
                value: 'tr',
                label: {
                  ar: 'التركية',
                  en: 'Turkish',
                },
              },
            ],
          },
          {
            key: 'defaultCurrency',
            label: {
              ar: 'العملة الافتراضية',
              en: 'Default currency',
            },
            help: {
              ar: 'عملة العرض المستخدمة قبل أن يختار الزائر عملة.',
              en: 'Display currency used before the visitor picks one.',
            },
            type: 'string',
            value: 'USD',
            default: 'USD',
            format: 'currency',
          },
          {
            key: 'timezone',
            label: {
              ar: 'المنطقة الزمنية',
              en: 'Time zone',
            },
            help: {
              ar: 'المنطقة الزمنية المستخدمة في تقارير التشغيل وشاشات الإدارة.',
              en: 'Time zone used for operational reports and admin screens.',
            },
            type: 'string',
            value: 'Europe/Istanbul',
            default: 'UTC',
            format: 'timezone',
          },
        ],
      },
      {
        id: 'features',
        title: {
          ar: 'المنتجات والميزات',
          en: 'Products & features',
        },
        description: {
          ar: 'مفاتيح رئيسية: إيقاف منتج هنا يخفيه في كل مكان.',
          en: 'Master switches: a product switched off here is hidden everywhere.',
        },
        fields: [
          {
            key: 'features.flights',
            label: {
              ar: 'الطيران',
              en: 'Flights',
            },
            help: {
              ar: 'البحث عن الرحلات وحجزها.',
              en: 'Flight search and booking.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'features.hotels',
            label: {
              ar: 'الفنادق',
              en: 'Hotels',
            },
            help: {
              ar: 'البحث عن الفنادق وحجزها (لاحقًا).',
              en: 'Hotel search and booking (coming later).',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'features.esim',
            label: {
              ar: 'الشرائح الإلكترونية (eSIM)',
              en: 'eSIM',
            },
            help: {
              ar: 'بيع الشرائح الإلكترونية (لاحقًا).',
              en: 'eSIM sales (coming later).',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'features.packages',
            label: {
              ar: 'الباقات',
              en: 'Packages',
            },
            help: {
              ar: 'الباقات السياحية (لاحقًا).',
              en: 'Travel packages (coming later).',
            },
            type: 'boolean',
            value: false,
            default: false,
          },
          {
            key: 'features.wallet',
            label: {
              ar: 'المحفظة',
              en: 'Wallet',
            },
            help: {
              ar: 'محفظة العميل: الأرصدة والشحن والمبالغ المستردة.',
              en: 'Customer wallet: balances, top-ups and refunds.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'features.loyalty',
            label: {
              ar: 'الولاء',
              en: 'Loyalty',
            },
            help: {
              ar: 'برنامج نقاط الولاء.',
              en: 'Loyalty points programme.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'features.guestCheckout',
            label: {
              ar: 'الحجز كضيف',
              en: 'Guest checkout',
            },
            help: {
              ar: 'السماح بالحجز دون حساب.',
              en: 'Allow bookings without an account.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
        ],
      },
      {
        id: 'legal',
        title: {
          ar: 'الروابط والبيانات القانونية',
          en: 'Legal links & details',
        },
        description: {
          ar: 'صفحات الشروط والخصوصية وما يفرضه القانون التركي على وكالات السفر.',
          en: 'Terms and privacy pages, and what Turkish law requires of a travel agency.',
        },
        fields: [
          {
            key: 'legal.termsUrl',
            label: {
              ar: 'رابط شروط الاستخدام',
              en: 'Terms of use link',
            },
            help: {
              ar: 'العنوان الكامل لصفحة شروط الاستخدام، ويبدأ بـ http أو https.',
              en: 'Full http(s) address of the terms of use page.',
            },
            type: 'url',
            value: 'https://goteav.com/ar/terms',
            default: null,
            nullable: true,
          },
          {
            key: 'legal.privacyUrl',
            label: {
              ar: 'رابط سياسة الخصوصية',
              en: 'Privacy policy link',
            },
            help: {
              ar: 'العنوان الكامل لصفحة سياسة الخصوصية، ويبدأ بـ http أو https.',
              en: 'Full http(s) address of the privacy policy page.',
            },
            type: 'url',
            value: 'https://goteav.com/ar/privacy',
            default: null,
            nullable: true,
          },
          {
            key: 'legal.kvkkNoticeUrl',
            label: {
              ar: 'رابط نص الإفصاح (KVKK)',
              en: 'KVKK notice link',
            },
            help: {
              ar: 'نص الإفصاح عن معالجة البيانات الشخصية (aydınlatma metni) الذي يفرضه قانون KVKK أينما تُجمع البيانات: التسجيل والدفع وخزنة الوثائق.',
              en: 'The personal-data notice (aydınlatma metni) KVKK requires wherever data is collected: sign-up, checkout and the documents vault.',
            },
            type: 'url',
            value: null,
            default: null,
            nullable: true,
            proposed: true,
            proposalId: 'S-01',
            priority: 'P0',
            needsBackend: true,
          },
          {
            key: 'company.tursabLicenseNo',
            label: {
              ar: 'رقم ترخيص TÜRSAB',
              en: 'TÜRSAB licence number',
            },
            help: {
              ar: 'رقم وثيقة وكالة السفر الذي يجب أن يظهر في تذييل الموقع والتذاكر والرسائل. يُؤكَّد مع المحاسب أو المحامي.',
              en: 'The travel agency document number that must appear in the site footer, tickets and e-mails. Confirm with the accountant or lawyer.',
            },
            type: 'string',
            value: null,
            default: null,
            nullable: true,
            max: 32,
            proposed: true,
            proposalId: 'S-02',
            priority: 'P0',
            needsBackend: true,
          },
          {
            key: 'legal.refundPolicyUrl',
            label: {
              ar: 'رابط سياسة الإلغاء والاسترداد',
              en: 'Cancellation & refund policy link',
            },
            help: {
              ar: 'يظهر في صفحة الدفع وبجانب عرض «الإلغاء المجاني خلال نافذة الإلغاء».',
              en: 'Linked from checkout and next to the void-window offer.',
            },
            type: 'url',
            value: null,
            default: null,
            nullable: true,
            proposed: true,
            proposalId: 'S-03',
            priority: 'P1',
            needsBackend: true,
          },
          {
            key: 'legal.cookiePolicyUrl',
            label: {
              ar: 'رابط سياسة ملفات الارتباط',
              en: 'Cookie policy link',
            },
            help: {
              ar: 'يفتحه شريط الموافقة على ملفات الارتباط والتحليلات.',
              en: 'Opened from the cookie and analytics consent banner.',
            },
            type: 'url',
            value: null,
            default: null,
            nullable: true,
            proposed: true,
            proposalId: 'S-04',
            priority: 'P1',
            needsBackend: true,
          },
        ],
      },
    ],
  },
  {
    key: 'maintenance',
    section: 'platform',
    icon: 'Construction',
    title: {
      ar: 'وضع الصيانة',
      en: 'Maintenance mode',
    },
    summary: {
      ar: 'إغلاق المنصة أو أقسام منها في نافذة مجدولة',
      en: 'Close the platform or some areas in a scheduled window',
    },
    description: {
      ar: 'وضع الصيانة: المنصة كلها أو أقسام مختارة، نافذة مجدولة، شريط إعلان مسبق، فترة تصريف، قائمة عناوين الفريق وروابط التجاوز. يُطبَّق فعليًا (503 مع Retry-After).',
      en: 'Maintenance mode: whole platform or chosen areas, scheduled window, advance banner, drain period, team allow-list and bypass links. Enforced (503 with Retry-After).',
    },
    kind: 'server',
    inDashboard: false,
    approval: 'none',
    version: 2,
    schemaVersion: 1,
    updatedAt: '2026-11-18T08:05:00.000Z',
    updatedBy: 'Omar Kaya',
    masterSwitch: 'enabled',
    enabled: false,
    attention: {
      ar: 'مجموعة جديدة (18-11-2026): لوحة التحكم لا تعرضها بعد ولا توجد لها نصوص عربية، فلا تُغيَّر إلا عبر الـ API. نافذة صيانة مجدولة ليلة 20 نوفمبر.',
      en: 'New group (2026-11-18): the dashboard does not list it yet and it has no Arabic texts, so it can only be changed through the API. A window is scheduled for the night of 20 November.',
    },
    subsections: [
      {
        id: 'switch',
        title: {
          ar: 'التشغيل والنطاق',
          en: 'Switch & scope',
        },
        description: {
          ar: 'من دون نافذة يعني التشغيل «الآن حتى الإيقاف».',
          en: 'Without a window, on means "now, until switched off".',
        },
        fields: [
          {
            key: 'enabled',
            label: {
              ar: 'تشغيل وضع الصيانة',
              en: 'Maintenance mode on',
            },
            help: {
              ar: 'المفتاح الرئيسي. من دون نافذة زمنية يبدأ فورًا ويستمر حتى إيقافه.',
              en: 'Master switch. With no window it starts at once and lasts until switched off.',
            },
            type: 'boolean',
            value: false,
            default: false,
            risk: 'high',
          },
          {
            key: 'scope',
            label: {
              ar: 'النطاق',
              en: 'Scope',
            },
            help: {
              ar: '«المنصة كلها» تغلق موقع العملاء كله، و«أقسام محددة» تغلق الأقسام المختارة فقط.',
              en: '"Whole platform" closes the whole customer site; "Chosen areas" only the selected areas.',
            },
            type: 'enum',
            value: 'areas',
            default: 'full',
            options: [
              {
                value: 'full',
                label: {
                  ar: 'المنصة كلها',
                  en: 'Whole platform',
                },
              },
              {
                value: 'areas',
                label: {
                  ar: 'أقسام محددة',
                  en: 'Chosen areas',
                },
              },
            ],
          },
          {
            key: 'areas',
            label: {
              ar: 'الأقسام المغلقة',
              en: 'Closed areas',
            },
            help: {
              ar: 'تُغلق عندما يكون النطاق «أقسام محددة»؛ قسم واحد على الأقل.',
              en: 'Closed when the scope is "Chosen areas"; at least one.',
            },
            type: 'multi-enum',
            value: ['payments', 'wallet'],
            default: [],
            options: [
              {
                value: 'flights_search',
                label: {
                  ar: 'البحث عن الرحلات',
                  en: 'Flight search',
                },
              },
              {
                value: 'flights_booking',
                label: {
                  ar: 'حجز الرحلات',
                  en: 'Flight booking',
                },
              },
              {
                value: 'bookings_manage',
                label: {
                  ar: 'إدارة الحجوزات',
                  en: 'Manage bookings',
                },
              },
              {
                value: 'payments',
                label: {
                  ar: 'المدفوعات',
                  en: 'Payments',
                },
              },
              {
                value: 'wallet',
                label: {
                  ar: 'المحفظة',
                  en: 'Wallet',
                },
              },
              {
                value: 'loyalty',
                label: {
                  ar: 'الولاء',
                  en: 'Loyalty',
                },
              },
              {
                value: 'accounts',
                label: {
                  ar: 'الحسابات',
                  en: 'Accounts',
                },
              },
              {
                value: 'sign_in',
                label: {
                  ar: 'تسجيل الدخول',
                  en: 'Sign-in',
                },
              },
              {
                value: 'support',
                label: {
                  ar: 'الدعم',
                  en: 'Support',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'schedule',
        title: {
          ar: 'الجدولة والإعلان',
          en: 'Schedule & announcement',
        },
        description: {
          ar: 'متى تبدأ الصيانة وتنتهي، ومتى يظهر الإعلان ويتوقف الدفع.',
          en: 'When maintenance starts and ends, when the banner shows and checkouts stop.',
        },
        fields: [
          {
            key: 'window.startsAt',
            label: {
              ar: 'بداية النافذة',
              en: 'Window start',
            },
            help: {
              ar: 'فارغ = تبدأ فور التشغيل.',
              en: 'Empty = starts as soon as it is switched on.',
            },
            type: 'string',
            value: '2026-11-20T23:00:00+03:00',
            default: null,
            nullable: true,
            format: 'datetime',
          },
          {
            key: 'window.endsAt',
            label: {
              ar: 'نهاية النافذة',
              en: 'Window end',
            },
            help: {
              ar: 'نهاية تلقائية؛ تحدد العدّ التنازلي وقيمة Retry-After.',
              en: 'Automatic end; drives the countdown and Retry-After.',
            },
            type: 'string',
            value: '2026-11-21T01:30:00+03:00',
            default: null,
            nullable: true,
            format: 'datetime',
          },
          {
            key: 'announce.enabled',
            label: {
              ar: 'إعلان مسبق',
              en: 'Advance banner',
            },
            help: {
              ar: 'إظهار شريط للعملاء قبل البداية المجدولة.',
              en: 'Show a banner to customers before a scheduled start.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'announce.leadMinutes',
            label: {
              ar: 'مدة الإعلان قبل البداية',
              en: 'Banner lead time',
            },
            help: {
              ar: 'كم دقيقة قبل البداية يظهر الشريط.',
              en: 'Minutes before the start at which the banner appears.',
            },
            type: 'duration',
            value: 1440,
            default: 1440,
            unit: 'minutes',
            min: 0,
            max: 10080,
          },
          {
            key: 'drainMinutes',
            label: {
              ar: 'فترة التصريف',
              en: 'Drain period',
            },
            help: {
              ar: 'دقائق قبل البداية يتوقف فيها إنشاء عمليات الدفع وشحن المحفظة الجديدة.',
              en: 'Minutes before the start during which new checkouts and top-ups stop.',
            },
            type: 'duration',
            value: 30,
            default: 15,
            unit: 'minutes',
            min: 0,
            max: 180,
          },
          {
            key: 'retryAfterMinutes',
            label: {
              ar: 'إعادة المحاولة بعد',
              en: 'Retry after',
            },
            help: {
              ar: 'قيمة Retry-After للطلب المرفوض حين لا توجد نهاية مجدولة.',
              en: 'Retry-After of a refused request when there is no scheduled end.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'minutes',
            min: 1,
            max: 1440,
          },
        ],
      },
      {
        id: 'message',
        title: {
          ar: 'رسالة العملاء',
          en: 'Customer message',
        },
        description: {
          ar: 'العنوان والنص على صفحة الصيانة وفي الإشعارات. فارغ = نص عام.',
          en: 'Heading and body of the maintenance page and notices. Empty = generic text.',
        },
        fields: [
          {
            key: 'title.ar',
            label: {
              ar: 'العنوان (عربي)',
              en: 'Title (Arabic)',
            },
            help: {
              ar: 'عنوان الصفحة والإشعار بالعربية.',
              en: 'Page and notice heading in Arabic.',
            },
            type: 'string',
            value: 'صيانة مجدولة للمدفوعات',
            default: null,
            nullable: true,
            max: 500,
          },
          {
            key: 'title.en',
            label: {
              ar: 'العنوان (إنجليزي)',
              en: 'Title (English)',
            },
            help: {
              ar: 'مطلوب عند تعبئة العنوان؛ التركية تعود إليه عند غيابها.',
              en: 'Required once a title is set; Turkish falls back to it.',
            },
            type: 'string',
            value: 'Scheduled payments maintenance',
            default: null,
            nullable: true,
            max: 500,
          },
          {
            key: 'message.ar',
            label: {
              ar: 'النص (عربي)',
              en: 'Message (Arabic)',
            },
            help: {
              ar: 'نص الصفحة بالعربية.',
              en: 'Page body in Arabic.',
            },
            type: 'string',
            value: 'نحدّث نظام الدفع. البحث والحجوزات الحالية تعمل كالمعتاد.',
            default: null,
            nullable: true,
            max: 500,
          },
          {
            key: 'message.en',
            label: {
              ar: 'النص (إنجليزي)',
              en: 'Message (English)',
            },
            help: {
              ar: 'نص الصفحة بالإنجليزية.',
              en: 'Page body in English.',
            },
            type: 'string',
            value: 'We are upgrading payments. Search and existing bookings work as usual.',
            default: null,
            nullable: true,
            max: 500,
          },
          {
            key: 'showContacts',
            label: {
              ar: 'إظهار بيانات التواصل',
              en: 'Show contacts',
            },
            help: {
              ar: 'هاتف الدعم وواتساب والبريد من مجموعة «المنصّة» على صفحة الصيانة.',
              en: 'Support phone, WhatsApp and e-mail from Platform on the maintenance page.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'statusUrl',
            label: {
              ar: 'رابط المتابعة',
              en: 'Status link',
            },
            help: {
              ar: 'رابط اختياري «تابع التحديثات» (صفحة حالة أو حساب تواصل).',
              en: 'Optional "follow updates" link (status page, social account).',
            },
            type: 'url',
            value: null,
            default: null,
            nullable: true,
          },
        ],
      },
      {
        id: 'team',
        title: {
          ar: 'وصول الفريق',
          en: 'Team access',
        },
        description: {
          ar: 'كيف يصل الفريق إلى المنصة الحقيقية أثناء الصيانة.',
          en: 'How the team reaches the real platform during maintenance.',
        },
        fields: [
          {
            key: 'allowAdmins',
            label: {
              ar: 'إبقاء لوحة التحكم متاحة',
              en: 'Keep the dashboard reachable',
            },
            help: {
              ar: 'إيقافه يتطلب عنوانًا واحدًا على الأقل في القائمة، وإلا لن يستطيع أحد إنهاء الصيانة.',
              en: 'Off needs at least one allow-list entry, or nobody could end the maintenance.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'allowlist',
            label: {
              ar: 'عناوين مسموحة',
              en: 'Allowed addresses',
            },
            help: {
              ar: 'عناوين IP أو نطاقات CIDR ترى المنصة الحقيقية أثناء الصيانة (حتى 100).',
              en: 'IP addresses or CIDR ranges that see the real platform during maintenance (up to 100).',
            },
            type: 'string-list',
            value: ['85.105.12.40 — مكتب إسطنبول'],
            default: [],
            format: 'cidr',
            structured: true,
          },
          {
            key: 'bypassTokens',
            label: {
              ar: 'روابط التجاوز',
              en: 'Bypass links',
            },
            help: {
              ar: 'تُدار من /admin/maintenance/bypass-tokens فقط؛ يُخزَّن بصمة الرمز لا الرمز.',
              en: 'Managed through /admin/maintenance/bypass-tokens only; only a hash of the token is stored.',
            },
            type: 'string-list',
            value: ['QA — ••••9f2a — ينتهي 21-11-2026'],
            default: [],
            readOnly: true,
            structured: true,
          },
        ],
      },
    ],
  },
  {
    key: 'security',
    section: 'platform',
    icon: 'ShieldCheck',
    title: {
      ar: 'الأمان',
      en: 'Security',
    },
    summary: {
      ar: 'القفل وقائمة عناوين IP وتسجيل الدخول',
      en: 'Lockout, IP allow-list and sign-in',
    },
    description: {
      ar: 'قفل الحساب بعد محاولات الدخول الفاشلة، وتنبيهات تسجيل الدخول، وقائمة عناوين IP المسموح بها للإدارة، ومدة صلاحية الدعوات، ومدة الاحتفاظ بسجل الدخول، وطرق الدخول بالهاتف أو برابط سحري، ونافذة إعادة التحقق الأخيرة.',
      en: 'Failed sign-in lockout, sign-in alerts, the admin IP allow-list, invitation lifetimes, sign-in history retention, the phone and magic-link sign-in methods and the recent-authentication window.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'second-approver',
    version: 14,
    schemaVersion: 2,
    updatedAt: '2026-11-12T16:20:00.000Z',
    updatedBy: 'Sara Haddad',
    subsections: [
      {
        id: 'staff',
        title: {
          ar: 'وصول الموظفين',
          en: 'Staff access',
        },
        description: {
          ar: 'من أين وكيف يدخل الموظفون إلى لوحة التحكم.',
          en: 'Where from and how staff sign in to the dashboard.',
        },
        fields: [
          {
            key: 'adminIpAllowlist.enabled',
            label: {
              ar: 'مفعّلة',
              en: 'Enabled',
            },
            help: {
              ar: 'عند التشغيل، لا تصل إلى منطقة الإدارة إلا الشبكات أدناه.',
              en: 'When on, only the networks below can reach the admin area.',
            },
            type: 'boolean',
            value: false,
            default: false,
            control: 'security',
            risk: 'high',
          },
          {
            key: 'adminIpAllowlist.cidrs',
            label: {
              ar: 'الشبكات',
              en: 'Networks',
            },
            help: {
              ar: 'الشبكات (CIDR) المسموح لها بالوصول إلى منطقة الإدارة.',
              en: 'Networks (CIDR) allowed to reach the admin area.',
            },
            type: 'string-list',
            value: ['85.105.12.0/24'],
            default: [],
            control: 'security',
            format: 'cidr',
            max: 50,
          },
          {
            key: 'loginAlerts.admin',
            label: {
              ar: 'الموظفون',
              en: 'Staff',
            },
            help: {
              ar: 'سياسة التنبيه لدخول الموظفين.',
              en: 'Alert policy for staff sign-ins.',
            },
            type: 'enum',
            value: 'always',
            default: 'always',
            options: [
              {
                value: 'always',
                label: {
                  ar: 'دائمًا',
                  en: 'Always',
                },
              },
              {
                value: 'new_device_or_location',
                label: {
                  ar: 'جهاز أو موقع جديد',
                  en: 'New device or location',
                },
              },
              {
                value: 'off',
                label: {
                  ar: 'إيقاف',
                  en: 'Off',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'invites.ttlHours',
            label: {
              ar: 'رابط الدعوة (ساعات)',
              en: 'Invitation link (hours)',
            },
            help: {
              ar: 'عدد الساعات التي يبقى فيها رابط دعوة الموظف صالحًا.',
              en: 'Hours a staff invitation link stays usable.',
            },
            type: 'duration',
            value: 72,
            default: 48,
            unit: 'hours',
            min: 1,
            max: 336,
          },
          {
            key: 'invites.temporaryPasswordTtlHours',
            label: {
              ar: 'كلمة المرور المؤقتة (ساعات)',
              en: 'Temporary password (hours)',
            },
            help: {
              ar: 'عدد الساعات التي تبقى فيها كلمة المرور المؤقتة صالحة.',
              en: 'Hours a generated temporary password stays usable.',
            },
            type: 'duration',
            value: 24,
            default: 24,
            unit: 'hours',
            min: 1,
            max: 336,
          },
          {
            key: 'adminSession.idleTimeoutMinutes',
            label: {
              ar: 'مهلة الخمول في لوحة التحكم',
              en: 'Dashboard idle timeout',
            },
            help: {
              ar: 'دقائق بلا نشاط قبل أن يُطلب من الموظف تسجيل الدخول من جديد. اليوم متغير بيئة (ADMIN_IDLE_TIMEOUT) لا يتغير إلا بنشر جديد.',
              en: 'Minutes without activity before a staff member must sign in again. Today an environment variable (ADMIN_IDLE_TIMEOUT) that needs a deploy to change.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'minutes',
            min: 5,
            max: 240,
            control: 'security',
            proposed: true,
            proposalId: 'S-06',
            priority: 'P1',
            needsBackend: true,
          },
          {
            key: 'adminSession.maxSessionHours',
            label: {
              ar: 'أقصى مدة لجلسة الموظف',
              en: 'Longest staff session',
            },
            help: {
              ar: 'أطول مدة تبقى فيها جلسة الموظف صالحة مهما كان نشاطه. اليوم متغير بيئة (ADMIN_REFRESH_TTL).',
              en: 'How long a staff sign-in lives at most, whatever the activity. Today an environment variable (ADMIN_REFRESH_TTL).',
            },
            type: 'duration',
            value: 12,
            default: 12,
            unit: 'hours',
            min: 1,
            max: 72,
            control: 'security',
            proposed: true,
            proposalId: 'S-07',
            priority: 'P1',
            needsBackend: true,
          },
        ],
      },
      {
        id: 'lockout',
        title: {
          ar: 'القفل بعد المحاولات الفاشلة',
          en: 'Failed-login lockout',
        },
        description: {
          ar: 'يحمي الحسابات من تخمين كلمة المرور.',
          en: 'Protects accounts from password guessing.',
        },
        fields: [
          {
            key: 'lockout.enabled',
            label: {
              ar: 'مفعّل',
              en: 'Enabled',
            },
            help: {
              ar: 'المفتاح الرئيسي لقفل الحساب بعد محاولات الدخول الفاشلة.',
              en: 'Master switch for the failed sign-in lockout.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
            risk: 'high',
          },
          {
            key: 'lockout.maxFailures',
            label: {
              ar: 'المحاولات الفاشلة قبل القفل',
              en: 'Failures before lockout',
            },
            help: {
              ar: 'عدد المحاولات الفاشلة خلال النافذة الزمنية قبل قفل الحساب.',
              en: 'Failed attempts inside the window before the account is locked.',
            },
            type: 'integer',
            value: 5,
            default: 5,
            min: 1,
            max: 50,
            control: 'security',
          },
          {
            key: 'lockout.windowMinutes',
            label: {
              ar: 'النافذة (دقائق)',
              en: 'Window (minutes)',
            },
            help: {
              ar: 'عدد الدقائق التي تُحتسب خلالها المحاولات الفاشلة.',
              en: 'Minutes the failed attempts are counted over.',
            },
            type: 'duration',
            value: 15,
            default: 15,
            unit: 'minutes',
            min: 1,
            max: 1440,
            control: 'security',
          },
          {
            key: 'lockout.backoffMinutes',
            label: {
              ar: 'مدة القفل في كل مرة (بالدقائق)',
              en: 'Lock duration each time (minutes)',
            },
            help: {
              ar: 'كم دقيقة يبقى الحساب مقفلًا. الرقم الأول لأول قفل، والثاني للقفل الذي يليه، وهكذا؛ فتطول مدة القفل كلما تكرّرت المحاولات الفاشلة. إذا تكرّر القفل بعد آخر رقم تُستخدم آخر مدة.',
              en: 'How many minutes the account stays locked. The first number is for the first lock, the second for the next one, and so on, so repeated failures lock for longer. Locks after the last number reuse the last duration.',
            },
            type: 'string-list',
            value: [1, 5, 15, 60],
            default: [1, 5, 15, 60],
            control: 'security',
            itemType: 'integer',
            itemUnit: 'minutes',
          },
          {
            key: 'lockout.resetAfterHours',
            label: {
              ar: 'إعادة الضبط بعد (ساعات)',
              en: 'Reset after (hours)',
            },
            help: {
              ar: 'عدد ساعات الهدوء التي يُعاد بعدها ضبط عداد الإخفاقات وخطوات القفل.',
              en: 'Quiet hours after which the failure counter and the lockout steps reset.',
            },
            type: 'duration',
            value: 12,
            default: 12,
            unit: 'hours',
            min: 1,
            max: 168,
            control: 'security',
          },
          {
            key: 'lockout.notify',
            label: {
              ar: 'إبلاغ المالك بالبريد',
              en: 'Email the owner',
            },
            help: {
              ar: 'مراسلة مالك الحساب بالبريد عند قفل حسابه.',
              en: 'Email the account owner when their account is locked.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
        ],
      },
      {
        id: 'customer',
        title: {
          ar: 'طرق دخول العملاء',
          en: 'Customer sign-in methods',
        },
        description: {
          ar: 'الدخول برمز الهاتف أو برابط البريد، وتنبيهات الدخول.',
          en: 'Sign-in by phone code or e-mailed link, and login alerts.',
        },
        fields: [
          {
            key: 'phoneLogin.enabled',
            label: {
              ar: 'مفعّل',
              en: 'Enabled',
            },
            help: {
              ar: 'يمكن للعملاء الذين لديهم هاتف موثّق تسجيل الدخول برمز لمرة واحدة.',
              en: 'Customers with a verified phone may sign in with a one-time code.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'phoneLogin.signupEnabled',
            label: {
              ar: 'التسجيل بالهاتف',
              en: 'Sign-up by phone',
            },
            help: {
              ar: 'يمكن لرقم غير مسجّل يُثبت ملكيته برمز أن ينشئ حسابًا (ويبقى البريد الإلكتروني مطلوبًا).',
              en: 'An unknown number confirmed with a code may create an account (an email is still required).',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'magicLink.enabled',
            label: {
              ar: 'مفعّل',
              en: 'Enabled',
            },
            help: {
              ar: 'يمكن للعملاء طلب رابط دخول لمرة واحدة بالبريد الإلكتروني.',
              en: 'Customers may ask for a one-time sign-in link by email.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'magicLink.ttlMinutes',
            label: {
              ar: 'صلاحية الرابط (دقائق)',
              en: 'Link lifetime (minutes)',
            },
            help: {
              ar: 'عدد الدقائق التي يبقى فيها رابط الدخول صالحًا (ويُستخدم مرة واحدة في كل الأحوال).',
              en: 'Minutes a sign-in link stays usable (it works once either way).',
            },
            type: 'duration',
            value: 15,
            default: 15,
            unit: 'minutes',
            min: 5,
            max: 60,
            control: 'security',
          },
          {
            key: 'loginAlerts.customer',
            label: {
              ar: 'العملاء',
              en: 'Customers',
            },
            help: {
              ar: 'سياسة التنبيه لدخول العملاء.',
              en: 'Alert policy for customer sign-ins.',
            },
            type: 'enum',
            value: 'new_device_or_location',
            default: 'new_device_or_location',
            options: [
              {
                value: 'always',
                label: {
                  ar: 'دائمًا',
                  en: 'Always',
                },
              },
              {
                value: 'new_device_or_location',
                label: {
                  ar: 'جهاز أو موقع جديد',
                  en: 'New device or location',
                },
              },
              {
                value: 'off',
                label: {
                  ar: 'إيقاف',
                  en: 'Off',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'recentAuthMinutes',
            label: {
              ar: 'نافذة الدخول الحديث (دقائق)',
              en: 'Recent sign-in window (minutes)',
            },
            help: {
              ar: 'عدد الدقائق التي يُعد فيها الدخول حديثًا للإجراءات الحساسة (كلمة المرور والبريد والحسابات المرتبطة والوثائق).',
              en: 'Minutes a sign-in counts as recent for sensitive actions (password, email, linked accounts, documents).',
            },
            type: 'duration',
            value: 10,
            default: 10,
            unit: 'minutes',
            min: 1,
            max: 60,
            control: 'security',
          },
        ],
      },
      {
        id: 'history',
        title: {
          ar: 'سجل الدخول',
          en: 'Login history',
        },
        description: {
          ar: 'مدة الاحتفاظ بسجل الدخول وضبط مهمة التنظيف.',
          en: 'How long the login history is kept and how the prune job runs.',
        },
        fields: [
          {
            key: 'loginHistory.successRetentionDays',
            label: {
              ar: 'عمليات الدخول الناجحة (أيام)',
              en: 'Successful sign-ins (days)',
            },
            help: {
              ar: 'عدد أيام الاحتفاظ بسجل الدخول الناجح قبل حذفه.',
              en: 'Days a successful sign-in row is kept before it is deleted.',
            },
            type: 'duration',
            value: 365,
            default: 365,
            unit: 'days',
            min: 1,
            max: 3650,
          },
          {
            key: 'loginHistory.failureRetentionDays',
            label: {
              ar: 'عمليات الدخول الفاشلة (أيام)',
              en: 'Failed sign-ins (days)',
            },
            help: {
              ar: 'عدد أيام الاحتفاظ بسجل الدخول الفاشل قبل حذفه.',
              en: 'Days a failed sign-in row is kept before it is deleted.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'days',
            min: 1,
            max: 3650,
          },
          {
            key: 'loginHistory.pruneBatchSize',
            label: {
              ar: 'حجم دفعة الحذف',
              en: 'Delete batch size',
            },
            help: {
              ar: 'عدد الصفوف التي تحذفها عملية حذف واحدة قبل تكرارها.',
              en: 'Rows one delete removes before it repeats.',
            },
            type: 'integer',
            value: 5000,
            default: 5000,
            min: 100,
            max: 50000,
            advanced: true,
          },
          {
            key: 'loginHistory.pruneMaxBatches',
            label: {
              ar: 'الدفعات في كل تشغيل',
              en: 'Batches per run',
            },
            help: {
              ar: 'عدد الدفعات التي يحذفها تشغيل التنظيف الواحد قبل أن يتوقف ويستأنف في المرة التالية.',
              en: 'Batches one cleanup run may delete before it stops and resumes next time.',
            },
            type: 'integer',
            value: 200,
            default: 200,
            min: 1,
            max: 10000,
            advanced: true,
          },
        ],
      },
    ],
  },
  {
    key: 'verification_policy',
    section: 'platform',
    icon: 'UserCheck',
    title: {
      ar: 'سياسة التحقّق',
      en: 'Verification policy',
    },
    summary: {
      ar: 'التحقق من البريد والهاتف',
      en: 'E-mail and phone verification',
    },
    description: {
      ar: 'متطلبات التحقق من البريد الإلكتروني والهاتف وإعدادات رموز التحقق لمرة واحدة.',
      en: 'E-mail and phone verification requirements and one-time code settings.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'second-approver',
    version: 6,
    schemaVersion: 2,
    updatedAt: '2026-11-09T21:55:00.000Z',
    updatedBy: 'System (defaults)',
    subsections: [
      {
        id: 'booking',
        title: {
          ar: 'شروط الحجز',
          en: 'Booking requirements',
        },
        description: {
          ar: 'ما يجب التحقق منه قبل الدفع.',
          en: 'What must be verified before paying.',
        },
        fields: [
          {
            key: 'requireVerifiedEmailForBooking',
            label: {
              ar: 'يلزم بريد موثّق للحجز',
              en: 'Verified email needed to book',
            },
            help: {
              ar: 'يجب على العملاء المسجّلين توثيق بريدهم الإلكتروني قبل دفع ثمن الحجز.',
              en: 'Registered customers must verify their email before paying for a booking.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'guestEmailOtpRequired',
            label: {
              ar: 'تأكيد بريد الضيف',
              en: 'Guests confirm their email',
            },
            help: {
              ar: 'يجب على الضيوف تأكيد بريدهم الإلكتروني برمز لمرة واحدة قبل الدفع.',
              en: 'Guests must confirm their email with a one-time code before checkout.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'phoneVerificationEnabled',
            label: {
              ar: 'التحقق من الهاتف',
              en: 'Phone verification',
            },
            help: {
              ar: 'إتاحة التحقق من الهاتف (رمز عبر واتساب أو رسالة نصية) في صفحة الحساب.',
              en: 'Offer phone verification (a WhatsApp or SMS code) in the account area.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'phoneVerificationRequiredForBooking',
            label: {
              ar: 'يلزم هاتف موثّق للحجز',
              en: 'Verified phone needed to book',
            },
            help: {
              ar: 'اشتراط رقم هاتف موثّق قبل دفع ثمن الحجز.',
              en: 'Require a verified phone number before paying for a booking.',
            },
            type: 'boolean',
            value: false,
            default: false,
            control: 'security',
          },
          {
            key: 'adminTotpRequired',
            label: {
              ar: 'تطبيق المصادقة للموظفين',
              en: 'Authenticator app for staff',
            },
            help: {
              ar: 'يجب على الموظفين إعداد تطبيق مصادقة (TOTP) قبل استخدام لوحة التحكم.',
              en: 'Staff must set up an authenticator app (TOTP) before using the dashboard.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
            risk: 'high',
            note: {
              ar: 'إعداد للموظفين يُعرض أيضًا في «الأمان › وصول الموظفين».',
              en: 'A staff setting, also shown under Security › Staff access.',
            },
          },
        ],
      },
      {
        id: 'otp',
        title: {
          ar: 'الرموز لمرة واحدة',
          en: 'One-time codes',
        },
        description: {
          ar: 'طول الرمز ومدته والمحاولات وحدود الإرسال.',
          en: 'Code length, lifetime, attempts and sending limits.',
        },
        fields: [
          {
            key: 'otp.length',
            label: {
              ar: 'طول الرمز',
              en: 'Code length',
            },
            help: {
              ar: 'عدد أرقام رمز التحقق.',
              en: 'Digits in a one-time code.',
            },
            type: 'integer',
            value: 6,
            default: 6,
            min: 4,
            max: 8,
            control: 'security',
          },
          {
            key: 'otp.ttlSeconds',
            label: {
              ar: 'صلاحية الرمز (ثوانٍ)',
              en: 'Code lifetime (seconds)',
            },
            help: {
              ar: 'عدد الثواني التي يبقى فيها الرمز صالحًا بعد إرساله.',
              en: 'Seconds a code stays valid after it is sent.',
            },
            type: 'duration',
            value: 300,
            default: 300,
            unit: 'seconds',
            min: 0,
            max: 2592000,
            control: 'security',
          },
          {
            key: 'otp.maxAttempts',
            label: {
              ar: 'المحاولات الخاطئة المسموح بها',
              en: 'Wrong attempts allowed',
            },
            help: {
              ar: 'عدد المحاولات الخاطئة قبل إبطال الرمز.',
              en: 'Wrong attempts before the code stops working.',
            },
            type: 'integer',
            value: 5,
            default: 5,
            min: 1,
            max: 10,
            control: 'security',
          },
          {
            key: 'otp.resendCooldownSeconds',
            label: {
              ar: 'الانتظار قبل إعادة الإرسال (ثوانٍ)',
              en: 'Wait before resending (seconds)',
            },
            help: {
              ar: 'عدد الثواني التي ينتظرها المستخدم قبل طلب رمز آخر.',
              en: 'Seconds a user must wait before asking for another code.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'seconds',
            min: 0,
            max: 2592000,
            control: 'security',
          },
          {
            key: 'otp.dailyLimit',
            label: {
              ar: 'الحد اليومي',
              en: 'Daily limit',
            },
            help: {
              ar: 'أقصى عدد من الرموز يُرسل إلى بريد أو رقم هاتف واحد في اليوم.',
              en: 'Most codes sent to one email address or phone number per day.',
            },
            type: 'integer',
            value: 10,
            default: 10,
            min: 1,
            max: 100,
            control: 'security',
          },
        ],
      },
      {
        id: 'channel',
        title: {
          ar: 'قناة رموز الهاتف',
          en: 'Phone code channel',
        },
        description: {
          ar: 'واتساب اليوم؛ الرسائل النصية تحتاج مزوّدًا غير موصول بعد.',
          en: 'WhatsApp today; SMS needs a provider that is not connected yet.',
        },
        fields: [
          {
            key: 'phoneOtpChannel',
            label: {
              ar: 'قناة رمز الهاتف',
              en: 'Phone code channel',
            },
            help: {
              ar: 'القناة المستخدمة لإرسال رموز التحقق من الهاتف.',
              en: 'Channel used to send phone verification codes.',
            },
            type: 'enum',
            value: 'WHATSAPP',
            default: 'WHATSAPP',
            options: [
              {
                value: 'WHATSAPP',
                label: {
                  ar: 'واتساب',
                  en: 'WhatsApp',
                },
              },
              {
                value: 'SMS',
                label: {
                  ar: 'رسالة نصية',
                  en: 'SMS',
                },
              },
            ],
          },
          {
            key: 'phoneOtpFallbackChannel',
            label: {
              ar: 'بديل رمز إعادة التحقق',
              en: 'Re-authentication fallback',
            },
            help: {
              ar: 'إعادة التحقق فقط: إلى أين يذهب رمز مخصّص للهاتف عندما يتعذر واتساب: البريد الإلكتروني للحساب أو لا شيء. التحقق من الهاتف لا يعود إلى البريد أبدًا.',
              en: "Re-authentication only: where a code meant for the phone goes when WhatsApp is unavailable: the account's e-mail or nowhere. Phone verification never falls back.",
            },
            type: 'enum',
            value: 'EMAIL',
            default: 'EMAIL',
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'بريد الحساب',
                  en: "The account's e-mail",
                },
              },
              {
                value: 'NONE',
                label: {
                  ar: 'بلا بديل',
                  en: 'No fallback',
                },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'abuse_protection',
    section: 'platform',
    icon: 'ShieldBan',
    title: {
      ar: 'الحماية من الإساءة',
      en: 'Abuse protection',
    },
    summary: {
      ar: 'حدود رموز الهاتف وCAPTCHA وكلمات المرور المسرّبة وتجديد الجلسات',
      en: 'Phone code limits, CAPTCHA, breached passwords and session renewals',
    },
    description: {
      ar: 'حدود رموز التحقق المرسلة إلى الهواتف والدول المسموح لها باستلامها، ورفض كلمات المرور المسرّبة، وتحدي CAPTCHA عند تسجيل دخول العملاء، والرد على التسجيل ببريد مستخدم من قبل، وعدد مرات تجديد الجهاز لجلسته. كل حقل هنا إعداد أمني يحتاج موافقة مسؤول ثانٍ ما لم يغيّره المالك.',
      en: "Limits on verification codes sent to phones and the countries allowed to receive them, refusal of breached passwords, the CAPTCHA on customer sign-in, the answer to a sign-up with an e-mail already in use and how often a device may renew its session. Every field here is a security setting that needs a second admin's approval unless the owner changes it.",
    },
    kind: 'server',
    inDashboard: true,
    approval: 'second-approver',
    version: 5,
    schemaVersion: 2,
    updatedAt: '2026-11-03T11:10:00.000Z',
    updatedBy: 'Omar Kaya',
    subsections: [
      {
        id: 'otp',
        title: {
          ar: 'ميزانية رموز الهاتف',
          en: 'Phone code budgets',
        },
        description: {
          ar: 'يمنع استنزاف رسائل واتساب والرسائل النصية.',
          en: 'Stops SMS / WhatsApp code pumping.',
        },
        fields: [
          {
            key: 'otpBudget.enabled',
            label: {
              ar: 'تطبيق الحدود',
              en: 'Apply the limits',
            },
            help: {
              ar: 'تطبيق حدود رموز الرسائل النصية وواتساب أدناه.',
              en: 'Apply the SMS / WhatsApp code limits below.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'otpBudget.phoneDailyLimit',
            label: {
              ar: 'الحد اليومي لكل الأرقام',
              en: 'Daily limit, all numbers',
            },
            help: {
              ar: 'أقصى عدد من رموز الرسائل النصية وواتساب يُرسل خلال 24 ساعة متحركة لكل الأرقام معًا. عند بلوغه تتوقف رموز الهاتف حتى تتقدّم النافذة. الافتراضي 2000.',
              en: 'Most SMS / WhatsApp codes sent in a rolling 24 hours, all numbers together. Past it, phone codes stop until the window moves on. Default 2,000.',
            },
            type: 'integer',
            value: 2000,
            default: 2000,
            min: 1,
            max: 1000000,
            control: 'security',
          },
          {
            key: 'otpBudget.perCallingCodeDailyLimit',
            label: {
              ar: 'الحد اليومي لكل مفتاح دولة',
              en: 'Daily limit per country code',
            },
            help: {
              ar: 'أقصى عدد من رموز الرسائل النصية وواتساب يُرسل خلال 24 ساعة متحركة إلى مفتاح دولة واحد (+90 أو +966 مثلًا). الافتراضي 300.',
              en: 'Most SMS / WhatsApp codes sent in a rolling 24 hours to one country calling code (+90, +966, ...). Default 300.',
            },
            type: 'integer',
            value: 300,
            default: 300,
            min: 1,
            max: 1000000,
            control: 'security',
          },
          {
            key: 'otpBudget.alertAtPercent',
            label: {
              ar: 'التنبيه عند (% من الحد)',
              en: 'Alert at (% of a limit)',
            },
            help: {
              ar: 'يُنبَّه فريق التشغيل عند استهلاك هذه النسبة من أي حد، ثم مرة أخرى عند نفاده. الافتراضي 80.',
              en: 'Operations are alerted once this share of a limit is used, and again when it runs out. Default 80.',
            },
            type: 'number',
            value: 80,
            default: 80,
            min: 1,
            max: 100,
            unit: 'percent',
            step: 1,
            control: 'security',
          },
          {
            key: 'otpCountries.mode',
            label: {
              ar: 'طريقة التطبيق',
              en: 'Mode',
            },
            help: {
              ar: 'الكل: كل الدول تستلم الرموز. سماح: الدول المدرجة فقط. رفض: كل الدول عدا المدرجة.',
              en: 'All: every country receives codes. Allow: only the listed countries. Deny: every country except the listed ones.',
            },
            type: 'enum',
            value: 'all',
            default: 'all',
            control: 'security',
            options: [
              {
                value: 'all',
                label: {
                  ar: 'كل الدول',
                  en: 'Every country',
                },
              },
              {
                value: 'allow',
                label: {
                  ar: 'الدول المدرجة فقط',
                  en: 'Only the listed countries',
                },
              },
              {
                value: 'deny',
                label: {
                  ar: 'كل الدول عدا المدرجة',
                  en: 'Every country except the listed',
                },
              },
            ],
          },
          {
            key: 'otpCountries.countries',
            label: {
              ar: 'الدول',
              en: 'Countries',
            },
            help: {
              ar: 'رموز الدول بحرفين (TR، SA، ...) التي تنطبق عليها الطريقة.',
              en: 'Two-letter country codes (TR, SA, ...) the mode applies to.',
            },
            type: 'string-list',
            value: [],
            default: [],
            control: 'security',
            format: 'country',
          },
        ],
      },
      {
        id: 'signup',
        title: {
          ar: 'كلمات المرور والتسجيل',
          en: 'Passwords & sign-up',
        },
        description: {
          ar: 'كلمات المرور المسرّبة والرد على تسجيل ببريد مستخدم.',
          en: 'Breached passwords and the answer to a sign-up with a taken e-mail.',
        },
        fields: [
          {
            key: 'breachedPasswords.enabled',
            label: {
              ar: 'رفض كلمات المرور المسرّبة',
              en: 'Refuse breached passwords',
            },
            help: {
              ar: 'تُرفض كلمة المرور الجديدة إن ظهرت في تسريبات بيانات عامة (يُفحص ذلك عند تعيينها فقط، لا عند الدخول). لا يغادر الخادم إلا أول خمسة أحرف من بصمة كلمة المرور، وإن تعذّر الوصول إلى خدمة الفحص تُقبل كلمة المرور. موقوف افتراضيًا.',
              en: "A new password found in public data breaches is refused (checked when it is set, never at sign-in). Only the first five characters of the password's fingerprint leave the server; when the check service cannot be reached the password is accepted. Off by default.",
            },
            type: 'boolean',
            value: true,
            default: false,
            control: 'security',
          },
          {
            key: 'signup.existingEmail',
            label: {
              ar: 'الرد على البريد المستخدم',
              en: 'Answer to an e-mail in use',
            },
            help: {
              ar: 'رد موحّد (موصى به، قرار المالك): يرى كل من يسجّل ببريد إلكتروني الرسالة نفسها «تحقق من بريدك»، سواء كان البريد جديدًا أو له حساب، فلا يكشف النموذج من لديه حساب، ويصل إلى صاحب الحساب بريد يخبره بالمحاولة. رد صريح: السلوك القديم، يُقال إن البريد مستخدم، ويدخل صاحب البريد الجديد فورًا.',
              en: 'Same answer (recommended, owner decision): every e-mail sign-up sees the same "check your inbox" message, whether the address is new or already has an account, so the form reveals nobody, and the account owner gets an e-mail about the attempt. Explicit answer: the old behaviour; a taken address is reported as taken and a new one is signed in at once.',
            },
            type: 'enum',
            value: 'generic',
            default: 'generic',
            options: [
              {
                value: 'generic',
                label: {
                  ar: 'رد موحّد (موصى به)',
                  en: 'Same answer (recommended)',
                },
              },
              {
                value: 'explicit',
                label: {
                  ar: 'رد صريح (السلوك القديم)',
                  en: 'Explicit answer (old behaviour)',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'signup.notifyExistingOwner',
            label: {
              ar: 'إبلاغ صاحب الحساب',
              en: 'Tell the account owner',
            },
            help: {
              ar: 'يُرسل بريد إلى صاحب الحساب الموجود عندما يحاول أحد التسجيل ببريده.',
              en: 'E-mail the owner of an existing account when somebody tries to sign up with its address.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
        ],
      },
      {
        id: 'captcha',
        title: {
          ar: 'اختبار CAPTCHA',
          en: 'CAPTCHA',
        },
        description: {
          ar: 'Cloudflare Turnstile على دخول العملاء وتسجيلهم.',
          en: 'Cloudflare Turnstile on customer sign-in and sign-up.',
        },
        fields: [
          {
            key: 'captcha.enabled',
            label: {
              ar: 'طلب CAPTCHA بعد الفشل المتكرر',
              en: 'Ask for a CAPTCHA after repeated failures',
            },
            help: {
              ar: 'يُطلب CAPTCHA عند دخول العميل أو تسجيله من عنوان IP فشل كثيرًا. موقوف افتراضيًا.',
              en: 'Customer sign-in and sign-up from an IP that failed too often must pass a CAPTCHA. Off by default.',
            },
            type: 'boolean',
            value: true,
            default: false,
            control: 'security',
          },
          {
            key: 'captcha.failuresPerIpBeforeChallenge',
            label: {
              ar: 'محاولات فاشلة قبل التحدي',
              en: 'Failures before the challenge',
            },
            help: {
              ar: 'عدد محاولات الدخول الفاشلة من عنوان IP واحد خلال النافذة قبل طلب CAPTCHA. الافتراضي 5.',
              en: 'Failed sign-ins from one IP in the window before a CAPTCHA is asked. Default 5.',
            },
            type: 'integer',
            value: 5,
            default: 5,
            min: 1,
            max: 1000,
            control: 'security',
          },
          {
            key: 'captcha.windowMinutes',
            label: {
              ar: 'مدة العدّ (دقائق)',
              en: 'Counting window (minutes)',
            },
            help: {
              ar: 'عدد الدقائق التي تُحسب فيها المحاولات الفاشلة لعنوان IP. الافتراضي 15.',
              en: 'Minutes the failed sign-ins of an IP are counted over. Default 15.',
            },
            type: 'duration',
            value: 15,
            default: 15,
            unit: 'minutes',
            min: 1,
            max: 1440,
            control: 'security',
          },
          {
            key: 'captcha.alwaysOnSignup',
            label: {
              ar: 'CAPTCHA عند كل تسجيل جديد',
              en: 'CAPTCHA on every sign-up',
            },
            help: {
              ar: 'يُطلب CAPTCHA عند كل تسجيل حساب عميل جديد، أيًا كان سلوك عنوان IP.',
              en: 'Ask for a CAPTCHA on every new customer sign-up, whatever the IP did.',
            },
            type: 'boolean',
            value: false,
            default: false,
            control: 'security',
          },
        ],
      },
      {
        id: 'refresh',
        title: {
          ar: 'حدود تجديد الجلسة',
          en: 'Session refresh limits',
        },
        description: {
          ar: 'كم مرة يُجدَّد رمز الدخول في الدقيقة.',
          en: 'How often a sign-in token may be refreshed per minute.',
        },
        fields: [
          {
            key: 'refreshLimits.perSessionPerMinute',
            label: {
              ar: 'لكل جهاز في الدقيقة',
              en: 'Per device, per minute',
            },
            help: {
              ar: 'أقصى عدد لتجديد جلسة جهاز واحد في الدقيقة. التطبيق يجدّد مرة كل عمر رمز وصول مع بضع إعادات؛ وبعد الحد يُرفض الطلب (429، أعد المحاولة لاحقًا). من 1 إلى 60، الافتراضي 10. لا يمكن أن يتجاوز سقف عنوان IP.',
              en: 'Most session renewals of one signed-in device in a minute. The app renews once per access token lifetime plus a few retries; past the limit the call is refused (429, try again later). 1 to 60, default 10. Cannot be above the per-IP ceiling.',
            },
            type: 'integer',
            value: 10,
            default: 10,
            min: 1,
            max: 60,
            control: 'security',
          },
          {
            key: 'refreshLimits.perIpPerMinute',
            label: {
              ar: 'لكل عنوان IP في الدقيقة',
              en: 'Per IP address, per minute',
            },
            help: {
              ar: 'سقف تجديد الجلسات من عنوان IP واحد في الدقيقة لكل الأجهزة معًا. هواتف كثيرة تتشارك عنوان IP واحدًا لشركة الاتصالات، فاجعله أعلى بكثير من حد الجهاز. من 1 إلى 1000، الافتراضي 300.',
              en: 'Ceiling on session renewals from one IP address in a minute, all devices together. Many phones share one mobile carrier IP, so keep it well above the per-device limit. 1 to 1,000, default 300.',
            },
            type: 'integer',
            value: 300,
            default: 300,
            min: 1,
            max: 1000,
            control: 'security',
          },
        ],
      },
    ],
  },
  {
    key: 'security_alerts',
    section: 'platform',
    icon: 'BellRing',
    title: {
      ar: 'تنبيهات موجات الأمان',
      en: 'Security wave alerts',
    },
    summary: {
      ar: 'تنبيه الفريق عند موجة دخول فاشل أو قفل أو رفض',
      en: 'Alert on waves of failed sign-ins, lockouts and refusals',
    },
    description: {
      ar: 'متى يُنبَّه فريق التشغيل إلى موجة من محاولات دخول الموظفين الفاشلة، أو أقفال حسابات الموظفين، أو الإجراءات المرفوضة لموظف واحد. كل حقل هنا إعداد أمني: تغييره يحتاج موافقة مسؤول ثانٍ ما لم يجرِه المالك.',
      en: "When operations are alerted to a wave of failed staff sign-ins, staff account lockouts or refused actions of one staff member. Every field here is a security setting: changing it needs a second admin's approval unless the owner makes the change.",
    },
    kind: 'server',
    inDashboard: true,
    approval: 'second-approver',
    version: 3,
    schemaVersion: 1,
    updatedAt: '2026-10-30T09:00:00.000Z',
    updatedBy: 'Sara Haddad',
    masterSwitch: 'enabled',
    enabled: true,
    subsections: [
      {
        id: 'thresholds',
        title: {
          ar: 'العتبات',
          en: 'Thresholds',
        },
        description: {
          ar: 'تذهب التنبيهات إلى قنوات «تنبيهات التشغيل» في الإشعارات.',
          en: 'Alerts go to the ops alert channels in Notifications.',
        },
        fields: [
          {
            key: 'enabled',
            label: {
              ar: 'مراقبة موجات الأمان',
              en: 'Watch for security waves',
            },
            help: {
              ar: 'يراقب النظام موجات الفشل والرفض وينبّه فريق التشغيل. إيقافه يُسكت هذه التنبيهات كلها.',
              en: 'Watch for waves of failures and refusals and alert operations. Off silences all of these alerts.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
          },
          {
            key: 'windowMinutes',
            label: {
              ar: 'مدة نافذة العدّ (دقائق)',
              en: 'Counting window (minutes)',
            },
            help: {
              ar: 'عدد الدقائق التي يغطيها كل عدّ. تعمل المهمة كل 15 دقيقة. الافتراضي 60.',
              en: 'Minutes each count covers. The job runs every 15 minutes. Default 60.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 5,
            max: 1440,
            control: 'security',
          },
          {
            key: 'failedAdminLogins',
            label: {
              ar: 'محاولات دخول فاشلة إلى لوحة التحكم',
              en: 'Failed dashboard sign-ins',
            },
            help: {
              ar: 'عدد محاولات الدخول الفاشلة إلى لوحة التحكم خلال النافذة (لكل حسابات الموظفين والعناوين غير المعروفة معًا) الذي يرسل تنبيه موجة دخول فاشل. الافتراضي 30.',
              en: 'Failed dashboard sign-ins in the window (all staff accounts and unknown addresses together) that raise the failed sign-in wave alert. Default 30.',
            },
            type: 'integer',
            value: 20,
            default: 30,
            min: 1,
            max: 100000,
            control: 'security',
          },
          {
            key: 'lockedStaffAccounts',
            label: {
              ar: 'حسابات موظفين مقفلة',
              en: 'Staff accounts locked',
            },
            help: {
              ar: 'عدد حسابات الموظفين التي تُقفل خلال النافذة بسبب المحاولات الفاشلة قبل إرسال تنبيه موجة أقفال. الافتراضي 3.',
              en: 'Staff accounts locked out in the window by failed sign-ins before the lockout wave alert is raised. Default 3.',
            },
            type: 'integer',
            value: 3,
            default: 3,
            min: 1,
            max: 100000,
            control: 'security',
          },
          {
            key: 'refusalsPerActor',
            label: {
              ar: 'إجراءات مرفوضة لموظف واحد',
              en: 'Refused actions of one staff member',
            },
            help: {
              ar: 'عدد الإجراءات التي يرفضها النظام لموظف واحد خلال النافذة (لعدم وجود الصلاحية أو لأن العملية محظورة) قبل إرسال تنبيه موجة رفض. الافتراضي 10.',
              en: 'Actions the platform refuses for one staff member in the window (missing permission or a blocked operation) before the refusal wave alert is raised. Default 10.',
            },
            type: 'integer',
            value: 10,
            default: 10,
            min: 1,
            max: 100000,
            control: 'security',
          },
        ],
      },
    ],
  },
];

// Personal preferences (this browser): the appearance, tables and notifications tabs.
// Generated from the backend groups (src/modules/settings/groups) and the dashboard dictionaries; see audit.md
// in dashboard/settings. Fields with `proposed: true` are NOT in the real API (audit proposals, P0/P1).

import type { PreferenceTab } from './types';

export const PREFERENCES: PreferenceTab[] = [
  {
    id: 'appearance',
    icon: 'Palette',
    title: {
      ar: 'المظهر',
      en: 'Appearance',
    },
    description: {
      ar: 'تخصيص الألوان والخطوط',
      en: 'Colors & fonts customization',
    },
    fields: [
      {
        key: 'theme',
        label: {
          ar: 'الوضع',
          en: 'Mode',
        },
        help: {
          ar: 'اختر الوضع الفاتح أو الداكن',
          en: 'Choose light or dark mode',
        },
        type: 'enum',
        value: 'light',
        default: 'light',
        options: [
          {
            value: 'light',
            label: {
              ar: 'فاتح',
              en: 'Light',
            },
          },
          {
            value: 'dark',
            label: {
              ar: 'داكن',
              en: 'Dark',
            },
          },
          {
            value: 'system',
            label: {
              ar: 'حسب الجهاز',
              en: 'System',
            },
          },
        ],
        proposedOptions: ['system'],
        proposalId: 'S-28',
        priority: 'P1',
        note: {
          ar: 'المتجر يقبل «حسب الجهاز» لكن الواجهة لا تعرضه اليوم.',
          en: 'The store accepts "system" but the tab does not offer it today.',
        },
      },
      {
        key: 'colorTheme',
        label: {
          ar: 'اللون الأساسي',
          en: 'Primary Color',
        },
        help: {
          ar: 'تخصيص اللون الرئيسي لواجهة المنصة',
          en: 'Customize the main color for the dashboard interface',
        },
        type: 'enum',
        value: 'teal',
        default: 'teal',
        options: [
          {
            value: 'teal',
            label: {
              ar: 'تركواز',
              en: 'Teal',
            },
            hint: '#2e7a82',
          },
          {
            value: 'emerald',
            label: {
              ar: 'أخضر لوحة التحكم',
              en: 'Emerald',
            },
            hint: 'oklch(0.52 0.1 162)',
          },
          {
            value: 'blue',
            label: {
              ar: 'أزرق ملكي',
              en: 'Royal blue',
            },
            hint: 'oklch(0.5 0.13 255)',
          },
          {
            value: 'rose',
            label: {
              ar: 'عنّابي',
              en: 'Burgundy',
            },
            hint: 'oklch(0.52 0.15 12)',
          },
          {
            value: 'violet',
            label: {
              ar: 'برقوقي',
              en: 'Plum',
            },
            hint: 'oklch(0.5 0.14 305)',
          },
          {
            value: 'orange',
            label: {
              ar: 'برونزي',
              en: 'Bronze',
            },
            hint: 'oklch(0.54 0.11 62)',
          },
          {
            value: 'indigo',
            label: {
              ar: 'نيلي',
              en: 'Indigo',
            },
            hint: 'oklch(0.46 0.15 274)',
          },
          {
            value: 'custom',
            label: {
              ar: 'مخصص',
              en: 'Custom',
            },
          },
        ],
      },
      {
        key: 'customColor',
        label: {
          ar: 'مخصص',
          en: 'Custom',
        },
        help: {
          ar: 'الكود اللوني',
          en: 'Hex value',
        },
        type: 'string',
        value: '',
        default: '',
        format: 'hex',
      },
      {
        key: 'sidebarCustomBg',
        label: {
          ar: 'تخصيص لون الشريط الجانبي',
          en: 'Custom sidebar color',
        },
        help: {
          ar: 'خصّص لون خلفية الشريط الجانبي بشكل مستقل عن اللون الأساسي.',
          en: 'Customize the sidebar background color independently of the primary color.',
        },
        type: 'boolean',
        value: false,
        default: false,
      },
      {
        key: 'sidebarBgColor',
        label: {
          ar: 'لون الشريط الجانبي',
          en: 'Sidebar Color',
        },
        help: {
          ar: 'خصّص لون خلفية الشريط الجانبي بشكل مستقل عن اللون الأساسي.',
          en: 'Customize the sidebar background color independently of the primary color.',
        },
        type: 'string',
        value: '#1e293b',
        default: '#1e293b',
        format: 'hex',
      },
      {
        key: 'layoutStyle',
        label: {
          ar: 'نمط الواجهة',
          en: 'Layout Style',
        },
        help: {
          ar: 'اختر النمط البصري المفضل لبطاقات وعناصر الواجهة',
          en: 'Choose your preferred visual style for cards and interface elements',
        },
        type: 'enum',
        value: 'floating',
        default: 'floating',
        options: [
          {
            value: 'modern',
            label: {
              ar: 'عصري',
              en: 'Modern',
            },
          },
          {
            value: 'classic',
            label: {
              ar: 'كلاسيكي',
              en: 'Classic',
            },
          },
          {
            value: 'floating',
            label: {
              ar: 'عائم',
              en: 'Floating',
            },
          },
        ],
      },
      {
        key: 'layout',
        label: {
          ar: 'التخطيط',
          en: 'Layout',
        },
        help: {
          ar: 'تغيير تخطيط لوحة التحكم وعرض الشريط الجانبي',
          en: 'Change the dashboard layout and sidebar visibility',
        },
        type: 'enum',
        value: 'default',
        default: 'default',
        options: [
          {
            value: 'default',
            label: {
              ar: 'افتراضي',
              en: 'Default',
            },
          },
          {
            value: 'compact',
            label: {
              ar: 'مضغوط',
              en: 'Compact',
            },
          },
          {
            value: 'no-sidebar',
            label: {
              ar: 'بدون شريط جانبي',
              en: 'No Sidebar',
            },
          },
        ],
      },
      {
        key: 'language',
        label: {
          ar: 'اللغة',
          en: 'Language',
        },
        help: {
          ar: 'تغيير لغة العرض في النظام',
          en: 'Change the system display language',
        },
        type: 'enum',
        value: 'ar',
        default: 'ar',
        options: [
          {
            value: 'ar',
            label: {
              ar: 'العربية',
              en: 'Arabic',
            },
          },
          {
            value: 'en',
            label: {
              ar: 'الإنجليزية',
              en: 'English',
            },
          },
        ],
      },
      {
        key: 'fontFamily',
        label: {
          ar: 'الخط',
          en: 'Font',
        },
        help: {
          ar: 'اختر نوع الخط المفضل لواجهة المستخدم',
          en: 'Choose your preferred font for the user interface',
        },
        type: 'enum',
        value: 'Cairo',
        default: 'Cairo',
        options: [
          {
            value: 'Cairo',
            label: {
              ar: 'Cairo',
              en: 'Cairo',
            },
          },
          {
            value: 'IBM Plex Sans Arabic',
            label: {
              ar: 'IBM Plex Sans Arabic',
              en: 'IBM Plex Sans Arabic',
            },
          },
          {
            value: 'Noto Sans Arabic',
            label: {
              ar: 'Noto Sans Arabic',
              en: 'Noto Sans Arabic',
            },
          },
          {
            value: 'Tajawal',
            label: {
              ar: 'Tajawal',
              en: 'Tajawal',
            },
          },
        ],
      },
      {
        key: 'fontSize',
        label: {
          ar: 'حجم الخط',
          en: 'Font Size',
        },
        help: {
          ar: 'تكبير أو تصغير النصوص لسهولة القراءة',
          en: 'Increase or decrease text size for readability',
        },
        type: 'enum',
        value: 'base',
        default: 'base',
        options: [
          {
            value: 'sm',
            label: {
              ar: 'صغير',
              en: 'Small',
            },
            hint: '14px',
          },
          {
            value: 'base',
            label: {
              ar: 'عادي',
              en: 'Normal',
            },
            hint: '16px',
          },
          {
            value: 'lg',
            label: {
              ar: 'كبير',
              en: 'Large',
            },
            hint: '18px',
          },
          {
            value: 'xl',
            label: {
              ar: 'كبير جداً',
              en: 'X-Large',
            },
            hint: '20px',
          },
        ],
      },
    ],
  },
  {
    id: 'tables',
    icon: 'Table2',
    title: {
      ar: 'الجداول',
      en: 'Tables',
    },
    description: {
      ar: 'تفضيلات عرض البيانات',
      en: 'Data display preferences',
    },
    fields: [
      {
        key: 'tableSettings.density',
        label: {
          ar: 'كثافة العرض',
          en: 'Row Density',
        },
        help: {
          ar: 'تحكم في المسافات بين صفوف الجداول',
          en: 'Control the spacing between table rows',
        },
        type: 'enum',
        value: 'compact',
        default: 'standard',
        options: [
          {
            value: 'comfortable',
            label: {
              ar: 'مريح',
              en: 'Comfortable',
            },
          },
          {
            value: 'standard',
            label: {
              ar: 'عادي',
              en: 'Standard',
            },
          },
          {
            value: 'compact',
            label: {
              ar: 'مضغوط',
              en: 'Compact',
            },
          },
        ],
      },
      {
        key: 'tableSettings.pageSize',
        label: {
          ar: 'عدد الصفوف في الصفحة',
          en: 'Rows per Page',
        },
        help: {
          ar: 'الحد الافتراضي لعدد العناصر المعروضة',
          en: 'Default number of items shown per page',
        },
        type: 'enum',
        value: '25',
        default: '10',
        options: [
          {
            value: '5',
            label: {
              ar: '5',
              en: '5',
            },
          },
          {
            value: '10',
            label: {
              ar: '10',
              en: '10',
            },
          },
          {
            value: '25',
            label: {
              ar: '25',
              en: '25',
            },
          },
          {
            value: '50',
            label: {
              ar: '50',
              en: '50',
            },
          },
        ],
      },
      {
        key: 'tableSettings.striped',
        label: {
          ar: 'صفوف متناوبة',
          en: 'Striped Rows',
        },
        help: {
          ar: 'تلوين الصفوف بشكل متعاقب لسهولة القراءة',
          en: 'Alternating row colors for easier reading',
        },
        type: 'boolean',
        value: false,
        default: false,
      },
      {
        key: 'tableSettings.showColumnVisibility',
        label: {
          ar: 'إخفاء / إظهار الأعمدة',
          en: 'Column Visibility Toggle',
        },
        help: {
          ar: 'إظهار أو إخفاء أعمدة معينة في الجداول',
          en: 'Show or hide specific columns in tables',
        },
        type: 'boolean',
        value: true,
        default: true,
      },
      {
        key: 'tableSettings.showColumnResize',
        label: {
          ar: 'تغيير حجم الأعمدة',
          en: 'Column Resizing',
        },
        help: {
          ar: 'السماح بتعديل عرض الأعمدة عن طريق السحب',
          en: 'Allow resizing column widths by dragging',
        },
        type: 'boolean',
        value: true,
        default: true,
      },
      {
        key: 'tableSettings.showRowSelection',
        label: {
          ar: 'تحديد الصفوف',
          en: 'Row Selection',
        },
        help: {
          ar: 'تمكين تحديد صفوف الجدول لإجراء عمليات جماعية',
          en: 'Enable row selection for bulk actions',
        },
        type: 'boolean',
        value: true,
        default: true,
      },
      {
        key: 'tableSettings.showGlobalFilter',
        label: {
          ar: 'البحث العام',
          en: 'Global Search',
        },
        help: {
          ar: 'إظهار شريط بحث للبحث في جميع البيانات المعروضة',
          en: 'Show a search bar to search across all displayed data',
        },
        type: 'boolean',
        value: true,
        default: true,
      },
    ],
  },
  {
    id: 'notifications',
    icon: 'Bell',
    title: {
      ar: 'الإشعارات',
      en: 'Notifications',
    },
    description: {
      ar: 'تُحفظ على هذا المتصفح فقط ولا يقرؤها أي جزء اليوم؛ يُقترح دمجها مع تفضيلات صفحة الإشعارات وحفظها على الخادم لكل موظف (S-29).',
      en: 'Stored in this browser only and read by nothing today; proposed: merge with the notifications page preferences and store them per staff member on the server (S-29).',
    },
    fields: [
      {
        key: 'notifications.email',
        label: {
          ar: 'البريد الإلكتروني',
          en: 'Email',
        },
        help: {
          ar: 'استقبال الإشعارات عبر البريد الإلكتروني',
          en: 'Receive notifications via email',
        },
        type: 'boolean',
        value: true,
        default: true,
      },
      {
        key: 'notifications.push',
        label: {
          ar: 'إشعارات الدفع',
          en: 'Push Notifications',
        },
        help: {
          ar: 'إشعارات فورية على المتصفح والجهاز',
          en: 'Instant browser and device notifications',
        },
        type: 'boolean',
        value: true,
        default: true,
      },
      {
        key: 'notifications.inApp',
        label: {
          ar: 'داخل التطبيق',
          en: 'In-App',
        },
        help: {
          ar: 'عرض الإشعارات ضمن واجهة لوحة التحكم',
          en: 'Show notifications inside the dashboard',
        },
        type: 'boolean',
        value: true,
        default: true,
      },
      {
        key: 'notifications.sound',
        label: {
          ar: 'الصوت',
          en: 'Sound',
        },
        help: {
          ar: 'تشغيل صوت عند وصول إشعار جديد',
          en: 'Play a sound when a new notification arrives',
        },
        type: 'boolean',
        value: true,
        default: false,
      },
      {
        key: 'notifPrefs.categories',
        label: {
          ar: 'فئات الإشعارات',
          en: 'Notification categories',
        },
        help: {
          ar: 'الفئات التي تظهر في صندوق إشعاراتك. اليوم تُضبط من صفحة الإشعارات في مخزن منفصل.',
          en: 'Categories shown in your inbox. Today set from the notifications page, in a separate store.',
        },
        type: 'multi-enum',
        value: ['approvals', 'payments', 'flights', 'support', 'system'],
        default: ['approvals', 'payments', 'flights', 'support', 'system'],
        options: [
          {
            value: 'approvals',
            label: {
              ar: 'الموافقات',
              en: 'Approvals',
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
            value: 'flights',
            label: {
              ar: 'الطيران',
              en: 'Flights',
            },
          },
          {
            value: 'support',
            label: {
              ar: 'الدعم',
              en: 'Support',
            },
          },
          {
            value: 'system',
            label: {
              ar: 'النظام',
              en: 'System',
            },
          },
        ],
        note: {
          ar: 'مكرر من شريط صفحة الإشعارات (notifPrefs).',
          en: 'Duplicated from the notifications page sidebar (notifPrefs).',
        },
      },
    ],
  },
];

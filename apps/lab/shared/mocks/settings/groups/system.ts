// Settings groups of the "system" section.
// Generated from the backend groups (src/modules/settings/groups) and the dashboard dictionaries; see audit.md
// in dashboard/settings. Fields with `proposed: true` are NOT in the real API (audit proposals, P0/P1).

import type { SettingsGroup } from '../types';

export const SYSTEM_GROUPS: SettingsGroup[] = [
  {
    key: 'notifications',
    section: 'system',
    icon: 'Bell',
    title: {
      ar: 'الإشعارات',
      en: 'Notifications',
    },
    summary: {
      ar: 'القنوات والتنبيهات وإعادة المحاولة',
      en: 'Channels, alerts and retries',
    },
    description: {
      ar: 'قنوات كل حدث إشعار (البريد وواتساب والرسائل النصية وإشعارات التطبيق)، ومفاتيح المزوّدين، وتنبيهات الإدارة، وتنبيهات العمليات، وإعادة محاولات الإرسال.',
      en: 'Channels per notification event (email, WhatsApp, SMS and mobile app push), provider switches, admin alerts, operations alerts and delivery retries.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'second-approver',
    version: 26,
    schemaVersion: 7,
    updatedAt: '2026-11-16T20:45:00.000Z',
    updatedBy: 'Omar Kaya',
    attention: {
      ar: 'لا يوجد مزوّد رسائل نصية (SMS_PROVIDER=none)، ومع ذلك «رابط الدفع» مضبوط على الإرسال بالرسائل النصية: لن يصل شيء عبرها.',
      en: 'No SMS provider is connected (SMS_PROVIDER=none), yet "Payment link" is set to send by SMS: nothing will arrive that way.',
    },
    subsections: [
      {
        id: 'channels',
        title: {
          ar: 'القنوات',
          en: 'Channels',
        },
        description: {
          ar: 'المفاتيح الرئيسية لكل قناة واسم المرسل.',
          en: 'Master switch of each channel and the sender name.',
        },
        fields: [
          {
            key: 'providers.email.enabled',
            label: {
              ar: 'مفعّل',
              en: 'Enabled',
            },
            help: {
              ar: 'المفتاح الرئيسي للبريد الصادر.',
              en: 'Master switch for outgoing email.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'providers.email.fromName',
            label: {
              ar: 'اسم المرسل',
              en: 'Sender name',
            },
            help: {
              ar: 'اسم المرسل الظاهر للمستلم.',
              en: 'Sender name shown to the recipient.',
            },
            type: 'string',
            value: 'Goteav',
            default: 'Goteav',
            max: 80,
          },
          {
            key: 'providers.email.replyTo',
            label: {
              ar: 'عنوان الرد',
              en: 'Reply-to address',
            },
            help: {
              ar: 'عنوان البريد الذي تصل إليه الردود. أوقفه لاستخدام عنوان المرسل.',
              en: 'Email address replies go to. Switch it off to use the sender address.',
            },
            type: 'string',
            value: 'support@goteav.com',
            default: null,
            nullable: true,
            format: 'email',
          },
          {
            key: 'providers.whatsapp.enabled',
            label: {
              ar: 'مفعّل',
              en: 'Enabled',
            },
            help: {
              ar: 'المفتاح الرئيسي لرسائل واتساب.',
              en: 'Master switch for WhatsApp messages.',
            },
            type: 'boolean',
            value: true,
            default: true,
            risk: 'high',
          },
          {
            key: 'providers.whatsapp.pacing.perMinute',
            label: {
              ar: 'رسائل في الدقيقة',
              en: 'Messages a minute',
            },
            help: {
              ar: 'عدد رسائل واتساب المرسلة في الدقيقة من كل الخوادم (من 1 إلى 600).',
              en: 'WhatsApp messages sent per minute across every server (1 to 600).',
            },
            type: 'integer',
            value: 20,
            default: 20,
            min: 1,
            max: 600,
          },
          {
            key: 'providers.whatsapp.pacing.jitterPercent',
            label: {
              ar: 'التفاوت العشوائي (%)',
              en: 'Random spread (%)',
            },
            help: {
              ar: 'تفاوت عشوائي حول الفاصل بين رسالتين، بالنسبة المئوية (من 0 إلى 100).',
              en: 'Random spread around the gap between two messages, in percent (0 to 100).',
            },
            type: 'number',
            value: 40,
            default: 40,
            min: 0,
            max: 100,
            unit: 'percent',
            step: 5,
          },
          {
            key: 'providers.sms.enabled',
            label: {
              ar: 'مفعّل',
              en: 'Enabled',
            },
            help: {
              ar: 'المفتاح الرئيسي للرسائل النصية (يحتاج مزوّد رسائل نصية).',
              en: 'Master switch for SMS (needs an SMS provider).',
            },
            type: 'boolean',
            value: false,
            default: false,
            note: {
              ar: 'لا يوجد مزوّد رسائل نصية على الخادم بعد.',
              en: 'No SMS provider exists on the server yet.',
            },
          },
          {
            key: 'providers.push.enabled',
            label: {
              ar: 'مفعّل',
              en: 'Enabled',
            },
            help: {
              ar: 'المفتاح الرئيسي لإشعارات تطبيق الموبايل (Firebase Cloud Messaging). عند إيقافه لا يُرسل أي إشعار للتطبيق مهما كانت قنوات الأحداث. لا يُرسل شيء حتى يُضبط مفتاح حساب خدمة Firebase على الخادم.',
              en: 'Master switch for push messages to the mobile app (Firebase Cloud Messaging). Off: nothing is pushed, whatever the channels per event say. Stays silent until the Firebase service account key is set on the server.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
        ],
      },
      {
        id: 'quiet',
        title: {
          ar: 'ساعات الهدوء',
          en: 'Quiet hours',
        },
        description: {
          ar: 'مقترح: تأجيل الرسائل غير العاجلة ليلًا. الرموز ونتيجة الحجز وتنبيهات التشغيل لا تُؤجَّل.',
          en: 'Proposed: hold non-urgent messages at night. Codes, booking outcomes and ops alerts are never held.',
        },
        fields: [
          {
            key: 'quietHours.enabled',
            label: {
              ar: 'تشغيل ساعات الهدوء',
              en: 'Quiet hours on',
            },
            help: {
              ar: 'تُؤجَّل رسائل واتساب والإشعارات غير العاجلة إلى نهاية الفترة بتوقيت المنصة.',
              en: 'Non-urgent WhatsApp and push messages wait until the end of the period, platform time.',
            },
            type: 'boolean',
            value: false,
            default: false,
            proposed: true,
            proposalId: 'S-26',
            priority: 'P1',
            needsBackend: true,
          },
          {
            key: 'quietHours.start',
            label: {
              ar: 'بداية الهدوء',
              en: 'Quiet from',
            },
            help: {
              ar: 'بتوقيت المنصة (المنطقة الزمنية في «المنصّة»).',
              en: 'Platform time (the time zone in Platform).',
            },
            type: 'string',
            value: '22:00',
            default: '22:00',
            format: 'time',
            proposed: true,
            proposalId: 'S-26',
            priority: 'P1',
            needsBackend: true,
          },
          {
            key: 'quietHours.end',
            label: {
              ar: 'نهاية الهدوء',
              en: 'Quiet until',
            },
            help: {
              ar: 'تُرسل الرسائل المؤجلة بعد هذا الوقت مع التباعد المعتاد.',
              en: 'Held messages go out after this time, with the usual pacing.',
            },
            type: 'string',
            value: '08:00',
            default: '08:00',
            format: 'time',
            proposed: true,
            proposalId: 'S-26',
            priority: 'P1',
            needsBackend: true,
          },
          {
            key: 'quietHours.channels',
            label: {
              ar: 'القنوات المؤجَّلة',
              en: 'Channels held',
            },
            help: {
              ar: 'القنوات التي تحترم ساعات الهدوء؛ البريد لا يُؤجَّل.',
              en: 'Channels that respect quiet hours; e-mail is never held.',
            },
            type: 'multi-enum',
            value: ['WHATSAPP', 'PUSH'],
            default: ['WHATSAPP', 'PUSH'],
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
              {
                value: 'PUSH',
                label: {
                  ar: 'إشعار التطبيق',
                  en: 'Push (app)',
                },
              },
            ],
            proposed: true,
            proposalId: 'S-26',
            priority: 'P1',
            needsBackend: true,
          },
        ],
      },
      {
        id: 'account',
        title: {
          ar: 'رسائل الحساب',
          en: 'Account messages',
        },
        description: {
          ar: 'التحقق وكلمات المرور والأمان.',
          en: 'Verification, passwords and security.',
        },
        fields: [
          {
            key: 'events.identity.verify_email',
            label: {
              ar: 'تأكيد البريد الإلكتروني',
              en: 'Verify e-mail',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: identity.verify_email. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: identity.verify_email. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'identity.verify_email',
          },
          {
            key: 'events.identity.password_reset',
            label: {
              ar: 'إعادة تعيين كلمة المرور',
              en: 'Password reset',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: identity.password_reset. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: identity.password_reset. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'identity.password_reset',
          },
          {
            key: 'events.identity.password_changed',
            label: {
              ar: 'تغيير كلمة المرور',
              en: 'Password changed',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: identity.password_changed. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: identity.password_changed. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'identity.password_changed',
          },
          {
            key: 'events.identity.otp',
            label: {
              ar: 'رمز التحقق',
              en: 'One-time code',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: identity.otp. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: identity.otp. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP'],
            default: ['EMAIL', 'WHATSAPP'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'identity.otp',
          },
          {
            key: 'events.identity.guest_otp',
            label: {
              ar: 'رمز تحقق الضيف',
              en: 'Guest one-time code',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: identity.guest_otp. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: identity.guest_otp. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'identity.guest_otp',
          },
          {
            key: 'events.identity.welcome',
            label: {
              ar: 'رسالة الترحيب',
              en: 'Welcome',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: identity.welcome. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: identity.welcome. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'identity.welcome',
          },
          {
            key: 'events.identity.admin_totp_enrolled',
            label: {
              ar: 'تفعيل المصادقة الثنائية لموظف',
              en: 'Staff 2FA enrolled',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: identity.admin_totp_enrolled. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: identity.admin_totp_enrolled. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'identity.admin_totp_enrolled',
          },
          {
            key: 'events.identity.login_alert',
            label: {
              ar: 'تنبيه تسجيل دخول',
              en: 'Login alert',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: identity.login_alert. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: identity.login_alert. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'identity.login_alert',
          },
          {
            key: 'events.identity.account_locked',
            label: {
              ar: 'قفل الحساب',
              en: 'Account locked',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: identity.account_locked. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: identity.account_locked. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'identity.account_locked',
          },
          {
            key: 'events.identity.security_event',
            label: {
              ar: 'حدث أمني على الحساب',
              en: 'Account security event',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: identity.security_event. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: identity.security_event. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'identity.security_event',
          },
          {
            key: 'events.identity.account_secured',
            label: {
              ar: 'تأمين الحساب',
              en: 'Account secured',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: identity.account_secured. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: identity.account_secured. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'identity.account_secured',
          },
          {
            key: 'events.identity.email_change_notice',
            label: {
              ar: 'إشعار تغيير البريد',
              en: 'E-mail change notice',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: identity.email_change_notice. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: identity.email_change_notice. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'identity.email_change_notice',
          },
        ],
      },
      {
        id: 'bookings',
        title: {
          ar: 'رسائل الحجوزات',
          en: 'Booking messages',
        },
        description: {
          ar: 'نتيجة الحجز والإلغاء والتذكير.',
          en: 'Booking outcome, cancellation and reminders.',
        },
        fields: [
          {
            key: 'events.bookings.confirmed',
            label: {
              ar: 'تأكيد الحجز',
              en: 'Booking confirmed',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: bookings.confirmed.',
              en: 'Channels that send this message. Template key: bookings.confirmed.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP', 'PUSH'],
            default: ['EMAIL', 'WHATSAPP', 'PUSH'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
              {
                value: 'PUSH',
                label: {
                  ar: 'إشعار التطبيق',
                  en: 'Push (app)',
                },
              },
            ],
            templateKey: 'bookings.confirmed',
          },
          {
            key: 'events.bookings.cancelled',
            label: {
              ar: 'إلغاء الحجز',
              en: 'Booking cancelled',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: bookings.cancelled.',
              en: 'Channels that send this message. Template key: bookings.cancelled.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP', 'PUSH'],
            default: ['EMAIL', 'WHATSAPP', 'PUSH'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
              {
                value: 'PUSH',
                label: {
                  ar: 'إشعار التطبيق',
                  en: 'Push (app)',
                },
              },
            ],
            templateKey: 'bookings.cancelled',
          },
          {
            key: 'events.bookings.failed',
            label: {
              ar: 'فشل الحجز',
              en: 'Booking failed',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: bookings.failed.',
              en: 'Channels that send this message. Template key: bookings.failed.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'PUSH'],
            default: ['EMAIL', 'PUSH'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
              {
                value: 'PUSH',
                label: {
                  ar: 'إشعار التطبيق',
                  en: 'Push (app)',
                },
              },
            ],
            templateKey: 'bookings.failed',
          },
          {
            key: 'events.bookings.refund_issued',
            label: {
              ar: 'إصدار الاسترداد',
              en: 'Refund issued',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: bookings.refund_issued.',
              en: 'Channels that send this message. Template key: bookings.refund_issued.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'PUSH'],
            default: ['EMAIL', 'PUSH'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
              {
                value: 'PUSH',
                label: {
                  ar: 'إشعار التطبيق',
                  en: 'Push (app)',
                },
              },
            ],
            templateKey: 'bookings.refund_issued',
          },
          {
            key: 'events.bookings.manage_otp',
            label: {
              ar: 'رمز إدارة الحجز',
              en: 'Manage-booking code',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: bookings.manage_otp. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: bookings.manage_otp. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP'],
            default: ['EMAIL', 'WHATSAPP'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'bookings.manage_otp',
          },
          {
            key: 'events.bookings.trip_reminder',
            label: {
              ar: 'تذكير بالرحلة',
              en: 'Trip reminder',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: bookings.trip_reminder.',
              en: 'Channels that send this message. Template key: bookings.trip_reminder.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP', 'PUSH'],
            default: ['EMAIL', 'PUSH'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
              {
                value: 'PUSH',
                label: {
                  ar: 'إشعار التطبيق',
                  en: 'Push (app)',
                },
              },
            ],
            templateKey: 'bookings.trip_reminder',
          },
        ],
      },
      {
        id: 'flights',
        title: {
          ar: 'رسائل الرحلات',
          en: 'Flight messages',
        },
        description: {
          ar: 'التذاكر والحجز المؤقت والتعديلات والخدمات.',
          en: 'Tickets, holds, changes and extras.',
        },
        fields: [
          {
            key: 'events.flights.ticket_issued',
            label: {
              ar: 'إصدار التذكرة',
              en: 'Ticket issued',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: flights.ticket_issued. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: flights.ticket_issued. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP'],
            default: ['EMAIL', 'WHATSAPP'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'flights.ticket_issued',
          },
          {
            key: 'events.flights.hold_created',
            label: {
              ar: 'إنشاء حجز مؤقت',
              en: 'Hold created',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: flights.hold_created. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: flights.hold_created. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'flights.hold_created',
          },
          {
            key: 'events.flights.hold_reminder',
            label: {
              ar: 'تذكير بالحجز المؤقت',
              en: 'Hold reminder',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: flights.hold_reminder. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: flights.hold_reminder. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP'],
            default: ['EMAIL', 'WHATSAPP'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'flights.hold_reminder',
          },
          {
            key: 'events.flights.hold_expired',
            label: {
              ar: 'انتهاء الحجز المؤقت',
              en: 'Hold expired',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: flights.hold_expired. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: flights.hold_expired. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'flights.hold_expired',
          },
          {
            key: 'events.flights.change_confirmed',
            label: {
              ar: 'تأكيد التعديل',
              en: 'Change confirmed',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: flights.change_confirmed. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: flights.change_confirmed. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP'],
            default: ['EMAIL', 'WHATSAPP'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'flights.change_confirmed',
          },
          {
            key: 'events.flights.change_failed',
            label: {
              ar: 'فشل التعديل',
              en: 'Change failed',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: flights.change_failed. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: flights.change_failed. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'flights.change_failed',
          },
          {
            key: 'events.flights.airline_change_detected',
            label: {
              ar: 'تغيير من شركة الطيران',
              en: 'Airline change detected',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: flights.airline_change_detected.',
              en: 'Channels that send this message. Template key: flights.airline_change_detected.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP', 'PUSH'],
            default: ['EMAIL', 'WHATSAPP', 'PUSH'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
              {
                value: 'PUSH',
                label: {
                  ar: 'إشعار التطبيق',
                  en: 'Push (app)',
                },
              },
            ],
            templateKey: 'flights.airline_change_detected',
          },
          {
            key: 'events.flights.schedule_change_notice',
            label: {
              ar: 'إشعار تغيير الموعد',
              en: 'Schedule change notice',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: flights.schedule_change_notice.',
              en: 'Channels that send this message. Template key: flights.schedule_change_notice.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP', 'PUSH'],
            default: ['EMAIL', 'WHATSAPP', 'PUSH'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
              {
                value: 'PUSH',
                label: {
                  ar: 'إشعار التطبيق',
                  en: 'Push (app)',
                },
              },
            ],
            templateKey: 'flights.schedule_change_notice',
          },
          {
            key: 'events.flights.services_added',
            label: {
              ar: 'إضافة خدمات',
              en: 'Extras added',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: flights.services_added. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: flights.services_added. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'flights.services_added',
          },
          {
            key: 'events.flights.services_under_review',
            label: {
              ar: 'خدمات قيد المراجعة',
              en: 'Extras under review',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: flights.services_under_review. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: flights.services_under_review. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'flights.services_under_review',
          },
          {
            key: 'events.flights.service_failed',
            label: {
              ar: 'تعذّر إضافة خدمة',
              en: 'Extra failed',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: flights.service_failed. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: flights.service_failed. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'flights.service_failed',
          },
        ],
      },
      {
        id: 'payments',
        title: {
          ar: 'رسائل المدفوعات والولاء',
          en: 'Payment & loyalty messages',
        },
        description: {
          ar: 'الدفعات والاسترداد والنقاط.',
          en: 'Payments, refunds and points.',
        },
        fields: [
          {
            key: 'events.payments.received',
            label: {
              ar: 'استلام الدفعة',
              en: 'Payment received',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: payments.received. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: payments.received. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP'],
            default: ['EMAIL', 'WHATSAPP'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'payments.received',
          },
          {
            key: 'events.payments.payment_link',
            label: {
              ar: 'رابط الدفع',
              en: 'Payment link',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: payments.payment_link. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: payments.payment_link. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'SMS'],
            default: ['EMAIL', 'SMS'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'payments.payment_link',
          },
          {
            key: 'events.payments.refund_settled',
            label: {
              ar: 'اكتمال الاسترداد',
              en: 'Refund settled',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: payments.refund_settled.',
              en: 'Channels that send this message. Template key: payments.refund_settled.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP', 'PUSH'],
            default: ['EMAIL', 'WHATSAPP', 'PUSH'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
              {
                value: 'PUSH',
                label: {
                  ar: 'إشعار التطبيق',
                  en: 'Push (app)',
                },
              },
            ],
            templateKey: 'payments.refund_settled',
          },
          {
            key: 'events.payments.refund_delayed',
            label: {
              ar: 'تأخر الاسترداد',
              en: 'Refund delayed',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: payments.refund_delayed. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: payments.refund_delayed. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL'],
            default: ['EMAIL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'payments.refund_delayed',
          },
          {
            key: 'events.loyalty.points_expiring',
            label: {
              ar: 'نقاط على وشك الانتهاء',
              en: 'Points expiring',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: loyalty.points_expiring.',
              en: 'Channels that send this message. Template key: loyalty.points_expiring.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'PUSH'],
            default: ['EMAIL', 'PUSH'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
              {
                value: 'PUSH',
                label: {
                  ar: 'إشعار التطبيق',
                  en: 'Push (app)',
                },
              },
            ],
            templateKey: 'loyalty.points_expiring',
          },
          {
            key: 'events.loyalty.tier_changed',
            label: {
              ar: 'تغيّر المستوى',
              en: 'Tier changed',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: loyalty.tier_changed.',
              en: 'Channels that send this message. Template key: loyalty.tier_changed.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'PUSH'],
            default: ['EMAIL', 'PUSH'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
              {
                value: 'PUSH',
                label: {
                  ar: 'إشعار التطبيق',
                  en: 'Push (app)',
                },
              },
            ],
            templateKey: 'loyalty.tier_changed',
          },
        ],
      },
      {
        id: 'ops',
        title: {
          ar: 'تنبيهات التشغيل',
          en: 'Ops alerts',
        },
        description: {
          ar: 'من يُبلَّغ بالحوادث وعبر أي قناة حسب الخطورة.',
          en: 'Who hears about incidents, and on which channel by severity.',
        },
        fields: [
          {
            key: 'opsAlerts.enabled',
            label: {
              ar: 'مفعّلة',
              en: 'Enabled',
            },
            help: {
              ar: 'إيصال التنبيهات التشغيلية إلى المناوبين.',
              en: 'Deliver operational alerts to the on-call recipients.',
            },
            type: 'boolean',
            value: true,
            default: true,
            control: 'security',
            risk: 'high',
          },
          {
            key: 'opsAlerts.recipients',
            label: {
              ar: 'المستلمون',
              en: 'Recipients',
            },
            help: {
              ar: 'المناوبون: عناوين البريد (للبريد الإلكتروني) والأرقام الدولية (لواتساب). القائمة الفارغة تستخدم عنوان دعم المنصة.',
              en: 'On-call recipients: email addresses (email) and international numbers (WhatsApp). An empty list uses the platform support address.',
            },
            type: 'string-list',
            value: ['ops@goteav.com', '+905321234567'],
            default: [],
            control: 'security',
          },
          {
            key: 'opsAlerts.minSeverity',
            label: {
              ar: 'أدنى خطورة',
              en: 'Lowest severity',
            },
            help: {
              ar: 'أدنى مستوى خطورة يُرسل. التنبيهات الأقل تُسجَّل فقط.',
              en: 'Lowest severity that is delivered. Quieter alerts are only logged.',
            },
            type: 'enum',
            value: 'warning',
            default: 'warning',
            options: [
              {
                value: 'info',
                label: {
                  ar: 'معلومات',
                  en: 'Information',
                },
              },
              {
                value: 'warning',
                label: {
                  ar: 'تحذير',
                  en: 'Warning',
                },
              },
              {
                value: 'high',
                label: {
                  ar: 'مرتفع',
                  en: 'High',
                },
              },
              {
                value: 'critical',
                label: {
                  ar: 'حرجة',
                  en: 'Critical',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'opsAlerts.channels',
            label: {
              ar: 'القنوات',
              en: 'Channels',
            },
            help: {
              ar: 'القنوات التي يُرسل عبرها تنبيه العمليات.',
              en: 'Channels an operations alert is delivered on.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP', 'TELEGRAM', 'ONCALL'],
            default: ['EMAIL', 'WHATSAPP', 'TELEGRAM', 'ONCALL'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
              {
                value: 'WHATSAPP',
                label: {
                  ar: 'واتساب',
                  en: 'WhatsApp',
                },
              },
              {
                value: 'TELEGRAM',
                label: {
                  ar: 'تيليجرام',
                  en: 'Telegram',
                },
              },
              {
                value: 'ONCALL',
                label: {
                  ar: 'تطبيق المناوبة',
                  en: 'On-call app',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'opsAlerts.routing.EMAIL',
            label: {
              ar: 'أدنى خطورة إلى البريد',
              en: 'Lowest severity to email',
            },
            help: {
              ar: 'أقل درجة خطورة تصل إلى قناة البريد.',
              en: 'Lowest severity this channel receives.',
            },
            type: 'enum',
            value: 'info',
            default: 'info',
            options: [
              {
                value: 'info',
                label: {
                  ar: 'معلومات',
                  en: 'Information',
                },
              },
              {
                value: 'warning',
                label: {
                  ar: 'تحذير',
                  en: 'Warning',
                },
              },
              {
                value: 'high',
                label: {
                  ar: 'مرتفع',
                  en: 'High',
                },
              },
              {
                value: 'critical',
                label: {
                  ar: 'حرجة',
                  en: 'Critical',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'opsAlerts.routing.WHATSAPP',
            label: {
              ar: 'أدنى خطورة إلى واتساب',
              en: 'Lowest severity to whatsapp',
            },
            help: {
              ar: 'أقل درجة خطورة تصل إلى قناة واتساب.',
              en: 'Lowest severity this channel receives.',
            },
            type: 'enum',
            value: 'critical',
            default: 'critical',
            options: [
              {
                value: 'info',
                label: {
                  ar: 'معلومات',
                  en: 'Information',
                },
              },
              {
                value: 'warning',
                label: {
                  ar: 'تحذير',
                  en: 'Warning',
                },
              },
              {
                value: 'high',
                label: {
                  ar: 'مرتفع',
                  en: 'High',
                },
              },
              {
                value: 'critical',
                label: {
                  ar: 'حرجة',
                  en: 'Critical',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'opsAlerts.routing.TELEGRAM',
            label: {
              ar: 'أدنى خطورة إلى تيليجرام',
              en: 'Lowest severity to telegram',
            },
            help: {
              ar: 'أقل درجة خطورة تصل إلى قناة تيليجرام.',
              en: 'Lowest severity this channel receives.',
            },
            type: 'enum',
            value: 'high',
            default: 'high',
            options: [
              {
                value: 'info',
                label: {
                  ar: 'معلومات',
                  en: 'Information',
                },
              },
              {
                value: 'warning',
                label: {
                  ar: 'تحذير',
                  en: 'Warning',
                },
              },
              {
                value: 'high',
                label: {
                  ar: 'مرتفع',
                  en: 'High',
                },
              },
              {
                value: 'critical',
                label: {
                  ar: 'حرجة',
                  en: 'Critical',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'opsAlerts.routing.ONCALL',
            label: {
              ar: 'أدنى خطورة إلى تطبيق المناوبة',
              en: 'Lowest severity to on-call',
            },
            help: {
              ar: 'أقل درجة خطورة تصل إلى قناة تطبيق المناوبة.',
              en: 'Lowest severity this channel receives.',
            },
            type: 'enum',
            value: 'critical',
            default: 'critical',
            options: [
              {
                value: 'info',
                label: {
                  ar: 'معلومات',
                  en: 'Information',
                },
              },
              {
                value: 'warning',
                label: {
                  ar: 'تحذير',
                  en: 'Warning',
                },
              },
              {
                value: 'high',
                label: {
                  ar: 'مرتفع',
                  en: 'High',
                },
              },
              {
                value: 'critical',
                label: {
                  ar: 'حرجة',
                  en: 'Critical',
                },
              },
            ],
            control: 'security',
          },
          {
            key: 'opsAlerts.telegramChatIds',
            label: {
              ar: 'محادثات تيليجرام',
              en: 'Telegram chats',
            },
            help: {
              ar: 'معرّفات المحادثات التي ينشر فيها بوت التشغيل (رمز البوت متغير خادم OPS_TELEGRAM_BOT_TOKEN).',
              en: 'Chats the ops bot posts to (the bot token is the OPS_TELEGRAM_BOT_TOKEN server variable).',
            },
            type: 'string-list',
            value: ['-1001934567890'],
            default: [],
            control: 'security',
          },
          {
            key: 'opsAlerts.webhookUrl',
            label: {
              ar: 'رابط webhook',
              en: 'Webhook link',
            },
            help: {
              ar: 'العنوان الكامل (http أو https) الذي يستقبل التنبيهات. أوقفه لعدم الإرسال.',
              en: 'Full http(s) address that receives the alerts. Switch it off for none.',
            },
            type: 'url',
            value: null,
            default: null,
            nullable: true,
            control: 'security',
          },
          {
            key: 'opsAlerts.throttleMinutes',
            label: {
              ar: 'التقليل (دقائق)',
              en: 'Throttle (minutes)',
            },
            help: {
              ar: 'التنبيهات المتطابقة خلال هذه المدة تُرسل مرة واحدة.',
              en: 'Identical alerts inside this window are sent once.',
            },
            type: 'duration',
            value: 15,
            default: 15,
            unit: 'minutes',
            min: 0,
            max: 1440,
            control: 'security',
          },
          {
            key: 'opsAlerts.burstLimit',
            label: {
              ar: 'حد العاصفة',
              en: 'Storm guard',
            },
            help: {
              ar: 'أقصى عدد من التنبيهات المختلفة لنفس المفتاح في نافذة واحدة؛ الباقي يُسجَّل فقط.',
              en: 'Most different alerts of one key delivered per throttle window; the rest are only logged.',
            },
            type: 'integer',
            value: 10,
            default: 10,
            min: 1,
            max: 500,
            control: 'security',
          },
          {
            key: 'events.ops.alert',
            label: {
              ar: 'تنبيه تشغيلي',
              en: 'Ops alert',
            },
            help: {
              ar: 'القنوات التي تُرسل بها هذه الرسالة. مفتاح القالب: ops.alert. لا ترسل هذه الرسالة إشعارات دفع.',
              en: 'Channels that send this message. Template key: ops.alert. This message never pushes.',
            },
            type: 'multi-enum',
            value: ['EMAIL', 'WHATSAPP'],
            default: ['EMAIL', 'WHATSAPP'],
            options: [
              {
                value: 'EMAIL',
                label: {
                  ar: 'البريد الإلكتروني',
                  en: 'Email',
                },
              },
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
            templateKey: 'ops.alert',
          },
        ],
      },
      {
        id: 'content',
        title: {
          ar: 'محتوى البريد',
          en: 'E-mail content',
        },
        description: {
          ar: 'ما تتضمنه رسائل العملاء.',
          en: 'What customer e-mails include.',
        },
        fields: [
          {
            key: 'emailContent.showFareRules',
            label: {
              ar: 'عرض قواعد التذكرة في رسالة تأكيد الحجز',
              en: 'Show fare rules in the booking confirmation e-mail',
            },
            help: {
              ar: 'يوضح للعميل في رسالة تأكيد الحجز هل يمكنه تغيير موعد الرحلة أو استرداد قيمتها، ومقدار الرسوم إن وجدت. عند الإيقاف تختفي هذه الصفوف من الرسالة فقط، ولا تتغير القواعد نفسها ولا الإجمالي المدفوع. يسري على الرسائل التي تُرسل بعد الحفظ.',
              en: 'Tells the customer in the booking confirmation e-mail whether the flight can be changed or refunded, and any fee. Off removes these rows from the e-mail only; the rules themselves and the total paid do not change. Applies to e-mails sent after saving.',
            },
            type: 'boolean',
            value: true,
            default: true,
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
          ar: 'إعادة المحاولة للرسائل المتعثرة.',
          en: 'Retries of stuck messages.',
        },
        fields: [
          {
            key: 'delivery.maxAttempts',
            label: {
              ar: 'المحاولات',
              en: 'Attempts',
            },
            help: {
              ar: 'عدد المحاولات لكل إشعار قبل التوقف.',
              en: 'Attempts per notification before giving up.',
            },
            type: 'integer',
            value: 5,
            default: 5,
            min: 1,
            max: 10,
          },
          {
            key: 'delivery.retryBackoffSeconds',
            label: {
              ar: 'مهلة إعادة المحاولة (ثوانٍ)',
              en: 'Retry delay (seconds)',
            },
            help: {
              ar: 'المهلة الأساسية بين المحاولات، وتزداد بعد كل محاولة.',
              en: 'Base delay between retries. It grows after each attempt.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'seconds',
            min: 0,
            max: 2592000,
          },
          {
            key: 'delivery.staleAfterSeconds',
            label: {
              ar: 'إعادة الجدولة بعد (ثوانٍ)',
              en: 'Requeue after (seconds)',
            },
            help: {
              ar: 'الإشعارات المعلّقة الأقدم من هذه المدة تُعاد إلى قائمة الانتظار.',
              en: 'Pending notifications older than this are queued again.',
            },
            type: 'duration',
            value: 600,
            default: 600,
            unit: 'seconds',
            min: 0,
            max: 2592000,
          },
        ],
      },
      {
        id: 'legacy',
        title: {
          ar: 'تنبيهات الإدارة (قديمة)',
          en: 'Admin alerts (legacy)',
        },
        description: {
          ar: 'القائمة الأقدم؛ «تنبيهات التشغيل» هي قناة الحوادث. يُقترح حذفها.',
          en: 'The older list; ops alerts are the incident channel. Proposed for retirement.',
        },
        fields: [
          {
            key: 'adminAlerts.enabled',
            label: {
              ar: 'مفعّلة',
              en: 'Enabled',
            },
            help: {
              ar: 'إرسال التنبيهات التشغيلية إلى قنوات الإدارة.',
              en: 'Send operational alerts to the admin channels.',
            },
            type: 'boolean',
            value: true,
            default: true,
            deprecated: true,
          },
          {
            key: 'adminAlerts.emails',
            label: {
              ar: 'مستلمو البريد',
              en: 'Email recipients',
            },
            help: {
              ar: 'مستلمو تنبيهات الإدارة بالبريد الإلكتروني.',
              en: 'Recipients of admin alert emails.',
            },
            type: 'string-list',
            value: [],
            default: [],
            deprecated: true,
            format: 'email',
          },
          {
            key: 'adminAlerts.whatsappNumbers',
            label: {
              ar: 'أرقام واتساب',
              en: 'WhatsApp numbers',
            },
            help: {
              ar: 'الأرقام الدولية (E.164) التي تستقبل تنبيهات الإدارة عبر واتساب.',
              en: 'International numbers (E.164) receiving admin WhatsApp alerts.',
            },
            type: 'string-list',
            value: [],
            default: [],
            deprecated: true,
            format: 'phone',
          },
          {
            key: 'adminAlerts.events',
            label: {
              ar: 'الأحداث',
              en: 'Events',
            },
            help: {
              ar: 'أحداث التنبيه التي تُمرَّر.',
              en: 'Alert events that are forwarded.',
            },
            type: 'string-list',
            value: [
              'payments.webhook_failed',
              'flights.confirmation_failed',
              'flights.ticketing_failed',
              'flights.aic_detected',
              'pricing.fx_stale',
              'outbox.delivery_failed',
              'notifications.provider_down',
            ],
            default: [
              'payments.webhook_failed',
              'flights.confirmation_failed',
              'flights.ticketing_failed',
              'flights.aic_detected',
              'pricing.fx_stale',
              'outbox.delivery_failed',
              'notifications.provider_down',
            ],
            deprecated: true,
          },
        ],
      },
    ],
  },
  {
    key: 'whatsapp_provider',
    section: 'system',
    icon: 'MessageCircle',
    title: {
      ar: 'واتساب (كرتات)',
      en: 'WhatsApp (Cartat)',
    },
    summary: {
      ar: 'الحالة، مفتاح التشغيل، حساب كرتات ورسالة تجريبية',
      en: 'Status, on/off switch, Cartat account and test message',
    },
    description: {
      ar: 'تُرسل رسائل واتساب عبر كرتات بوضع رمز QR (نص عادي دون قوالب رسائل). تحقق من ربط الهاتف، وشغّل واتساب أو أوقفه، واضبط حساب كرتات، وأرسل رسالة تجريبية.',
      en: 'WhatsApp messages go out through Cartat in QR mode (plain text, no message templates). Check that the phone is linked, switch WhatsApp on or off, set the Cartat account and send a test message.',
    },
    kind: 'special',
    inDashboard: true,
    permission: {
      ar: 'notifications.manage_providers؛ حساب كرتات للمالك فقط (settings.provider_credentials).',
      en: 'notifications.manage_providers; the Cartat account is owner only (settings.provider_credentials).',
    },
    approval: 'none',
    version: 4,
    schemaVersion: null,
    updatedAt: '2026-11-11T11:40:00.000Z',
    updatedBy: 'Sara Haddad',
    masterSwitch: 'providers.whatsapp.enabled',
    enabled: true,
    subsections: [
      {
        id: 'status',
        title: {
          ar: 'الحالة',
          en: 'Status',
        },
        description: {
          ar: 'يسأل كرتات عن حالة الهاتف. لا يُرسل شيء.',
          en: "Asks Cartat for the phone's state. Nothing is sent.",
        },
        fields: [
          {
            key: 'status',
            label: {
              ar: 'الاتصال',
              en: 'Connection',
            },
            help: {
              ar: 'فقد هاتف واتساب ارتباطه. امسح رمز QR مرة أخرى في لوحة كرتات.',
              en: 'The WhatsApp phone lost its link. Scan the QR code again in the Cartat panel.',
            },
            type: 'enum',
            value: 'working',
            default: 'notConfigured',
            options: [
              {
                value: 'working',
                label: {
                  ar: 'يعمل',
                  en: 'Working',
                },
              },
              {
                value: 'starting',
                label: {
                  ar: 'قيد التشغيل',
                  en: 'Starting',
                },
              },
              {
                value: 'disabled',
                label: {
                  ar: 'متوقف',
                  en: 'Switched off',
                },
              },
              {
                value: 'notConfigured',
                label: {
                  ar: 'غير مضبوط',
                  en: 'Not configured',
                },
              },
              {
                value: 'unlinked',
                label: {
                  ar: 'الهاتف غير مرتبط',
                  en: 'Phone unlinked',
                },
              },
              {
                value: 'error',
                label: {
                  ar: 'خطأ',
                  en: 'Error',
                },
              },
            ],
            readOnly: true,
          },
          {
            key: 'provider',
            label: {
              ar: 'المزوّد',
              en: 'Provider',
            },
            help: {
              ar: 'تُرسل رسائل واتساب عبر كرتات بوضع رمز QR (نص عادي دون قوالب رسائل). تحقق من ربط الهاتف، وشغّل واتساب أو أوقفه، واضبط حساب كرتات، وأرسل رسالة تجريبية.',
              en: 'WhatsApp messages go out through Cartat in QR mode (plain text, no message templates). Check that the phone is linked, switch WhatsApp on or off, set the Cartat account and send a test message.',
            },
            type: 'enum',
            value: 'cartat',
            default: 'cartat',
            options: [
              {
                value: 'cartat',
                label: {
                  ar: 'كرتات',
                  en: 'Cartat',
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
            readOnly: true,
          },
          {
            key: 'lastSuccessAt',
            label: {
              ar: 'آخر رسالة أُرسلت',
              en: 'Last message sent',
            },
            help: {
              ar: 'آخر حدث تسليم',
              en: 'Last delivery event',
            },
            type: 'string',
            value: '2026-11-18T09:52:00+03:00',
            default: null,
            nullable: true,
            format: 'datetime',
            readOnly: true,
          },
          {
            key: 'lastErrorAt',
            label: {
              ar: 'آخر إخفاق',
              en: 'Last failure',
            },
            help: {
              ar: 'لا يوجد',
              en: 'None',
            },
            type: 'string',
            value: null,
            default: null,
            nullable: true,
            format: 'datetime',
            readOnly: true,
          },
        ],
      },
      {
        id: 'switch',
        title: {
          ar: 'رسائل واتساب',
          en: 'WhatsApp messages',
        },
        description: {
          ar: 'عند الإيقاف: تُلغى كل رسائل واتساب فورًا حتى تعيد تشغيله.',
          en: 'Off: every WhatsApp message is cancelled at once, until you switch it back on.',
        },
        fields: [
          {
            key: 'providers.whatsapp.enabled',
            label: {
              ar: 'إرسال رسائل واتساب',
              en: 'Send WhatsApp messages',
            },
            help: {
              ar: 'عند الإيقاف: تُلغى كل رسائل واتساب فورًا حتى تعيد تشغيله.',
              en: 'Off: every WhatsApp message is cancelled at once, until you switch it back on.',
            },
            type: 'boolean',
            value: true,
            default: true,
            storedIn: 'notifications',
            risk: 'high',
          },
          {
            key: 'providers.whatsapp.pacing.perMinute',
            label: {
              ar: 'وتيرة الإرسال',
              en: 'Sending pace',
            },
            help: {
              ar: 'غيّرها في إعدادات الإشعارات',
              en: 'Change it in the notification settings',
            },
            type: 'integer',
            value: 20,
            default: 20,
            min: 1,
            max: 600,
            storedIn: 'notifications',
            readOnly: true,
          },
        ],
      },
      {
        id: 'credentials',
        title: {
          ar: 'حساب كرتات',
          en: 'Cartat account',
        },
        description: {
          ar: 'يستخدم الاختبار ما كُتب في النموذج فوق الحساب المحفوظ.',
          en: 'The test uses what is typed in the form, over the saved account.',
        },
        fields: [
          {
            key: 'apiUrl',
            label: {
              ar: 'رابط الـ API',
              en: 'API URL',
            },
            help: {
              ar: 'متغير الخادم: CARTAT_API_URL',
              en: 'Server variable: CARTAT_API_URL',
            },
            type: 'url',
            value: 'https://api.cartat.io',
            default: null,
            nullable: true,
          },
          {
            key: 'apiToken',
            label: {
              ar: 'رمز الـ API',
              en: 'API token',
            },
            help: {
              ar: 'متغير الخادم: CARTAT_API_TOKEN',
              en: 'Server variable: CARTAT_API_TOKEN',
            },
            type: 'secret',
            value: '••••3fd1',
            default: null,
            nullable: true,
            risk: 'high',
          },
        ],
      },
      {
        id: 'webhook',
        title: {
          ar: 'إشعارات التسليم (webhook)',
          en: 'Delivery receipts (webhook)',
        },
        description: {
          ar: 'تتصل Cartat بالـ webhook عندما تصل الرسالة إلى الهاتف أو تُقرأ، وعندما تتغيّر حالة الهاتف المرتبط. الرسائل الواردة تبقى متوقفة.',
          en: 'Cartat calls our webhook when a message reaches the phone or is read, and when the linked phone changes state. Incoming messages stay off.',
        },
        fields: [
          {
            key: 'webhook.enabled',
            label: {
              ar: 'استقبال إشعارات التسليم',
              en: 'Receive delivery receipts',
            },
            help: {
              ar: 'تتصل Cartat بالـ webhook عندما تصل الرسالة إلى الهاتف أو تُقرأ، وعندما تتغيّر حالة الهاتف المرتبط. الرسائل الواردة تبقى متوقفة.',
              en: 'Cartat calls our webhook when a message reaches the phone or is read, and when the linked phone changes state. Incoming messages stay off.',
            },
            type: 'boolean',
            value: true,
            default: false,
          },
          {
            key: 'webhook.url',
            label: {
              ar: 'رابط الـ webhook',
              en: 'Webhook URL',
            },
            help: {
              ar: 'تتصل Cartat بالـ webhook عندما تصل الرسالة إلى الهاتف أو تُقرأ، وعندما تتغيّر حالة الهاتف المرتبط. الرسائل الواردة تبقى متوقفة.',
              en: 'Cartat calls our webhook when a message reaches the phone or is read, and when the linked phone changes state. Incoming messages stay off.',
            },
            type: 'url',
            value: 'https://api.goteav.com/webhooks/cartat/••••',
            default: null,
            nullable: true,
            readOnly: true,
          },
          {
            key: 'webhook.secret',
            label: {
              ar: 'سرّ الـ webhook',
              en: 'Webhook secret',
            },
            help: {
              ar: 'لا يوجد سرّ بعد: يُنشأ عند تفعيل الـ webhook.',
              en: 'No secret yet: it is created when the webhook is switched on.',
            },
            type: 'secret',
            value: '••••a7c2',
            default: null,
            nullable: true,
          },
        ],
      },
      {
        id: 'test',
        title: {
          ar: 'رسالة تجريبية',
          en: 'Test message',
        },
        description: {
          ar: 'يرسل نص واتساب قصيرًا إلى أي رقم للتأكد من وصول الرسائل.',
          en: 'Sends one short WhatsApp text to any number, to check that messages arrive.',
        },
        fields: [
          {
            key: 'test.phone',
            label: {
              ar: 'رقم الهاتف',
              en: 'Phone number',
            },
            help: {
              ar: 'اختر الدولة ثم اكتب الرقم كما يُقال، بالصفر أو بدونه.',
              en: 'Pick the country, then type the number as it is said, with or without the leading 0.',
            },
            type: 'string',
            value: null,
            default: null,
            nullable: true,
            format: 'phone',
          },
          {
            key: 'test.locale',
            label: {
              ar: 'لغة الرسالة',
              en: 'Language of the message',
            },
            help: {
              ar: 'حتى 5 رسائل تجريبية كل 10 دقائق.',
              en: 'Up to 5 test messages every 10 minutes.',
            },
            type: 'enum',
            value: 'ar',
            default: 'ar',
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
        ],
      },
    ],
  },
  {
    key: 'mobile_app',
    section: 'system',
    icon: 'Smartphone',
    title: {
      ar: 'تطبيق الموبايل',
      en: 'Mobile app',
    },
    summary: {
      ar: 'الإصدارات والتحديث الإجباري والمعرّفات وروابط التطبيق',
      en: 'Versions, forced updates, identifiers and app links',
    },
    description: {
      ar: 'إصدارات تطبيق الموبايل لكل منصة (تحديث إجباري أو اختياري) وروابط المتاجر، ونص شاشة التحديث، والمعرّفات التي تجعل روابط الموقع تفتح التطبيق وتسمح بتسجيل الدخول بجوجل وآبل من داخله، وعناوين روابط التطبيق. املأها بعد فتح حسابي App Store وGoogle Play.',
      en: "The mobile app's versions per platform (force or optional update) and store links, the text of the update screen, the identifiers that let website links open the app and native Google and Apple sign-in work, and the addresses of the app links. Fill these in once the App Store and Google Play accounts exist.",
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 5,
    schemaVersion: 2,
    updatedAt: '2026-11-10T19:00:00.000Z',
    updatedBy: 'Khaled Nasser',
    subsections: [
      {
        id: 'ios',
        title: {
          ar: 'إصدار iOS',
          en: 'iOS release',
        },
        description: {
          ar: 'الإصدار الأدنى يفرض التحديث، والأحدث يقترحه.',
          en: 'The minimum forces an update, the latest offers one.',
        },
        fields: [
          {
            key: 'ios.minSupportedVersion',
            label: {
              ar: 'أقل إصدار مدعوم (تحديث إجباري)',
              en: 'Minimum supported version (force update)',
            },
            help: {
              ar: 'النسخ الأقدم من هذا الإصدار تُمنع من العمل: يعرض التطبيق شاشة تحديث لا يمكن تخطيها حتى يحدّث العميل. الصيغة MAJOR.MINOR.PATCH مثل 1.4.0. لا ترفعه إلا بعد نزول النسخة الجديدة فعلًا في App Store، وإلا علق العملاء. أوقفه لعدم فرض حد أدنى (لا تحديث إجباري).',
              en: 'Builds older than this version are blocked: the app shows an update screen that cannot be skipped until the customer updates. Format MAJOR.MINOR.PATCH, e.g. 1.4.0. Raise it only after the new build is live in the App Store, or customers will be stuck. Switch it off for no minimum (no forced update).',
            },
            type: 'string',
            value: '1.2.0',
            default: null,
            nullable: true,
            format: 'version',
            risk: 'high',
          },
          {
            key: 'ios.latestVersion',
            label: {
              ar: 'أحدث إصدار (تحديث اختياري)',
              en: 'Latest version (optional update)',
            },
            help: {
              ar: 'أحدث نسخة في App Store. النسخة الأقدم منه وليست أقل من الحد الأدنى تظهر لها رسالة "يوجد تحديث" يستطيع العميل تجاهلها. الصيغة MAJOR.MINOR.PATCH. أوقفه لعدم عرض أي تحديث.',
              en: 'The newest build in the App Store. A build older than this but not below the minimum gets an "update available" prompt the customer can dismiss. Format MAJOR.MINOR.PATCH. Switch it off to offer no update.',
            },
            type: 'string',
            value: '1.4.1',
            default: null,
            nullable: true,
            format: 'version',
          },
          {
            key: 'ios.storeUrl',
            label: {
              ar: 'رابط App Store',
              en: 'App Store link',
            },
            help: {
              ar: 'صفحة التطبيق في App Store (https)، ويفتحها زر التحديث. تجده في App Store Connect ← التطبيق ← App Information ← "View on App Store". أوقفه ما دام التطبيق غير منشور.',
              en: 'The app\'s App Store page (https), opened by the update button. Find it in App Store Connect → the app → App Information → "View on App Store". Switch it off while the app is not published.',
            },
            type: 'url',
            value: 'https://apps.apple.com/app/goteav/id6740000000',
            default: null,
            nullable: true,
          },
        ],
      },
      {
        id: 'android',
        title: {
          ar: 'إصدار Android',
          en: 'Android release',
        },
        description: {
          ar: 'الإصدار الأدنى يفرض التحديث، والأحدث يقترحه.',
          en: 'The minimum forces an update, the latest offers one.',
        },
        fields: [
          {
            key: 'android.minSupportedVersion',
            label: {
              ar: 'أقل إصدار مدعوم (تحديث إجباري)',
              en: 'Minimum supported version (force update)',
            },
            help: {
              ar: 'النسخ الأقدم من هذا الإصدار تُمنع من العمل: يعرض التطبيق شاشة تحديث لا يمكن تخطيها حتى يحدّث العميل. الصيغة MAJOR.MINOR.PATCH مثل 1.4.0. لا ترفعه إلا بعد نزول النسخة الجديدة فعلًا في Google Play، وإلا علق العملاء. أوقفه لعدم فرض حد أدنى (لا تحديث إجباري).',
              en: 'Builds older than this version are blocked: the app shows an update screen that cannot be skipped until the customer updates. Format MAJOR.MINOR.PATCH, e.g. 1.4.0. Raise it only after the new build is live on Google Play, or customers will be stuck. Switch it off for no minimum (no forced update).',
            },
            type: 'string',
            value: '1.2.0',
            default: null,
            nullable: true,
            format: 'version',
            risk: 'high',
          },
          {
            key: 'android.latestVersion',
            label: {
              ar: 'أحدث إصدار (تحديث اختياري)',
              en: 'Latest version (optional update)',
            },
            help: {
              ar: 'أحدث نسخة في Google Play. النسخة الأقدم منه وليست أقل من الحد الأدنى تظهر لها رسالة "يوجد تحديث" يستطيع العميل تجاهلها. الصيغة MAJOR.MINOR.PATCH. أوقفه لعدم عرض أي تحديث.',
              en: 'The newest build on Google Play. A build older than this but not below the minimum gets an "update available" prompt the customer can dismiss. Format MAJOR.MINOR.PATCH. Switch it off to offer no update.',
            },
            type: 'string',
            value: '1.4.1',
            default: null,
            nullable: true,
            format: 'version',
          },
          {
            key: 'android.storeUrl',
            label: {
              ar: 'رابط Google Play',
              en: 'Google Play link',
            },
            help: {
              ar: 'صفحة التطبيق في Google Play (https)، ويفتحها زر التحديث، مثل https://play.google.com/store/apps/details?id=com.goteav.app. أوقفه ما دام التطبيق غير منشور.',
              en: "The app's Google Play page (https), opened by the update button, e.g. https://play.google.com/store/apps/details?id=com.goteav.app. Switch it off while the app is not published.",
            },
            type: 'url',
            value: 'https://play.google.com/store/apps/details?id=com.goteav.app',
            default: null,
            nullable: true,
          },
        ],
      },
      {
        id: 'prompt',
        title: {
          ar: 'رسالة التحديث',
          en: 'Update prompt',
        },
        description: {
          ar: 'فارغ = النص العام في التطبيق.',
          en: 'Empty = the app’s own generic text.',
        },
        fields: [
          {
            key: 'updateMessage.ar',
            label: {
              ar: 'العربية',
              en: 'Arabic',
            },
            help: {
              ar: 'النص بالعربية. أوقفه لاستخدام النص الإنجليزي.',
              en: 'Arabic text. Switch it off to use the English text.',
            },
            type: 'string',
            value: 'يتوفر إصدار جديد بتحسينات على الدفع.',
            default: null,
            nullable: true,
            max: 500,
          },
          {
            key: 'updateMessage.en',
            label: {
              ar: 'الإنجليزية',
              en: 'English',
            },
            help: {
              ar: 'النص بالإنجليزية (مطلوب).',
              en: 'English text (required).',
            },
            type: 'string',
            value: 'A new version with payment improvements is available.',
            default: null,
            nullable: true,
            max: 500,
          },
        ],
      },
      {
        id: 'identifiers',
        title: {
          ar: 'المعرّفات',
          en: 'Identifiers',
        },
        description: {
          ar: 'للروابط العامة وتسجيل الدخول الأصلي.',
          en: 'For universal links and native sign-in.',
        },
        fields: [
          {
            key: 'identifiers.iosBundleId',
            label: {
              ar: 'معرّف حزمة iOS (Bundle ID)',
              en: 'iOS bundle ID',
            },
            help: {
              ar: 'معرّف حزمة تطبيق الآيفون مثل com.goteav.app. مع معرّف الفريق يجعل الآيفون يفتح روابط الموقع داخل التطبيق، وهو التطبيق الذي يجب أن يأتي منه تسجيل الدخول بآبل. تجده في Xcode (الهدف ← General ← Bundle Identifier) أو في App Store Connect ← App Information. أوقفه ما دام لا يوجد تطبيق آيفون.',
              en: "The iPhone app's bundle identifier, e.g. com.goteav.app. With the Team ID it lets iPhones open website links in the app, and it is the app native Apple sign-in must come from. Find it in Xcode (target → General → Bundle Identifier) or App Store Connect → App Information. Switch it off while there is no iPhone app.",
            },
            type: 'string',
            value: 'com.goteav.app',
            default: null,
            nullable: true,
            max: 155,
          },
          {
            key: 'identifiers.appleTeamId',
            label: {
              ar: 'معرّف فريق آبل (Team ID)',
              en: 'Apple Team ID',
            },
            help: {
              ar: 'معرّف حساب مطوّر آبل من 10 خانات مثل A1B2C3D4E5. يُدمج مع معرّف الحزمة في ملف apple-app-site-association؛ وبدونه تُفتح روابط الآيفون في المتصفح. تجده في developer.apple.com ← Account ← Membership details.',
              en: 'The 10-character ID of the Apple developer account, e.g. A1B2C3D4E5. Combined with the bundle ID in apple-app-site-association; without it iPhone links open in the browser. Find it at developer.apple.com → Account → Membership details.',
            },
            type: 'string',
            value: 'K7P2QX9ABC',
            default: null,
            nullable: true,
          },
          {
            key: 'identifiers.androidPackage',
            label: {
              ar: 'اسم حزمة الأندرويد',
              en: 'Android package name',
            },
            help: {
              ar: 'معرّف تطبيق الأندرويد مثل com.goteav.app. يُنشر في ملف assetlinks.json حتى يفتح الأندرويد روابط الموقع داخل التطبيق. تجده في ملف build.gradle للتطبيق (applicationId) أو تحت اسم التطبيق في Play Console. أوقفه ما دام لا يوجد تطبيق أندرويد.',
              en: "The Android application ID, e.g. com.goteav.app. Published in assetlinks.json so Android opens website links in the app. Find it in the app's build.gradle (applicationId) or under the app name in Play Console. Switch it off while there is no Android app.",
            },
            type: 'string',
            value: 'com.goteav.app',
            default: null,
            nullable: true,
            max: 155,
          },
          {
            key: 'identifiers.androidSha256Fingerprints',
            label: {
              ar: 'بصمات توقيع الأندرويد (SHA-256)',
              en: 'Android signing fingerprints (SHA-256)',
            },
            help: {
              ar: 'بصمات الشهادات التي تُوقِّع تطبيق الأندرويد: لا يفتح روابط الموقع إلا تطبيق موقَّع بإحداها. أضف بصمة مفتاح الرفع وبصمة مفتاح توقيع Google Play معًا، من Play Console ← Setup ← App integrity ← App signing. حتى 10 بصمات.',
              en: 'Fingerprints of the certificates that sign the Android app: only an app signed with one of them opens website links. Add both the upload key and the Google Play app signing key, from Play Console → Setup → App integrity → App signing. Up to 10.',
            },
            type: 'string-list',
            value: ['1F:2A:…:9C (upload)', '7B:E0:…:44 (Play)'],
            default: [],
            max: 10,
          },
          {
            key: 'identifiers.googleClientIds',
            label: {
              ar: 'معرّفات عملاء جوجل الإضافية',
              en: 'Extra Google client IDs',
            },
            help: {
              ar: 'معرّفات OAuth لتطبيقات الموبايل (iOS وأندرويد) التي يقبل الخادم "تسجيل الدخول بجوجل" منها. معرّف الموقع مقبول دائمًا ولا حاجة لإضافته. بدونها يُرفض تسجيل الدخول بجوجل في التطبيق. تجدها في Google Cloud Console ← APIs & Services ← Credentials. حتى 10 معرّفات.',
              en: 'Google OAuth client IDs of the mobile apps (iOS and Android) whose "Sign in with Google" the server accepts. The website\'s client ID is always accepted and need not be listed. Without them, Google sign-in in the app is refused. Find them in Google Cloud Console → APIs & Services → Credentials. Up to 10.',
            },
            type: 'string-list',
            value: ['1234567890-ios.apps.googleusercontent.com'],
            default: [],
            max: 10,
          },
        ],
      },
      {
        id: 'links',
        title: {
          ar: 'روابط التطبيق',
          en: 'App links',
        },
        description: {
          ar: 'الأساس والمسار الذي يفتح التطبيق دائمًا.',
          en: 'The base and the path that always opens the app.',
        },
        fields: [
          {
            key: 'links.universalLinkBase',
            label: {
              ar: 'عنوان روابط التطبيق',
              en: 'App links address',
            },
            help: {
              ar: 'عنوان https الذي تفتح روابطه التطبيق، وهو عادةً الموقع مثل https://goteav.com. تُبنى عليه روابط العودة من الدفع والروابط في الإيميلات. أوقفه لاستخدام عنوان الموقع.',
              en: 'The https address whose links open the app, normally the website, e.g. https://goteav.com. The payment return and the links in e-mails are built on it. Switch it off to use the website address.',
            },
            type: 'url',
            value: 'https://goteav.com',
            default: null,
            nullable: true,
          },
          {
            key: 'links.appPathPrefix',
            label: {
              ar: 'مسار التطبيق',
              en: 'App path',
            },
            help: {
              ar: 'المسار تحت العنوان الذي يفتح التطبيق دائمًا مثل /app: بعد الدفع بالبطاقة داخل التطبيق يعود العميل إلى <العنوان>/app/payment-return. تغييره يعطّل روابط نسخ التطبيق المبنية على المسار القديم؛ أبقِ /app ما لم يطلب فريق التطبيق غير ذلك.',
              en: 'Path under the address that always opens the app, e.g. /app: after a card payment in the app the customer comes back to <address>/app/payment-return. Changing it breaks the links of app versions built for the old path; keep /app unless the app team asks.',
            },
            type: 'string',
            value: '/app',
            default: '/app',
          },
        ],
      },
    ],
  },
  {
    key: 'analytics',
    section: 'system',
    icon: 'BarChart3',
    title: {
      ar: 'التحليلات',
      en: 'Analytics',
    },
    summary: {
      ar: 'مدد الاحتفاظ وحدود التقارير',
      en: 'Retention and report limits',
    },
    description: {
      ar: 'مدد الاحتفاظ بالتحليلات، وحدود البث المباشر، وعتبات قدرات شركات الطيران، وتخزين بيانات القياس مؤقتًا، وضوابط التقارير.',
      en: 'Analytics retention windows, live stream limits, airline capability thresholds, telemetry buffering and report guard rails.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 2,
    schemaVersion: 1,
    updatedAt: '2026-09-21T10:00:00.000Z',
    updatedBy: 'System (defaults)',
    subsections: [
      {
        id: 'retention',
        title: {
          ar: 'الاحتفاظ',
          en: 'Retention',
        },
        description: {
          ar: 'مدة بقاء جداول التحليلات.',
          en: 'How long the analytics tables are kept.',
        },
        fields: [
          {
            key: 'retention.providerCallDays',
            label: {
              ar: 'استدعاءات المورّد (أيام)',
              en: 'Supplier calls (days)',
            },
            help: {
              ar: 'عدد أيام الاحتفاظ بسجل استدعاءات المورّد.',
              en: 'Days the supplier call log is kept.',
            },
            type: 'duration',
            value: 365,
            default: 365,
            unit: 'days',
            min: 1,
            max: 3650,
          },
          {
            key: 'retention.searchSummaryDays',
            label: {
              ar: 'ملخصات البحث (أيام)',
              en: 'Search summaries (days)',
            },
            help: {
              ar: 'عدد أيام الاحتفاظ بملخص كل عملية بحث.',
              en: 'Days per-search summaries are kept.',
            },
            type: 'duration',
            value: 365,
            default: 365,
            unit: 'days',
            min: 1,
            max: 3650,
          },
          {
            key: 'retention.searchOfferDays',
            label: {
              ar: 'العروض التي تم التفاعل معها (أيام)',
              en: 'Viewed offers (days)',
            },
            help: {
              ar: 'عدد أيام الاحتفاظ بأرشيف العروض التي تفاعل معها العملاء.',
              en: 'Days the archive of offers customers interacted with is kept.',
            },
            type: 'duration',
            value: 180,
            default: 180,
            unit: 'days',
            min: 1,
            max: 3650,
          },
          {
            key: 'retention.funnelEventDays',
            label: {
              ar: 'أحداث مسار التحويل (أيام)',
              en: 'Funnel events (days)',
            },
            help: {
              ar: 'عدد أيام الاحتفاظ بأحداث مسار التحويل الأولية.',
              en: 'Days raw funnel events are kept.',
            },
            type: 'duration',
            value: 180,
            default: 180,
            unit: 'days',
            min: 1,
            max: 3650,
          },
          {
            key: 'retention.orderFactDays',
            label: {
              ar: 'بيانات الحجوزات (أيام)',
              en: 'Booking facts (days)',
            },
            help: {
              ar: 'عدد أيام الاحتفاظ ببيانات الطلبات والمسافرين لكل حجز.',
              en: 'Days per-booking order and passenger facts are kept.',
            },
            type: 'duration',
            value: 1095,
            default: 1095,
            unit: 'days',
            min: 1,
            max: 3650,
          },
          {
            key: 'retention.dailyStatDays',
            label: {
              ar: 'الملخص اليومي (أيام)',
              en: 'Daily summary (days)',
            },
            help: {
              ar: 'عدد أيام الاحتفاظ بالملخص اليومي.',
              en: 'Days the daily summary is kept.',
            },
            type: 'duration',
            value: 1825,
            default: 1825,
            unit: 'days',
            min: 1,
            max: 3650,
          },
          {
            key: 'retention.batchSize',
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
        ],
      },
      {
        id: 'reports',
        title: {
          ar: 'التقارير',
          en: 'Reports',
        },
        description: {
          ar: 'إخفاء المجموعات الصغيرة ومهلة الاستعلام.',
          en: 'Small-group collapsing and the query timeout.',
        },
        fields: [
          {
            key: 'reports.minGroupSize',
            label: {
              ar: 'أصغر مجموعة',
              en: 'Smallest group',
            },
            help: {
              ar: 'مجموعات المسافرين الأصغر من هذا العدد تُدمج في "أخرى" قبل خروج التقرير من الخادم (للخصوصية).',
              en: 'Passenger groups smaller than this are merged into "Other" before a report leaves the server (privacy).',
            },
            type: 'integer',
            value: 5,
            default: 5,
            min: 1,
            max: 1000,
          },
          {
            key: 'reports.statementTimeoutMs',
            label: {
              ar: 'مهلة الاستعلام (ملّي ثانية)',
              en: 'Query time limit (ms)',
            },
            help: {
              ar: 'المهلة القصوى لاستعلام تقرير تحليلات واحد.',
              en: 'Time limit of one analytics report query.',
            },
            type: 'duration',
            value: 15000,
            default: 15000,
            unit: 'ms',
            min: 1000,
            max: 120000,
            advanced: true,
          },
        ],
      },
      {
        id: 'live',
        title: {
          ar: 'البث الحي',
          en: 'Live stream',
        },
        description: {
          ar: 'لوحة الأرقام الحية للإدارة.',
          en: 'The admin live numbers.',
        },
        fields: [
          {
            key: 'live.enabled',
            label: {
              ar: 'مفعّل',
              en: 'Enabled',
            },
            help: {
              ar: 'المفتاح الرئيسي للبث المباشر.',
              en: 'Master switch for the admin live stream.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'live.intervalSeconds',
            label: {
              ar: 'التحديث كل (ثوانٍ)',
              en: 'Update every (seconds)',
            },
            help: {
              ar: 'عدد الثواني بين لقطتين تُرسلان إلى المشاهد.',
              en: 'Seconds between two snapshots sent to a viewer.',
            },
            type: 'duration',
            value: 5,
            default: 5,
            unit: 'seconds',
            min: 1,
            max: 60,
            advanced: true,
          },
          {
            key: 'live.heartbeatSeconds',
            label: {
              ar: 'إبقاء الاتصال (ثوانٍ)',
              en: 'Keep-alive (seconds)',
            },
            help: {
              ar: 'عدد الثواني بين رسائل إبقاء الاتصال التي تمنع الوكيل من إغلاق البث.',
              en: 'Seconds between keep-alive messages that stop a proxy closing the stream.',
            },
            type: 'duration',
            value: 15,
            default: 15,
            unit: 'seconds',
            min: 5,
            max: 120,
            advanced: true,
          },
          {
            key: 'live.maxClients',
            label: {
              ar: 'أقصى عدد من المشاهدين',
              en: 'Most viewers',
            },
            help: {
              ar: 'عدد المشاهدين الذين يخدمهم خادم واحد قبل أن يرد بأنه مشغول (503).',
              en: 'Viewers one server serves before it answers busy (503).',
            },
            type: 'integer',
            value: 10,
            default: 10,
            min: 1,
            max: 100,
            advanced: true,
          },
          {
            key: 'live.maxDurationMinutes',
            label: {
              ar: 'أطول اتصال (دقائق)',
              en: 'Longest connection (minutes)',
            },
            help: {
              ar: 'عدد الدقائق التي ينتهي بعدها البث ويعيد المشاهد الاتصال.',
              en: 'Minutes after which the stream ends and the viewer reconnects.',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'minutes',
            min: 1,
            max: 240,
            advanced: true,
          },
          {
            key: 'live.minuteRetentionHours',
            label: {
              ar: 'العدادات بالدقيقة (ساعات)',
              en: 'Per-minute counters (hours)',
            },
            help: {
              ar: 'عدد ساعات الاحتفاظ بعدادات البث لكل دقيقة.',
              en: 'Hours per-minute live counters are kept.',
            },
            type: 'duration',
            value: 3,
            default: 3,
            unit: 'hours',
            min: 1,
            max: 48,
            advanced: true,
          },
          {
            key: 'live.hourRetentionDays',
            label: {
              ar: 'العدادات بالساعة (أيام)',
              en: 'Per-hour counters (days)',
            },
            help: {
              ar: 'عدد أيام الاحتفاظ بعدادات البث لكل ساعة.',
              en: 'Days per-hour live counters are kept.',
            },
            type: 'duration',
            value: 7,
            default: 7,
            unit: 'days',
            min: 1,
            max: 90,
            advanced: true,
          },
          {
            key: 'live.activeHoldsCacheSeconds',
            label: {
              ar: 'تخزين عدد الحجوزات المؤقتة (ثوانٍ)',
              en: 'Active holds cache (seconds)',
            },
            help: {
              ar: 'عدد الثواني التي يُخزَّن فيها عدد الحجوزات المؤقتة النشطة قبل قراءته مجددًا.',
              en: 'Seconds the count of active holds is cached before it is read again.',
            },
            type: 'duration',
            value: 10,
            default: 10,
            unit: 'seconds',
            min: 1,
            max: 300,
            advanced: true,
          },
        ],
      },
      {
        id: 'capabilities',
        title: {
          ar: 'قدرات شركات الطيران',
          en: 'Airline capabilities',
        },
        description: {
          ar: 'متى يحكم السجل بأن شركة تدعم قدرة ما.',
          en: 'When the registry decides an airline supports a capability.',
        },
        fields: [
          {
            key: 'capabilities.minObservations',
            label: {
              ar: 'أقل عدد من المشاهدات',
              en: 'Fewest observations',
            },
            help: {
              ar: 'عدد المشاهدات اللازم قبل أن يجيب السجل بغير "غير معروف".',
              en: 'Observations needed before the registry answers anything other than unknown.',
            },
            type: 'integer',
            value: 20,
            default: 20,
            min: 1,
            max: 10000,
            advanced: true,
          },
          {
            key: 'capabilities.supportedShare',
            label: {
              ar: 'مدعومة من',
              en: 'Supported from',
            },
            help: {
              ar: 'النسبة الممهّدة للنتائج الإيجابية التي تُعد القدرة عندها أو فوقها مدعومة.',
              en: 'Smoothed share of positive results at or above which a capability counts as supported.',
            },
            type: 'number',
            value: 0.8,
            default: 0.8,
            min: 0.5,
            max: 1,
            unit: 'ratio',
            advanced: true,
            step: 0.05,
          },
          {
            key: 'capabilities.unsupportedShare',
            label: {
              ar: 'غير مدعومة حتى',
              en: 'Unsupported up to',
            },
            help: {
              ar: 'النسبة الممهّدة للنتائج الإيجابية التي تُعد القدرة عندها أو دونها غير مدعومة.',
              en: 'Smoothed share of positive results at or below which a capability counts as unsupported.',
            },
            type: 'number',
            value: 0.2,
            default: 0.2,
            min: 0,
            max: 0.5,
            unit: 'ratio',
            advanced: true,
            step: 0.05,
          },
          {
            key: 'capabilities.matrixCacheSeconds',
            label: {
              ar: 'تخزين المصفوفة (ثوانٍ)',
              en: 'Matrix cache (seconds)',
            },
            help: {
              ar: 'عدد ثواني تخزين مصفوفة القدرات (0 يوقف التخزين).',
              en: 'Seconds the capability matrix is cached (0 turns the cache off).',
            },
            type: 'duration',
            value: 60,
            default: 60,
            unit: 'seconds',
            min: 0,
            max: 3600,
            advanced: true,
          },
        ],
      },
      {
        id: 'sink',
        title: {
          ar: 'مخزن القياس',
          en: 'Telemetry sink',
        },
        description: {
          ar: 'تخزين مؤقت للقياسات قبل الكتابة.',
          en: 'Buffering of telemetry before it is written.',
        },
        fields: [
          {
            key: 'sink.enabled',
            label: {
              ar: 'مفعّل',
              en: 'Enabled',
            },
            help: {
              ar: 'المفتاح الرئيسي لمخزن بيانات القياس.',
              en: 'Master switch for the telemetry buffer.',
            },
            type: 'boolean',
            value: true,
            default: true,
            advanced: true,
          },
          {
            key: 'sink.flushIntervalMs',
            label: {
              ar: 'التفريغ كل (ملّي ثانية)',
              en: 'Flush every (ms)',
            },
            help: {
              ar: 'عدد الملّي ثواني بين تفريغين للمخزن.',
              en: 'Milliseconds between two flushes of the buffer.',
            },
            type: 'duration',
            value: 1000,
            default: 1000,
            unit: 'ms',
            min: 100,
            max: 60000,
            advanced: true,
          },
          {
            key: 'sink.flushRows',
            label: {
              ar: 'التفريغ عند (صفوف)',
              en: 'Flush at (rows)',
            },
            help: {
              ar: 'عدد الصفوف المخزنة الذي يؤدي إلى تفريغ فوري.',
              en: 'Buffered rows that trigger an immediate flush.',
            },
            type: 'integer',
            value: 200,
            default: 200,
            min: 1,
            max: 5000,
            advanced: true,
          },
          {
            key: 'sink.maxBufferedRows',
            label: {
              ar: 'أقصى صفوف مخزنة',
              en: 'Most buffered rows',
            },
            help: {
              ar: 'حد صارم، فوقه تُحذف أقدم الصفوف ويُرفع تنبيه للعمليات.',
              en: 'Hard limit. Above it the oldest rows are dropped and an operations alert is raised.',
            },
            type: 'integer',
            value: 5000,
            default: 5000,
            min: 100,
            max: 100000,
            advanced: true,
          },
        ],
      },
    ],
  },
  {
    key: 'audit',
    section: 'system',
    icon: 'ScrollText',
    title: {
      ar: 'سجلّ التدقيق',
      en: 'Audit log',
    },
    summary: {
      ar: 'الاحتفاظ بسجل التدقيق والنشاط',
      en: 'Audit log and activity retention',
    },
    description: {
      ar: 'مدة الاحتفاظ بسجل تدقيق الموظفين وسجل نشاط العملاء.',
      en: 'Retention of the staff audit log and the customer activity feed.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 1,
    schemaVersion: 1,
    updatedAt: '2026-09-27T23:20:00.000Z',
    updatedBy: 'System (defaults)',
    subsections: [
      {
        id: 'retention',
        title: {
          ar: 'الاحتفاظ',
          en: 'Retention',
        },
        description: {
          ar: 'سجل تدقيق الموظفين ونشاط العملاء.',
          en: 'The staff audit log and the customer activity feed.',
        },
        fields: [
          {
            key: 'retentionDays',
            label: {
              ar: 'سجل التدقيق (أيام)',
              en: 'Audit log (days)',
            },
            help: {
              ar: 'عدد أيام الاحتفاظ بسجل تدقيق الموظفين.',
              en: 'Days a staff audit log row is kept.',
            },
            type: 'duration',
            value: 730,
            default: 730,
            unit: 'days',
            min: 30,
            max: 3650,
          },
          {
            key: 'activityRetentionDays',
            label: {
              ar: 'نشاط العملاء (أيام)',
              en: 'Customer activity (days)',
            },
            help: {
              ar: 'عدد أيام الاحتفاظ بسجل نشاط العملاء.',
              en: 'Days a customer activity row is kept.',
            },
            type: 'duration',
            value: 365,
            default: 365,
            unit: 'days',
            min: 30,
            max: 3650,
          },
          {
            key: 'batchSize',
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
            key: 'maxBatches',
            label: {
              ar: 'الدفعات في كل تشغيل',
              en: 'Batches per run',
            },
            help: {
              ar: 'حد أمان: عدد عمليات الحذف لكل جدول في التشغيل الليلي الواحد.',
              en: 'Safety limit: deletes per table in one nightly run.',
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
    key: 'storage',
    section: 'system',
    icon: 'Database',
    title: {
      ar: 'تخزين الملفات',
      en: 'File storage',
    },
    summary: {
      ar: 'مهملات الإدارة',
      en: 'Admin trash',
    },
    description: {
      ar: 'مهملات الإدارة: مدة بقاء الملفات التي يحذفها الموظفون، والتنظيف الليلي.',
      en: 'The admin trash: how long files deleted by staff are kept, and the nightly clean-up.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 3,
    schemaVersion: 3,
    updatedAt: '2026-11-04T12:55:00.000Z',
    updatedBy: 'System (defaults)',
    subsections: [
      {
        id: 'trash',
        title: {
          ar: 'المهملات',
          en: 'Trash',
        },
        description: {
          ar: 'مدة بقاء الملفات المحذوفة قابلة للاستعادة.',
          en: 'How long deleted files stay restorable.',
        },
        fields: [
          {
            key: 'trash.retentionDays',
            label: {
              ar: 'مدة البقاء (أيام)',
              en: 'Kept for (days)',
            },
            help: {
              ar: 'عدد الأيام التي يبقى فيها الملف المحذوف في المهملات قبل حذفه نهائيًا.',
              en: 'Days a file deleted by staff stays in the trash before it is removed for good.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'days',
            min: 1,
            max: 365,
          },
          {
            key: 'trash.batchSize',
            label: {
              ar: 'حجم دفعة الحذف النهائي',
              en: 'Removal batch size',
            },
            help: {
              ar: 'عدد الملفات التي يحذفها التنظيف الليلي في كل تشغيل.',
              en: 'Files the nightly clean-up removes per run.',
            },
            type: 'integer',
            value: 200,
            default: 200,
            min: 1,
            max: 5000,
            advanced: true,
          },
        ],
      },
    ],
  },
  {
    key: 'retention',
    section: 'system',
    icon: 'Hourglass',
    title: {
      ar: 'مدد الاحتفاظ بالبيانات',
      en: 'Data retention',
    },
    summary: {
      ar: 'تنظيف جداول البنية التحتية',
      en: 'Infrastructure clean-up',
    },
    description: {
      ar: 'كم يومًا تبقى السطور المنتهية في جداول البنية التحتية (الأحداث الداخلية، وإشعارات مزوّدي الدفع والطيران، والإشعارات المرسلة، وسجلات بحث الرحلات) قبل أن تحذفها مهمة التنظيف الليلية على دفعات. لا تُحذف أبدًا الأعمال التي لم تنتهِ بعد مهما كان عمرها.',
      en: 'How long finished rows of the infrastructure tables (internal events, provider webhooks, notifications, flight search logs) are kept before the nightly clean-up deletes them. Unfinished work is never deleted, whatever its age.',
    },
    kind: 'server',
    inDashboard: true,
    approval: 'none',
    version: 3,
    schemaVersion: 2,
    updatedAt: '2026-11-05T02:10:00.000Z',
    updatedBy: 'Khaled Nasser',
    masterSwitch: 'enabled',
    enabled: true,
    subsections: [
      {
        id: 'switch',
        title: {
          ar: 'التنظيف الليلي',
          en: 'Nightly clean-up',
        },
        description: {
          ar: 'لا يُحذف إلا ما انتهى؛ العمل المعلّق لا يُمسّ.',
          en: 'Only finished rows are deleted; pending work is never touched.',
        },
        fields: [
          {
            key: 'enabled',
            label: {
              ar: 'تشغيل التنظيف الليلي',
              en: 'Nightly clean-up',
            },
            help: {
              ar: 'عند إيقافه لا تحذف مهمة الاحتفاظ الليلية أي سطر.',
              en: 'Master switch: when off, the nightly retention job deletes nothing.',
            },
            type: 'boolean',
            value: true,
            default: true,
          },
          {
            key: 'batchSize',
            label: {
              ar: 'حجم دفعة الحذف',
              en: 'Delete batch size',
            },
            help: {
              ar: 'عدد السطور التي يحذفها أمر حذف واحد قبل أن تنتقل المهمة إلى الدفعة التالية.',
              en: 'Rows one delete removes before the job moves on to the next batch.',
            },
            type: 'integer',
            value: 5000,
            default: 5000,
            min: 100,
            max: 50000,
            advanced: true,
          },
        ],
      },
      {
        id: 'events',
        title: {
          ar: 'الأحداث والـ webhooks',
          en: 'Events & webhooks',
        },
        description: {
          ar: 'أحداث النظام الداخلية وإشعارات المزوّدين.',
          en: 'Internal events and provider webhooks.',
        },
        fields: [
          {
            key: 'outboxDeliveredDays',
            label: {
              ar: 'الأحداث الداخلية المسلَّمة (أيام)',
              en: 'Delivered internal events (days)',
            },
            help: {
              ar: 'كم يومًا يبقى الحدث الداخلي بعد أن عالجه كل المستهلكين. الأحداث التي لم تُسلَّم بعد لا تُحذف أبدًا.',
              en: 'Days an internal event is kept after every consumer handled it. Events not delivered yet are never deleted.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'days',
            min: 7,
            max: 3650,
          },
          {
            key: 'processedEventDays',
            label: {
              ar: 'علامات الأحداث المعالَجة (أيام)',
              en: 'Handled-event markers (days)',
            },
            help: {
              ar: 'كم يومًا تبقى علامات «عولج من قبل» للأحداث الداخلية. علامة حدث ما زال ينتظر التسليم أو إعادة الإرسال لا تُحذف أبدًا.',
              en: 'Days the "already handled" markers of internal events are kept. The marker of an event still waiting for delivery or a re-drive is never deleted.',
            },
            type: 'duration',
            value: 30,
            default: 30,
            unit: 'days',
            min: 7,
            max: 3650,
          },
          {
            key: 'webhookEventDays',
            label: {
              ar: 'إشعارات المزوّدين الواردة (أيام)',
              en: 'Provider webhooks (days)',
            },
            help: {
              ar: 'كم يومًا يبقى إشعار المزوّد (بوابات الدفع وDuffel) بعد معالجته أو تجاهله. الإشعارات المستلمة أو قيد المعالجة أو الفاشلة لا تُحذف أبدًا.',
              en: 'Days a provider webhook (payment gateways, Duffel) is kept after it was processed or ignored. Received, in-progress and failed webhooks are never deleted.',
            },
            type: 'duration',
            value: 90,
            default: 90,
            unit: 'days',
            min: 30,
            max: 3650,
          },
        ],
      },
      {
        id: 'messages',
        title: {
          ar: 'الرسائل والسجلات',
          en: 'Messages & logs',
        },
        description: {
          ar: 'الرسائل المرسلة وسجلات البحث وإشعارات الموظفين وأخطاء اللوحة.',
          en: 'Sent messages, search logs, staff notifications and dashboard errors.',
        },
        fields: [
          {
            key: 'notificationDays',
            label: {
              ar: 'الإشعارات المنتهية (أيام)',
              en: 'Finished notifications (days)',
            },
            help: {
              ar: 'كم يومًا يبقى الإشعار المرسل أو الفاشل أو الملغى (وفيه بيانات شخصية مختومة). الإشعارات المنتظرة لا تُحذف أبدًا.',
              en: 'Days a sent, failed or cancelled notification (it holds sealed personal data) is kept. Pending notifications are never deleted.',
            },
            type: 'duration',
            value: 180,
            default: 180,
            unit: 'days',
            min: 30,
            max: 3650,
          },
          {
            key: 'flightSearchLogDays',
            label: {
              ar: 'سجلات بحث الرحلات (أيام)',
              en: 'Flight search logs (days)',
            },
            help: {
              ar: 'كم يومًا يبقى سجل بحث الرحلات. التحليلات تحتفظ بملخص لكل بحث وبتجميع يومي خاص بها، فلا تعتمد التقارير على هذه السطور.',
              en: 'Days a flight search log is kept. Analytics keeps its own per-search summaries and daily totals, so reports do not depend on these rows.',
            },
            type: 'duration',
            value: 60,
            default: 180,
            unit: 'days',
            min: 30,
            max: 3650,
          },
          {
            key: 'staffInboxDays',
            label: {
              ar: 'إشعارات الموظفين',
              en: 'Staff notifications',
            },
            help: {
              ar: 'أيام يبقى فيها إشعار اللوحة لدى الموظف. صناديق العملاء لا تُمسّ.',
              en: 'Days a staff member keeps a dashboard notification. Customer inbox rows are not touched.',
            },
            type: 'duration',
            value: 90,
            default: 90,
            unit: 'days',
            min: 30,
            max: 3650,
          },
          {
            key: 'clientErrorDays',
            label: {
              ar: 'أخطاء لوحة التحكم',
              en: 'Dashboard errors',
            },
            help: {
              ar: 'أيام تبقى مجموعة الخطأ بعد آخر ظهور لها.',
              en: 'Days a dashboard error group is kept after it was last seen.',
            },
            type: 'duration',
            value: 90,
            default: 90,
            unit: 'days',
            min: 7,
            max: 3650,
          },
          {
            key: 'clientErrorMaxRows',
            label: {
              ar: 'أقصى عدد لمجموعات الأخطاء',
              en: 'Most error groups',
            },
            help: {
              ar: 'بعده يُتجاهل نوع الخطأ الجديد ويُحذف الأقدم ليلًا.',
              en: 'Past it a new kind of error is dropped and the least recently seen are removed nightly.',
            },
            type: 'integer',
            value: 5000,
            default: 5000,
            min: 100,
            max: 100000,
          },
        ],
      },
    ],
  },
];

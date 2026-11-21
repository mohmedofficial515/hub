// Version history of 9 groups, newest first (the first entry is the current version).
// Generated from the backend groups (src/modules/settings/groups) and the dashboard dictionaries; see audit.md
// in dashboard/settings. Fields with `proposed: true` are NOT in the real API (audit proposals, P0/P1).

import type { SettingsHistoryEntry } from './types';

export const SETTINGS_HISTORY: Record<string, SettingsHistoryEntry[]> = {
  platform: [
    {
      version: 9,
      at: '2026-11-18T07:40:00.000Z',
      by: 'Sara Haddad',
      note: {
        ar: 'التقارير بتوقيت إسطنبول',
        en: 'Reports in Istanbul time',
      },
      changes: [
        {
          field: 'timezone',
          from: 'UTC',
          to: 'Europe/Istanbul',
        },
      ],
    },
    {
      version: 8,
      at: '2026-11-05T15:00:00.000Z',
      by: 'Omar Kaya',
      note: {
        ar: 'نشر صفحتي الشروط والخصوصية',
        en: 'Terms and privacy pages published',
      },
      changes: [
        {
          field: 'legal.termsUrl',
          from: null,
          to: 'https://goteav.com/ar/terms',
        },
        {
          field: 'legal.privacyUrl',
          from: null,
          to: 'https://goteav.com/ar/privacy',
        },
      ],
    },
    {
      version: 7,
      at: '2026-10-29T09:10:00.000Z',
      by: 'Sara Haddad',
      note: {
        ar: 'العربية أولًا للزوار الجدد',
        en: 'Arabic first for new visitors',
      },
      changes: [
        {
          field: 'defaultLocale',
          from: 'en',
          to: 'ar',
        },
      ],
    },
    {
      version: 6,
      at: '2026-10-12T12:00:00.000Z',
      by: 'Lina Mansour',
      note: null,
      changes: [
        {
          field: 'supportPhone',
          from: null,
          to: '+905321234567',
        },
        {
          field: 'supportWhatsapp',
          from: null,
          to: '+905321234567',
        },
      ],
    },
    {
      version: 5,
      at: '2026-09-24T08:30:00.000Z',
      by: 'Sara Haddad',
      note: {
        ar: 'إعادة السماح بالحجز دون حساب',
        en: 'Guest checkout allowed again',
      },
      changes: [
        {
          field: 'features.guestCheckout',
          from: false,
          to: true,
        },
      ],
    },
  ],
  maintenance: [
    {
      version: 2,
      at: '2026-11-18T08:05:00.000Z',
      by: 'Omar Kaya',
      note: {
        ar: 'نافذة ترقية المدفوعات',
        en: 'Payments upgrade window',
      },
      changes: [
        {
          field: 'scope',
          from: 'full',
          to: 'areas',
        },
        {
          field: 'areas',
          from: [],
          to: ['payments', 'wallet'],
        },
        {
          field: 'window.startsAt',
          from: null,
          to: '2026-11-20T23:00:00+03:00',
        },
        {
          field: 'window.endsAt',
          from: null,
          to: '2026-11-21T01:30:00+03:00',
        },
        {
          field: 'drainMinutes',
          from: 15,
          to: 30,
        },
      ],
    },
    {
      version: 1,
      at: '2026-11-18T07:30:00.000Z',
      by: 'System (defaults)',
      note: {
        ar: 'القيم الافتراضية',
        en: 'Defaults',
      },
      changes: [],
    },
  ],
  security: [
    {
      version: 14,
      at: '2026-11-12T16:20:00.000Z',
      by: 'Sara Haddad',
      note: {
        ar: 'موظفو مكتب الرياض يحتاجون ثلاثة أيام',
        en: 'The Riyadh office needs three days',
      },
      changes: [
        {
          field: 'invites.ttlHours',
          from: 48,
          to: 72,
        },
      ],
    },
    {
      version: 13,
      at: '2026-11-08T10:00:00.000Z',
      by: 'Omar Kaya',
      note: {
        ar: 'تجهيز شبكة المكتب (القائمة ما زالت متوقفة)',
        en: 'Prepare the office network (the list is still off)',
      },
      changes: [
        {
          field: 'adminIpAllowlist.cidrs',
          from: [],
          to: ['85.105.12.0/24'],
        },
      ],
      requestId: 'scr_7f21c4',
      approvedBy: 'Sara Haddad',
    },
    {
      version: 12,
      at: '2026-10-30T18:45:00.000Z',
      by: 'Sara Haddad',
      note: null,
      changes: [
        {
          field: 'lockout.backoffMinutes',
          from: [1, 5, 15],
          to: [1, 5, 15, 60],
        },
      ],
    },
    {
      version: 11,
      at: '2026-10-15T07:20:00.000Z',
      by: 'Sara Haddad',
      note: {
        ar: 'روابط الدخول تصل متأخرة إلى بعض صناديق البريد',
        en: 'Sign-in links reach some inboxes late',
      },
      changes: [
        {
          field: 'magicLink.ttlMinutes',
          from: 10,
          to: 15,
        },
      ],
    },
  ],
  refund_policy: [
    {
      version: 17,
      at: '2026-11-15T12:05:00.000Z',
      by: 'Omar Kaya',
      note: {
        ar: 'خفض الشحن الواحد بعد موجة تجربة بطاقات',
        en: 'Lower single top-up after a card-testing wave',
      },
      changes: [
        {
          field: 'walletTopUp.maxUsd',
          from: 5000,
          to: 3000,
        },
      ],
    },
    {
      version: 16,
      at: '2026-11-10T14:30:00.000Z',
      by: 'Sara Haddad',
      note: {
        ar: 'صفحة الفشل على الموقع تعرض الاختيار الآن',
        en: 'The web failure page now offers the choice',
      },
      changes: [
        {
          field: 'failedBooking.mode',
          from: 'ORIGINAL_METHOD',
          to: 'CUSTOMER_CHOICE',
        },
        {
          field: 'failedBooking.walletIncentivePercent',
          from: null,
          to: 5,
        },
      ],
    },
    {
      version: 15,
      at: '2026-11-01T11:00:00.000Z',
      by: 'Sara Haddad',
      note: {
        ar: 'استرداد الموظفين حتى 250$ لا يحتاج موافقة ثانية',
        en: 'Staff refunds up to 250 USD need no second approval',
      },
      changes: [
        {
          field: 'approvalThresholdUsd',
          from: 0,
          to: 250,
        },
      ],
    },
    {
      version: 14,
      at: '2026-10-20T16:15:00.000Z',
      by: 'Sara Haddad',
      note: {
        ar: 'حافز 3٪ لمن يختار المحفظة',
        en: '3% bonus for choosing the wallet',
      },
      changes: [
        {
          field: 'walletIncentivePercent',
          from: 0,
          to: 3,
        },
      ],
    },
  ],
  markup_rules: [
    {
      version: 21,
      at: '2026-11-17T19:15:00.000Z',
      by: 'Lina Mansour',
      note: {
        ar: 'حملة نوفمبر',
        en: 'November campaign',
      },
      changes: [
        {
          field: 'rules',
          from: [
            '10 · داخلي تركيا TRY ← 3٪',
            '20 · درجة الأعمال ← 4٪ + 10$ (حد أقصى 250$)',
            '30 · خدمات بعد الحجز ← 8$ ثابتة',
          ],
          to: [
            '10 · داخلي تركيا TRY ← 3٪',
            '20 · درجة الأعمال ← 4٪ + 10$ (حد أقصى 250$)',
            '30 · خدمات بعد الحجز ← 8$ ثابتة',
            '40 · عرض نوفمبر (حتى 30-11) ← 4٪',
          ],
        },
      ],
    },
    {
      version: 20,
      at: '2026-11-03T10:40:00.000Z',
      by: 'Lina Mansour',
      note: null,
      changes: [
        {
          field: 'defaultRule.percent',
          from: 5,
          to: 6,
        },
      ],
    },
    {
      version: 19,
      at: '2026-10-22T13:05:00.000Z',
      by: 'Khaled Nasser',
      note: {
        ar: 'رسوم ثابتة صغيرة لكل حجز',
        en: 'A small fixed fee per booking',
      },
      changes: [
        {
          field: 'defaultRule.mode',
          from: 'percentage',
          to: 'both',
        },
        {
          field: 'defaultRule.fixedUsd',
          from: 0,
          to: 2,
        },
      ],
    },
    {
      version: 18,
      at: '2026-10-05T09:00:00.000Z',
      by: 'Lina Mansour',
      note: null,
      changes: [
        {
          field: 'defaultRule.minUsd',
          from: 0,
          to: 3,
        },
        {
          field: 'defaultRule.maxUsd',
          from: null,
          to: 120,
        },
      ],
    },
    {
      version: 17,
      at: '2026-09-30T08:20:00.000Z',
      by: 'Lina Mansour',
      note: {
        ar: 'أسعار أنظف على الموقع',
        en: 'Cleaner prices on the site',
      },
      changes: [
        {
          field: 'defaultRule.roundTo',
          from: 0.01,
          to: 0.5,
        },
      ],
    },
  ],
  flight_provider: [
    {
      version: 34,
      at: '2026-11-17T22:10:00.000Z',
      by: 'Khaled Nasser',
      note: {
        ar: 'Duffel يفشل طلبات هذا المسار',
        en: 'Duffel fails orders on this route',
      },
      changes: [
        {
          field: 'excludedRoutes',
          from: [],
          to: ['SAW → ESB'],
        },
      ],
    },
    {
      version: 33,
      at: '2026-11-12T15:30:00.000Z',
      by: 'Khaled Nasser',
      note: null,
      changes: [
        {
          field: 'syncLoyaltyToOffer',
          from: 'off',
          to: 'soft',
        },
      ],
    },
    {
      version: 32,
      at: '2026-11-02T09:00:00.000Z',
      by: 'Sara Haddad',
      note: {
        ar: 'أمان التأكيد: الحجز قبل الخصم (موافقة 27-10)',
        en: 'Confirmation safety: hold before charge (approved 27 Oct)',
      },
      changes: [
        {
          field: 'preChargeHold.enabled',
          from: false,
          to: true,
        },
      ],
    },
    {
      version: 31,
      at: '2026-10-25T17:45:00.000Z',
      by: 'Khaled Nasser',
      note: null,
      changes: [
        {
          field: 'holdPolicy.maxHoldHours',
          from: 72,
          to: 48,
        },
        {
          field: 'ticketingAlert.afterHours',
          from: 6,
          to: 4,
        },
      ],
    },
    {
      version: 30,
      at: '2026-10-19T11:10:00.000Z',
      by: 'Sara Haddad',
      note: null,
      changes: [
        {
          field: 'excludedAirlines',
          from: [],
          to: ['W6', 'FR'],
        },
      ],
    },
  ],
  notifications: [
    {
      version: 26,
      at: '2026-11-16T20:45:00.000Z',
      by: 'Omar Kaya',
      note: {
        ar: 'تذكير الرحلة على واتساب',
        en: 'Trip reminder on WhatsApp',
      },
      changes: [
        {
          field: 'events.bookings.trip_reminder',
          from: ['EMAIL', 'PUSH'],
          to: ['EMAIL', 'WHATSAPP', 'PUSH'],
        },
      ],
    },
    {
      version: 25,
      at: '2026-11-10T08:00:00.000Z',
      by: 'Omar Kaya',
      note: {
        ar: 'مجموعة المناوبة على تيليجرام',
        en: 'On-call group on Telegram',
      },
      changes: [
        {
          field: 'opsAlerts.telegramChatIds',
          from: [],
          to: ['-1001934567890'],
        },
      ],
      requestId: 'scr_5b90ae',
      approvedBy: 'Sara Haddad',
    },
    {
      version: 24,
      at: '2026-11-09T22:00:00.000Z',
      by: 'Sara Haddad',
      note: null,
      changes: [
        {
          field: 'opsAlerts.recipients',
          from: [],
          to: ['ops@goteav.com', '+905321234567'],
        },
      ],
    },
    {
      version: 23,
      at: '2026-11-05T10:25:00.000Z',
      by: 'Omar Kaya',
      note: {
        ar: 'الردود تذهب إلى الدعم',
        en: 'Replies go to support',
      },
      changes: [
        {
          field: 'providers.email.replyTo',
          from: null,
          to: 'support@goteav.com',
        },
      ],
    },
  ],
  fraud_policy: [
    {
      version: 8,
      at: '2026-11-02T18:40:00.000Z',
      by: 'Sara Haddad',
      note: {
        ar: 'مراجعة بوابة المرحلة 7',
        en: 'Phase 7 gate review',
      },
      changes: [
        {
          field: 'rules.sameDayTravel.score',
          from: 30,
          to: 35,
        },
        {
          field: 'threeDs.aboveUsd',
          from: 300,
          to: 250,
        },
      ],
    },
    {
      version: 7,
      at: '2026-10-31T13:00:00.000Z',
      by: 'Omar Kaya',
      note: null,
      changes: [
        {
          field: 'cardTesting.blockMinutes',
          from: 30,
          to: 60,
        },
      ],
      requestId: 'scr_31d07b',
      approvedBy: 'Sara Haddad',
    },
    {
      version: 6,
      at: '2026-10-29T08:15:00.000Z',
      by: 'Sara Haddad',
      note: {
        ar: 'تشغيل مراجعة المخاطر',
        en: 'Risk review goes live',
      },
      changes: [
        {
          field: 'review.enabled',
          from: false,
          to: true,
        },
      ],
    },
  ],
  loyalty: [
    {
      version: 11,
      at: '2026-11-06T10:45:00.000Z',
      by: 'Sara Haddad',
      note: {
        ar: 'إعادة إطلاق المستوى الذهبي',
        en: 'Gold tier relaunch',
      },
      changes: [
        {
          field: 'tiers.2.multiplier',
          from: 1.5,
          to: 1.75,
        },
        {
          field: 'tiers.2.discountPercent',
          from: 0,
          to: 5,
        },
      ],
    },
    {
      version: 10,
      at: '2026-10-26T12:00:00.000Z',
      by: 'Sara Haddad',
      note: null,
      changes: [
        {
          field: 'maxManualGrantPoints',
          from: null,
          to: 20000,
        },
      ],
    },
    {
      version: 9,
      at: '2026-10-12T09:30:00.000Z',
      by: 'Lina Mansour',
      note: null,
      changes: [
        {
          field: 'redemption.maxPointsPerRedemption',
          from: null,
          to: 50000,
        },
      ],
    },
  ],
};

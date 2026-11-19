// The 8 settings sections (audit.md §9.1), each listing its groups in display order.
// Generated from the backend groups (src/modules/settings/groups) and the dashboard dictionaries; see audit.md
// in dashboard/settings. Fields with `proposed: true` are NOT in the real API (audit proposals, P0/P1).

import type { SettingsSection } from './types';

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'platform',
    icon: 'ShieldCheck',
    title: {
      ar: 'المنصة والوصول',
      en: 'Platform & access',
    },
    description: {
      ar: 'العلامة واللغات ووضع الصيانة وتسجيل الدخول والحماية من الإساءة',
      en: 'Brand, languages, maintenance, sign-in and abuse protection',
    },
    groupKeys: [
      'platform',
      'maintenance',
      'security',
      'verification_policy',
      'abuse_protection',
      'security_alerts',
    ],
  },
  {
    id: 'customers',
    icon: 'Users',
    title: {
      ar: 'العملاء والمسافرون',
      en: 'Customers & travellers',
    },
    description: {
      ar: 'حسابات العملاء والمسافرون المحفوظون وبرنامج الولاء',
      en: 'Customer accounts, saved travellers and the loyalty programme',
    },
    groupKeys: ['account', 'travellers', 'loyalty'],
  },
  {
    id: 'payments',
    icon: 'CreditCard',
    title: {
      ar: 'المدفوعات والمحفظة',
      en: 'Payments & wallet',
    },
    description: {
      ar: 'بوابات الدفع وطرقه والاسترداد والمحفظة والاحتيال والنزاعات البنكية',
      en: 'Gateways and methods, refunds, wallet, fraud and chargebacks',
    },
    groupKeys: ['payment_methods', 'payment_gateways', 'refund_policy', 'fraud_policy', 'disputes'],
  },
  {
    id: 'pricing',
    icon: 'BadgePercent',
    title: {
      ar: 'التسعير والضرائب',
      en: 'Pricing & tax',
    },
    description: {
      ar: 'الهامش وأسعار الصرف والضريبة والمستندات الإلكترونية التركية',
      en: 'Markup, exchange rates, tax and the Turkish e-documents',
    },
    groupKeys: ['markup_rules', 'fx', 'tax', 'e_invoicing'],
  },
  {
    id: 'finance',
    icon: 'BookOpenCheck',
    title: {
      ar: 'الضوابط المالية',
      en: 'Finance controls',
    },
    description: {
      ar: 'دفتر القيد المزدوج وفحص الأموال اليومي وما يراه المحاسب',
      en: 'Double-entry ledger, the daily money check and what the accountant sees',
    },
    groupKeys: ['finance_ledger', 'money_check', 'accounting_access'],
  },
  {
    id: 'staff',
    icon: 'UserCog',
    title: {
      ar: 'مكتب الموظفين',
      en: 'Staff desk',
    },
    description: {
      ar: 'موافقات حجوزات الموظفين وحدود مدفوعاتهم والخدمات بعد الحجز',
      en: 'Approvals of staff bookings, their payment limits and post-booking extras',
    },
    groupKeys: ['agent_booking_policy', 'agent_payment_policy', 'post_booking_services_policy'],
  },
  {
    id: 'flights',
    icon: 'Plane',
    title: {
      ar: 'الطيران',
      en: 'Flights',
    },
    description: {
      ar: 'مهل الحجز وحدود البحث ومورّد الطيران وضوابط الكلفة',
      en: 'Booking timings, search limits, the flight supplier and cost guards',
    },
    groupKeys: ['flights', 'flight_provider', 'flight_guards'],
  },
  {
    id: 'system',
    icon: 'Database',
    title: {
      ar: 'النظام والبيانات',
      en: 'System & data',
    },
    description: {
      ar: 'الإشعارات وواتساب وتطبيق الموبايل والتحليلات والسجلات ومدد الاحتفاظ',
      en: 'Notifications, WhatsApp, mobile app, analytics, logs and data retention',
    },
    groupKeys: [
      'notifications',
      'whatsapp_provider',
      'mobile_app',
      'analytics',
      'audit',
      'storage',
      'retention',
    ],
  },
];

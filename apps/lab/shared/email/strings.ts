import type { Dict } from './render';

/**
 * The current strings of backend/src/i18n/{ar,en}/emails.json for this template (the real copy).
 * `design` holds strings the redesign adds; those need adding to emails.json (ar, en, tr) on port.
 */
export const baseStrings: Record<'ar' | 'en', Dict> = {
  ar: {
    emails: {
      layout: {
        greeting: 'مرحبًا {name}،',
        greeting_anonymous: 'مرحبًا،',
        signature: 'فريق {siteName}',
        support: 'هل تحتاج إلى مساعدة؟ راسلنا على {supportEmail}.',
        footer: 'وصلتك هذه الرسالة لأن لديك حسابًا أو حجزًا لدى {siteName}.',
        rights: '© {year} {siteName}. جميع الحقوق محفوظة.',
        button_fallback: 'إذا لم يعمل الزر، انسخ الرابط التالي والصقه في متصفحك:',
      },
      bookings: {
        confirmed: {
          subject: 'تم تأكيد حجزك {reference}',
          title: 'تم تأكيد حجزك',
          body: 'خبر سار: تم تأكيد حجزك {reference} عبر {siteName} لدى شركة الطيران.',
          reference: 'مرجع الحجز',
          pnr: 'رمز حجز شركة الطيران (PNR)',
          route: 'المسار',
          airline: 'شركة الطيران',
          departure: 'المغادرة',
          total: 'الإجمالي المدفوع',
          passengers: 'المسافرون',
          ticket_soon: 'يجري إصدار تذكرتك الإلكترونية وستصلك في رسالة منفصلة خلال دقائق.',
          cta: 'عرض حجزي',
        },
      },
      design: { arrow: '←' },
    },
  },
  en: {
    emails: {
      layout: {
        greeting: 'Hello {name},',
        greeting_anonymous: 'Hello,',
        signature: 'The {siteName} team',
        support: 'Need help? Write to us at {supportEmail}.',
        footer: 'You are receiving this email because you have an account or a booking with {siteName}.',
        rights: '© {year} {siteName}. All rights reserved.',
        button_fallback: 'If the button does not work, copy and paste this link into your browser:',
      },
      bookings: {
        confirmed: {
          subject: 'Your booking {reference} is confirmed',
          title: 'Your booking is confirmed',
          body: 'Good news: your booking {reference} with {siteName} is confirmed with the airline.',
          reference: 'Booking reference',
          pnr: 'Airline locator (PNR)',
          route: 'Route',
          airline: 'Airline',
          departure: 'Departure',
          total: 'Total paid',
          passengers: 'Passengers',
          ticket_soon: 'Your e-ticket is being issued and will follow in a separate email within a few minutes.',
          cta: 'View my booking',
        },
      },
      design: { arrow: '→' },
    },
  },
};

/** Deep merge of version strings over the base dictionary. */
export function mergeStrings(base: Dict, extra: Dict): Dict {
  const out: Dict = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key];
    out[key] =
      value && typeof value === 'object' && current && typeof current === 'object'
        ? mergeStrings(current as Dict, value as Dict)
        : value;
  }
  return out;
}

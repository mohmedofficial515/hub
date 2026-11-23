/**
 * Strings of v2-boarding-pass. Step copy follows the approved home (../../home/v3-departure-line/i18n.ts `steps`),
 * because the baseline copy promises destinations and holidays the site does not sell (audit L-08).
 */
export const messages = {
  ar: {
    eyebrow: 'كيف يتم الحجز',
    title: 'رحلتك كلها على بطاقة واحدة',
    lead: 'ثلاث محطات من البحث إلى التذكرة، بلا خطوات مخفية.',
    passLabel: 'بطاقة الحجز',
    stepLabel: 'المحطة',
    needLabel: 'تحتاج',
    stamp: 'تم',
    barcodeAria: 'رمز التذكرة',
    items: [
      {
        title: 'ابحث وقارن',
        body: 'اختر المسار والتاريخ، وقارن الرحلات بسعرها الكامل وأمتعتها وشروطها.',
        need: 'المسار والتاريخ',
      },
      {
        title: 'أدخل بيانات المسافرين وادفع',
        body: 'الاسم كما في الجواز، ثم الدفع بالبطاقة أو من رصيد محفظتك.',
        need: 'الجواز وبطاقة أو محفظة',
      },
      {
        title: 'استلم تذكرتك',
        body: 'تصلك التذكرة الإلكترونية على بريدك، وتدير حجزك في أي وقت من إدارة الحجز.',
        need: 'بريدك الإلكتروني',
      },
    ],
  },
  en: {
    eyebrow: 'How booking works',
    title: 'Your whole trip on one pass',
    lead: 'Three stops from search to ticket, with no hidden steps.',
    passLabel: 'Booking pass',
    stepLabel: 'Stop',
    needLabel: 'You need',
    stamp: 'Done',
    barcodeAria: 'Ticket code',
    items: [
      {
        title: 'Search and compare',
        body: 'Pick the route and dates, then compare flights by full price, bags and fare rules.',
        need: 'Route and dates',
      },
      {
        title: 'Add travellers and pay',
        body: 'Names as in the passport, then pay by card or from your wallet balance.',
        need: 'Passport, card or wallet',
      },
      {
        title: 'Get your ticket',
        body: 'Your e-ticket arrives by e-mail, and you can manage the booking any time.',
        need: 'Your e-mail',
      },
    ],
  },
};

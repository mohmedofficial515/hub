/** Strings of v4-departures-board. Step copy follows the approved home (../../home/v3-departure-line/i18n.ts `steps`). */
export const messages = {
  ar: {
    eyebrow: 'كيف يتم الحجز',
    title: 'ثلاث خطوات، وكلها في موعدها',
    lead: 'هكذا تسير رحلتك معنا من البحث إلى التذكرة، كما تقرؤها على لوحة المغادرة.',
    board: 'المغادرة',
    boardLatin: 'DEPARTURES',
    localTime: 'الوقت المحلي',
    cols: { code: 'الرحلة', step: 'الخطوة', need: 'تحتاج', status: 'الحالة' },
    items: [
      {
        code: 'GTV 01',
        title: 'ابحث وقارن',
        body: 'اختر المسار والتاريخ، وقارن الرحلات بسعرها الكامل وأمتعتها وشروطها.',
        need: 'المسار والتاريخ',
        status: 'ابدأ هنا',
      },
      {
        code: 'GTV 02',
        title: 'أدخل بيانات المسافرين وادفع',
        body: 'الاسم كما في الجواز، ثم الدفع بالبطاقة أو من رصيد محفظتك.',
        need: 'الجواز وبطاقة أو محفظة',
        status: 'التالي',
      },
      {
        code: 'GTV 03',
        title: 'استلم تذكرتك',
        body: 'تصلك التذكرة الإلكترونية على بريدك، وتدير حجزك في أي وقت من إدارة الحجز.',
        need: 'بريدك الإلكتروني',
        status: 'صعود',
      },
    ],
  },
  en: {
    eyebrow: 'How booking works',
    title: 'Three steps, all on time',
    lead: 'This is how your trip runs with us, from search to ticket, read like a departures board.',
    board: 'Departures',
    boardLatin: 'DEPARTURES',
    localTime: 'Local time',
    cols: { code: 'Flight', step: 'Step', need: 'You need', status: 'Status' },
    items: [
      {
        code: 'GTV 01',
        title: 'Search and compare',
        body: 'Pick the route and dates, then compare flights by full price, bags and fare rules.',
        need: 'Route and dates',
        status: 'Start here',
      },
      {
        code: 'GTV 02',
        title: 'Add travellers and pay',
        body: 'Names as in the passport, then pay by card or from your wallet balance.',
        need: 'Passport, card or wallet',
        status: 'Next',
      },
      {
        code: 'GTV 03',
        title: 'Get your ticket',
        body: 'Your e-ticket arrives by e-mail, and you can manage the booking any time.',
        need: 'Your e-mail',
        status: 'Boarding',
      },
    ],
  },
};

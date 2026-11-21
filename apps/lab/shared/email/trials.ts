import type { Dict, EmailLang } from './render';

/** Real strings of backend/src/i18n/{ar,en}/emails.json for the two trial templates. */
export const otpStrings: Record<EmailLang, Dict> = {
  ar: {
    emails: {
      identity: {
        otp: {
          subject: '{code} هو رمز التحقق الخاص بك',
          title: 'رمز التحقق الخاص بك',
          body: 'استخدم الرمز أدناه للمتابعة في {siteName}.',
          expires: 'تنتهي صلاحية الرمز خلال {minutes} دقيقة.',
          ignore: 'إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة. لا تشارك الرمز مع أي شخص.',
        },
      },
    },
  },
  en: {
    emails: {
      identity: {
        otp: {
          subject: '{code} is your verification code',
          title: 'Your verification code',
          body: 'Use the code below to continue with {siteName}.',
          expires: 'The code expires in {minutes} minutes.',
          ignore: 'If you did not request this code, you can ignore this email. Never share the code with anyone.',
        },
      },
    },
  },
};

export const failedStrings: Record<EmailLang, Dict> = {
  ar: {
    errors: { sample_reason: 'لم تؤكد شركة الطيران الحجز في الوقت المحدد.' },
    emails: {
      bookings: {
        failed: {
          subject: 'تعذّر إتمام حجزك {reference}',
          title: 'تعذّر إتمام حجزك',
          body: 'للأسف لم تتمكن شركة الطيران من تأكيد حجزك {reference} عبر {siteName}.',
          refund: 'يجري استرداد المبلغ المدفوع ({amount} {currency}) تلقائيًا إلى وسيلة الدفع الأصلية أو إلى محفظتك؛ وقد يستغرق ظهوره بضعة أيام عمل.',
          next: 'يمكنك البحث مجددًا على {siteName} في أي وقت. وإذا احتجت إلى مساعدة، يسعد فريق الدعم لدينا بخدمتك.',
          cta: 'البحث مجددًا',
          choice: {
            intro: 'سيتم استرداد مبلغ {amount} {currency} الذي دفعته. اختر وجهة الاسترداد:',
            wallet: 'إلى محفظتك — يُضاف فوراً وجاهز لحجزك القادم.',
            wallet_bonus: 'إلى محفظتك — يُضاف فوراً مع رصيد إضافي بنسبة {percent}% ({bonus} {currency}) لحجزك القادم.',
            card: 'إلى بطاقتك — قد يستغرق ظهوره حتى {days} أيام عمل.',
            default_wallet: 'إذا لم تختر قبل {deadline} فسنضيف المبلغ إلى محفظتك.',
            default_card: 'إذا لم تختر قبل {deadline} فسنعيد المبلغ إلى بطاقتك.',
            cta: 'اختر طريقة الاسترداد',
          },
        },
      },
    },
  },
  en: {
    errors: { sample_reason: 'The airline did not confirm the booking in time.' },
    emails: {
      bookings: {
        failed: {
          subject: 'We could not complete your booking {reference}',
          title: 'Your booking could not be completed',
          body: 'Unfortunately the airline could not confirm your booking {reference} with {siteName}.',
          refund: 'The amount you paid ({amount} {currency}) is being refunded automatically to your original payment method or your wallet; it can take a few business days to appear.',
          next: 'You can search again on {siteName} at any time. If you need help, our support team is happy to assist.',
          cta: 'Search again',
          choice: {
            intro: 'Your payment of {amount} {currency} will be refunded. Choose where you want it:',
            wallet: 'To your wallet — credited right away, ready for your next booking.',
            wallet_bonus: 'To your wallet — credited right away, plus {percent}% extra ({bonus} {currency}) for your next booking.',
            card: 'Back to your card — it can take up to {days} business days to appear.',
            default_wallet: 'If you do not choose by {deadline}, we will credit your wallet.',
            default_card: 'If you do not choose by {deadline}, we will refund your card.',
            cta: 'Choose your refund',
          },
        },
      },
    },
  },
};

const branding = {
  siteName: 'Goteav',
  supportEmail: 'support@goteav.com',
  webUrl: 'https://www.goteav.com',
};
const pick = (lang: EmailLang, ar: string, en: string) => (lang === 'ar' ? ar : en);

export const otpFixtures: Record<string, (lang: EmailLang) => Dict> = {
  default: (lang) => ({ ...branding, firstName: pick(lang, 'ليلى', 'Layla'), code: '482917', expiresInMinutes: 10 }),
  anonymous: () => ({ ...branding, code: '482917', expiresInMinutes: 10 }),
};

const trip = (lang: EmailLang) => ({
  ...branding,
  firstName: pick(lang, 'ليلى', 'Layla'),
  reference: 'GT-4H8N3C',
  link: 'https://www.goteav.com/ar/bookings/8f2c1e7a',
  reasonKey: 'errors.sample_reason',
  amountPaid: '1284.50',
  currency: 'USD',
  originCity: pick(lang, 'إسطنبول', 'Istanbul'),
  outboundCity: pick(lang, 'دبي', 'Dubai'),
  slices: [{ origin: 'IST', destination: 'DXB', departingAt: '2026-12-05T10:30:00+03:00' }],
});

export const failedFixtures: Record<string, (lang: EmailLang) => Dict> = {
  // Refund waits for the customer's choice, with a wallet incentive.
  default: (lang) => ({
    ...trip(lang),
    refundChoice: {
      amount: '1284.50',
      currency: 'USD',
      walletBonusPercent: 5,
      walletBonusAmount: '64.23',
      cardDays: 7,
      defaultWallet: true,
      deadline: pick(lang, '8 ديسمبر 2026، 12:00 م UTC', 'Dec 8, 2026, 12:00 PM UTC'),
    },
  }),
  // Automatic refund: no choice to make.
  automatic: (lang) => trip(lang),
  // No reason, no name.
  sparse: (lang) => ({ ...trip(lang), firstName: undefined, reasonKey: undefined }),
};

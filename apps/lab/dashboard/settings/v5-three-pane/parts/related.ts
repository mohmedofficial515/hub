// "What lives where" for groups that overlap (audit.md §9.2, O-1 … O-19). Each group appears once in the explorer;
// its header links to the neighbours and says in one sentence how the work is split.
import type { Localized } from '@lab/mocks/settings';

export interface Related {
  links: string[];
  note: Localized;
}

const SIGN_IN: Localized = {
  ar: 'تسجيل الدخول موزّع على أربع مجموعات: الأمان (وصول الموظفين والقفل وطرق دخول العملاء)، والتحقق (الرموز وشروط الحجز)، والحماية من الإساءة (ميزانيات الرموز وCAPTCHA)، وتنبيهات موجات الأمان.',
  en: 'Sign-in is split over four groups: Security (staff access, lockout, customer sign-in methods), Verification (codes and booking requirements), Abuse protection (code budgets, CAPTCHA) and Security wave alerts.',
};

const RETENTION: Localized = {
  ar: 'مدد الاحتفاظ موزّعة على ثماني مجموعات؛ كل سياق يملك جداوله. هذه المجموعة تملك ما يخصّها فقط.',
  en: 'Retention windows live in eight groups, each owning its own tables. This group holds only its own.',
};

const FLIGHT_SPLIT: Localized = {
  ar: 'الطيران = ما يراه العميل (المهل والتسامح في السعر والبحث)، ومورّد الطيران = التحكم في المورّد (الإيقاف والحجز المؤقت والإلغاء)، وحرّاس المورد = الكلفة والرصيد.',
  en: 'Flights = what the customer sees (timings, price tolerance, search); Flight supplier = supplier control (kill switches, holds, cancellation); Supplier guards = cost and balance.',
};

const APPROVALS: Localized = {
  ar: 'حدود موافقة الشخصين موزّعة على خمس مجموعات: الاسترداد، وحجوزات الموظفين، ومدفوعات الموظفين، والولاء (المنح اليدوية).',
  en: 'Four-eyes thresholds live in five groups: refunds, staff bookings, staff payments and loyalty (manual grants).',
};

export const RELATED: Record<string, Related> = {
  platform: {
    links: ['maintenance', 'loyalty', 'payment_methods'],
    note: {
      ar: 'مفاتيح المنتجات هنا تتقدّم: إيقاف المحفظة أو الولاء هنا يُخفي المفاتيح التفصيلية في مجموعاتها. وضع الصيانة انتقل إلى مجموعته الخاصة.',
      en: 'Product switches here win: turning the wallet or loyalty off hides the detailed switches in their groups. Maintenance moved to its own group.',
    },
  },
  maintenance: {
    links: ['platform'],
    note: {
      ar: 'حلّت محلّ كتلة الصيانة القديمة في «المنصّة»، وتُطبَّق فعليًا (503 مع Retry-After).',
      en: 'Replaces the old maintenance block of Platform, and is enforced (503 with Retry-After).',
    },
  },
  security: { links: ['verification_policy', 'abuse_protection', 'security_alerts'], note: SIGN_IN },
  verification_policy: {
    links: ['security', 'abuse_protection', 'flight_provider'],
    note: {
      ar: 'التحقق من الهاتف للحجز هنا، أما شرط الهاتف للحجز المؤقت ففي مورّد الطيران. «TOTP للموظفين» إعداد موظفين يُعرض أيضًا في الأمان.',
      en: 'Phone verification for booking lives here; the phone rule for holds is in Flight supplier. Staff TOTP is a staff rule, also shown in Security.',
    },
  },
  abuse_protection: {
    links: ['security', 'flight_guards'],
    note: {
      ar: 'يوجد CAPTCHA اثنان بمفتاح Turnstile واحد: هنا لتسجيل دخول العملاء، وفي حرّاس المورد لبحث الضيوف.',
      en: 'There are two CAPTCHAs with one Turnstile key: here for customer sign-in, and in Supplier guards for guest searches.',
    },
  },
  security_alerts: {
    links: ['notifications', 'security'],
    note: {
      ar: 'هنا العتبات فقط؛ إلى أين تُرسل التنبيهات يُضبط في الإشعارات › تنبيهات التشغيل.',
      en: 'Only thresholds live here; where alerts go is set in Notifications › Ops alerts.',
    },
  },
  loyalty: {
    links: ['platform', 'agent_booking_policy'],
    note: {
      ar: 'مفتاح «الولاء» في المنصّة يُخفي البرنامج كله، ويتقدّم على «تشغيل البرنامج» هنا.',
      en: 'The Loyalty product switch in Platform hides the whole programme and wins over "Programme on" here.',
    },
  },
  payment_methods: {
    links: ['payment_gateways', 'refund_policy'],
    note: {
      ar: 'هنا تشغيل البوابة وطرقها وعملاتها؛ مفاتيحها في «بوابات الدفع». قواعد المحفظة موزّعة بين هنا وسياسة الاسترداد.',
      en: 'Switching a gateway on, its methods and currencies live here; its keys are on Payment gateways. Wallet rules are split between here and Refund policy.',
    },
  },
  payment_gateways: {
    links: ['payment_methods'],
    note: {
      ar: 'هنا المفاتيح فقط. هل يدفع العملاء بالبوابة؟ يُقرَّر في طرق الدفع، ويظهر بجانب كل بوابة.',
      en: 'Keys only. Whether customers can pay with a gateway is decided in Payment methods, and shown next to each gateway.',
    },
  },
  refund_policy: {
    links: ['payment_methods', 'agent_payment_policy', 'agent_booking_policy'],
    note: {
      ar: 'نحو 40٪ من حقولها قواعد محفظة (الشحن وترتيب الصرف)؛ الدفع من المحفظة في طرق الدفع، والصرف نيابةً عن العميل في مدفوعات الموظفين.',
      en: 'About 40% of its fields are wallet rules (top-ups, spend order); paying from the wallet is in Payment methods, spending on behalf in Staff payment limits.',
    },
  },
  fraud_policy: {
    links: ['abuse_protection', 'disputes'],
    note: {
      ar: 'هنا المخاطر عند الدفع؛ حدود رموز الهاتف وCAPTCHA الدخول في الحماية من الإساءة، وما بعد النزاع البنكي في النزاعات.',
      en: 'Payment-time risk lives here; phone code budgets and sign-in CAPTCHA are in Abuse protection, chargeback aftermath in Disputes.',
    },
  },
  disputes: { links: ['fraud_policy', 'loyalty'], note: { ar: 'تجميد النقاط وعكسها هنا يمسّ أرصدة برنامج الولاء.', en: 'Freezing and reversing points here touches loyalty balances.' } },
  tax: {
    links: ['e_invoicing'],
    note: {
      ar: 'الرقم الضريبي (VKN) يُحفظ هنا ويُقرأ في الفوترة الإلكترونية؛ النسب نفسها في صفحة المالية › الضرائب.',
      en: 'The tax number (VKN) is stored here and read by E-invoicing; the rates themselves are on Finance › Taxes.',
    },
  },
  e_invoicing: {
    links: ['tax'],
    note: {
      ar: 'التشغيل هنا لا يرسل شيئًا ما دام مزوّد الخادم «غير مضبوط»؛ الرقم الضريبي من مجموعة الضريبة.',
      en: 'On here sends nothing while the server provider is "not configured"; the tax number comes from Tax.',
    },
  },
  fx: { links: ['markup_rules'], note: { ar: 'متغيّر الخادم FX_PROVIDER يتقدّم على حقل المزوّد هنا.', en: 'The server variable FX_PROVIDER wins over the provider field here.' } },
  markup_rules: { links: ['fx'], note: { ar: '«مصدر القواعد» محفوظ في مجموعة pricing المخفية، ويظهر هنا كأول قسم.', en: '"Rules source" is stored in the hidden pricing group and shown here as the first section.' } },
  agent_booking_policy: { links: ['agent_payment_policy', 'refund_policy', 'loyalty'], note: APPROVALS },
  agent_payment_policy: { links: ['agent_booking_policy', 'refund_policy'], note: APPROVALS },
  post_booking_services_policy: {
    links: ['flight_provider'],
    note: {
      ar: 'ثلاثة مفاتيح بالتسلسل: «عمليات ما بعد الحجز» ثم «الخدمات بعد الحجز» في مورّد الطيران، ثم «مسار الموظفين» هنا. إيقاف ما فوق يجعل هذا بلا أثر.',
      en: 'Three switches in a chain: "Post-booking operations", then "Extras after booking" in Flight supplier, then "Staff path" here. Off above means this does nothing.',
    },
  },
  flights: { links: ['flight_provider', 'flight_guards'], note: FLIGHT_SPLIT },
  flight_provider: { links: ['flights', 'flight_guards', 'post_booking_services_policy'], note: FLIGHT_SPLIT },
  flight_guards: { links: ['flight_provider', 'abuse_protection'], note: FLIGHT_SPLIT },
  notifications: {
    links: ['whatsapp_provider', 'security_alerts'],
    note: {
      ar: 'مفتاح واتساب هنا هو نفسه في صفحة واتساب (كرتات). «تنبيهات الإدارة» القديمة مطويّة تحت «قديم»، والبديل تنبيهات التشغيل.',
      en: 'The WhatsApp switch here is the same as on the WhatsApp (Cartat) page. The old Admin alerts are folded as Legacy; Ops alerts replace them.',
    },
  },
  whatsapp_provider: {
    links: ['notifications'],
    note: { ar: 'المفتاح ومعدّل الإرسال محفوظان في الإشعارات › القنوات؛ هنا الاتصال والحساب والاختبار.', en: 'The switch and pacing are stored in Notifications › Channels; connection, account and test live here.' },
  },
  retention: { links: ['audit', 'storage', 'analytics', 'security', 'money_check', 'finance_ledger'], note: RETENTION },
  audit: { links: ['retention', 'storage'], note: RETENTION },
  storage: { links: ['retention', 'audit'], note: RETENTION },
  analytics: { links: ['retention'], note: RETENTION },
  money_check: { links: ['finance_ledger', 'retention'], note: RETENTION },
  finance_ledger: { links: ['money_check', 'retention'], note: RETENTION },
};

/** Approximate order of the gateway accounts in payment_methods.gateways (audit §3.1). */
export const GATEWAY_INDEX: Record<string, number> = { STRIPE: 0, MYFATOORAH: 1, PAYMOB: 2, MOYASAR: 3, TAP: 4, PAYTR: 5, IYZICO: 6 };

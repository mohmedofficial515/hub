/**
 * hub/plan-page mock: the real plan card GTV-472 as Hub returned it on 2026-11-18 (get_card, list_ideas), plus the fields the
 * redesign needs. Every field marked NEW does not exist in `@hub/contracts` today; see hub/plan-page/v2-route-line/README.md.
 *
 * API strings (titles, body) are the card's own text and are not translated: Hub stores one language per card.
 */
import type { Priority, Role } from './hub-today';

export type PlanStatus = 'draft' | 'in_review' | 'approved' | 'in_progress' | 'done' | 'abandoned';

/** NEW: a phase of a plan (`plan.phases[]`). Order is the array order. */
export interface PlanPhase {
  id: string;
  title: string;
  /** Optional one-line note written after the title, e.g. who carries it or a rule for it. */
  note?: string;
}

/** `planStepSchema` + NEW `phaseId`. */
export interface PlanStep {
  id: string;
  title: string;
  role?: Role;
  taskKey?: string;
  done: boolean;
  /** NEW. Absent on every plan saved before phases exist: the page then shows one unnamed group. */
  phaseId?: string;
}

/** `cardFullSchema.attachments[]`, exists today (written by the lab scanner only). `url` here is relative to the version's `media/`. */
export interface PlanAttachment {
  id: string;
  kind: 'screenshot' | 'file';
  name: string;
  url: string;
  width: number | null;
  height: number | null;
}

/** `cardFullSchema.links[]`, exists today. Card summary trimmed to what the page reads. */
export interface PlanLink {
  kind: 'relates' | 'blocks' | 'blocked_by' | 'parent' | 'child' | 'duplicates';
  card: { key: string; type: 'idea' | 'plan' | 'task'; title: string; status: string; priority: Priority; ownerRole?: Role };
}

/** NEW: where the plan's evidence lives (`plan.sources[]`). */
export interface PlanSource {
  id: string;
  kind: 'folder' | 'file' | 'hub_source' | 'link';
  title: string;
  /** Path, Hub source slug or URL, shown LTR. */
  ref: string;
  /** A short fact the writer adds, e.g. "44 ideas". */
  note?: string;
  /** A link only the owner can open. */
  privateLink?: boolean;
}

/** NEW: a decision recorded with the plan (`plan.decisions[]`). Today it is a Markdown table in the body. */
export interface PlanDecision {
  id: string;
  topic: string;
  choice: string;
  decidedAt: string;
  decidedBy: string;
}

export interface PlanPageCard {
  key: string;
  title: string;
  status: PlanStatus;
  priority: Priority;
  tags: string[];
  createdAt: string;
  createdBy: { name: { ar: string; en: string }; via: 'mcp' | 'web' };
  lastEventAt: string;
  revision: number;
  commentCount: number;
  body: string;
  steps: PlanStep[];
  /** NEW */
  phases: PlanPhase[];
  links: PlanLink[];
  attachments: PlanAttachment[];
  /** NEW */
  sources: PlanSource[];
  /** NEW */
  decisions: PlanDecision[];
  /** From `actionsFor`, first = primary. */
  actions: ('submit_review' | 'to_tasks' | 'abandon' | 'approve' | 'start' | 'finish')[];
}

const phases: PlanPhase[] = [
  { id: 'p0', title: 'تجهيز وقرارات', note: 'المالك' },
  { id: 'p1', title: 'إصلاحات عاجلة', note: 'أقل من يوم لكل بند' },
  { id: 'p2', title: 'أساس نظام التصميم', note: 'بلا تغيير بصري' },
  { id: 'p3', title: 'المختبر: تصميم وموافقة' },
  { id: 'p4', title: 'ترحيل التصميم على دفعات' },
  { id: 'p5', title: 'منتج حجز الطيران' },
  { id: 'p6', title: 'أدوات المساعدة' },
  { id: 'p7', title: 'الملف الشخصي والأفاتار' },
  { id: 'p8', title: 'التنقل وهيكل الصفحات' },
];

/** [title, role] in plan order; phase boundaries follow 00-plan.md (4, 10, 4, 5, 6, 9, 5, 4, 3). */
const rawSteps: [string, Role][] = [
  ['نصوص الشروط والخصوصية وسياسة الإلغاء والاسترداد بمراجعة قانونية', 'owner'],
  ['بيانات التواصل الحقيقية ورقم الترخيص TÜRSAB/IATA', 'owner'],
  ['قرارات نظام التصميم D2–D8 (حافة hero، الزوايا، الوزن، الخط، 13px، slider)', 'owner'],
  ['ترقية Next.js الأمنية في الموقع', 'frontend'],
  ['صفحة 404 تعمل ومترجمة داخل إطار الموقع', 'frontend'],
  ['إصلاح رابط الحجوزات في الجوال وروابط التذييل والرئيسية الميتة ورابط FAQ', 'frontend'],
  ['إظهار أداة الترتيب في نتائج الرحلات', 'frontend'],
  ['شارة الاسترداد بثلاث حالات: قابل، غير قابل، غير محدد', 'frontend'],
  ['الطيران أول تبويب، ونموذج البحث كامل على الكمبيوتر وظاهر على الجوال', 'frontend'],
  ['الحفاظ على البحث عند تغيير اللغة', 'frontend'],
  ['شارة «قريبًا» للصفحات غير الطيران وتعطيل الحجوزات الوهمية الأربعة', 'frontend'],
  ['حذف المحتوى المختلق ووضع بيانات التواصل الحقيقية', 'frontend'],
  ['اسم واحد لصفحة الحجوزات، وفتح الحساب عليها', 'frontend'],
  ['خريطة الموقع وJSON-LD للمنتجات المطلقة فقط', 'frontend'],
  ['tokens بثلاث طبقات بقيم الألوان الحالية، فاتح وداكن، وتصحيح اسم الذهبي', 'frontend'],
  ['حرّاس ضد التراجع: منع التدرّج والألوان الخام', 'frontend'],
  ['حذف بقايا dashboard والملفات والخطوط والأصناف الميتة', 'frontend'],
  ['خط IBM Plex Sans Arabic وIBM Plex Sans مع latin-ext للتركية', 'frontend'],
  ['إصدار مختبر: الرئيسية ونموذج البحث', 'designer'],
  ['إصدار مختبر: بطاقة نتيجة الرحلة وشريط الأفضل والأرخص والأسرع', 'designer'],
  ['إصدار مختبر: خطوة الحجز والدفع مع ملخص ثابت', 'designer'],
  ['إصدار مختبر: ترويسة الحساب مع أفاتار Postmark بالأحجام 32 و64 و128', 'designer'],
  ['مراجعة ux-critic لكل إصدار وموافقة المالك', 'owner'],
  ['إزالة التدرّجات على خمس مراحل وتوحيد وصفة التعتيم', 'frontend'],
  ['تحويل الألوان الخام إلى tokens', 'frontend'],
  ['توحيد الأزرار والبطاقات والزوايا والظلال', 'frontend'],
  ['سلّم الخطوط والأحجام', 'frontend'],
  ['الوضع الداكن من عائلة ocean', 'frontend'],
  ['الحركة والأيقونات وتفاصيل RTL', 'frontend'],
  ['السعر الإجمالي من أول شاشة وشفافية الرسوم حتى الدفع', 'frontend'],
  ['مفتاح السعر شامل الحقائب ومقارنة فئات الأجرة بلغة بسيطة', 'frontend'],
  ['شبكة التواريخ ومنحنى الأسعار', 'backend'],
  ['ترتيب وسائل الدفع حسب الدولة وApple Pay أولًا', 'backend'],
  ['التقسيط حسب السوق بعد التأكد من دعم مزوّد الدفع', 'backend'],
  ['حاسبة الاسترداد قبل الإلغاء فوق متتبّع GTV-362', 'backend'],
  ['مكافأة عند اختيار الاسترداد إلى المحفظة', 'backend'],
  ['فحص التأشيرة والترانزيت داخل الحجز', 'backend'],
  ['خدمة ما بعد الحجز وحالة الرحلة عبر WhatsApp', 'backend'],
  ['مساعد الاسم اللاتيني كما في الجواز', 'frontend'],
  ['مركز مساعدة ومدخل مساعدة واحد بسياق الحجز', 'frontend'],
  ['مرشد فشل الدفع وسطر «ماذا تدفع وبأي عملة»', 'frontend'],
  ['المسافرون المحفوظون مع تنبيه انتهاء الجواز', 'frontend'],
  ['خط زمني للرحلة مع تذكيرات', 'backend'],
  ['إصلاح تقدّم المستوى ليحسب الإنفاق وليس النقاط فقط', 'frontend'],
  ['مكوّن UserAvatar بإطار Postmark وحرف الاسم بديلًا', 'frontend'],
  ['رفع الصورة وقصّها، وإضافة مصدر الصور إلى FILES_PUBLIC_ORIGINS', 'frontend'],
  ['قائمة إكمال الملف الشخصي', 'frontend'],
  ['الترويسة وشريط الجوال الجديدان', 'frontend'],
  ['قائمة الحساب بخمس مجموعات وإخفاء الصفحات الوهمية', 'frontend'],
  ['التذييل بأربعة أعمدة وصفحات الشروط والخصوصية', 'frontend'],
];

const PHASE_SIZES = [4, 10, 4, 5, 6, 9, 5, 4, 3];
const phaseOfIndex = (i: number) => {
  let edge = 0;
  for (let p = 0; p < PHASE_SIZES.length; p++) {
    edge += PHASE_SIZES[p]!;
    if (i < edge) return phases[p]!.id;
  }
  return phases[phases.length - 1]!.id;
};

const steps: PlanStep[] = rawSteps.map(([title, role], i) => ({
  id: `s${i + 1}`,
  title,
  role,
  done: false,
  phaseId: phaseOfIndex(i),
}));

const attachments: PlanAttachment[] = [
  { id: 'a1', kind: 'screenshot', name: '07-fare-details-conditions-vs-badge-ar-1440.png', url: '07-fare-details-conditions-vs-badge-ar-1440.png', width: 1440, height: 900 },
  { id: 'a2', kind: 'screenshot', name: '04-results-supplier-timeout-ar-1440.png', url: '04-results-supplier-timeout-ar-1440.png', width: 1440, height: 900 },
  { id: 'a3', kind: 'screenshot', name: '18-results-top-ar-390-light.png', url: '18-results-top-ar-390-light.png', width: 780, height: 1688 },
  { id: 'a4', kind: 'screenshot', name: 'riyadhair-home-ar-1440.jpg', url: 'riyadhair-home-ar-1440.jpg', width: 1440, height: 900 },
  { id: 'a5', kind: 'screenshot', name: 'almosafer-results-ar-1440.jpg', url: 'almosafer-results-ar-1440.jpg', width: 1440, height: 900 },
  { id: 'a6', kind: 'screenshot', name: 'googleflights-results-1440.jpg', url: 'googleflights-results-1440.jpg', width: 1440, height: 900 },
];

/**
 * The card's body, with the decisions table moved to `decisions` (NEW) and the screenshots placed where the text names them, as
 * `![alt](attachment:ID "caption")`. Images are the only change to the owner's words.
 */
const body = `**النطاق:** الموقع العام فقط (\`F:/Goteav/web\`). لوحة التحكم خارج النطاق.
**المصدر:** ستة تقارير في \`F:/Goteav/research/web-uplift-2026-11/\` (مصدر Hub: \`web-uplift-research\`). نسخة هذه الخطة: \`00-plan.md\`.

## ما وجدناه

- **منطق:** 404 مسدودة؛ لا شروط ولا خصوصية رغم ربط الموافقات بهما؛ أربعة حجوزات وهمية تعرض «تم الحجز»؛ «الحجوزات» في الجوال تذهب إلى 404؛ الترتيب في النتائج غير ظاهر؛ شارة «غير قابل للاسترداد» حين لا تحدد الشركة؛ تغيير اللغة يضيّع البحث.

![شارة غير قابلة للاسترجاع والشروط تقول لم تحدد شركة الطيران](attachment:a1 "الشارة تقول «غير قابلة للاسترجاع» والشروط تحتها تقول «لم تحدد شركة الطيران» (الخطوة 8)")
![تعذر تحميل الأسعار](attachment:a2 "حين لا تردّ شركات الطيران في الوقت المحدد: «تعذّر تحميل الأسعار»، وتحتها شريط اشتراك بتدرّج زخرفي")
![أعلى النتائج على الجوال](attachment:a3 "أعلى نتائج الطيران على الجوال بعرض 390")

- **محتوى مختلق:** آراء وعدّادات وفريق ومراجعات «موثّقة» وخصم 15%، وهاتف وعنوان في نيويورك وبريد Gmail في التذييل، وتقييمات منشورة لمحركات البحث.
- **تصميم:** 171 سطر تدرّج في 94 ملفًا (127 تُزال)، 523 لونًا خامًا، 34 قيمة زوايا، 108 وصفات بطاقة، 79 وصفة زر رئيسي، \`Button\` مستخدم مرة واحدة مقابل 290 زرًا يدويًا. الكحلي يختفي في الوضع الداكن، والزر الرئيسي أبيض على تركوازي بتباين 2.57.
- **فرص المنتج:** السعر الكامل والأمتعة بوضوح، ترتيب الدفع حسب الدولة والتقسيط، الاسترداد إلى المحفظة بمكافأة، فحص التأشيرة، خدمة ما بعد الحجز عبر WhatsApp.

## مراجع التصميم

![الرئيسية في طيران الرياض](attachment:a4 "طيران الرياض: كتلة مصمتة بلا تدرّج وبحث في المقدمة")
![نتائج المسافر](attachment:a5 "المسافر: نتائج بالعربية بعرض 1440")
![نتائج Google Flights](attachment:a6 "Google Flights: الترتيب ظاهر فوق النتائج")

## خارج النطاق
لوحة التحكم، البريد، تطبيق الجوال، إطلاق الفنادق نفسه (GTV-357).

## مخاطر
- جلسة أخرى تعدّل ملفات الموقع الآن (ميزة الصيانة)؛ التنفيذ يبدأ بعد إيداع عملها.
- بعض ادعاءات المنافسين من مقتطفات بحث وتحتاج مراجعة.
- التقسيط في تركيا مقيد بقرار BDDK، وضمان الإلغاء قد يُعد تأمينًا: رأي قانوني أولًا.
- الأفاتار يمس الترويسة وقائمة الجوال وبطاقة الحساب، فيمر بالمختبر أولًا.`;

const idea = (key: string, title: string, priority: Priority, ownerRole: Role): PlanLink => ({
  kind: 'relates',
  card: { key, type: 'idea', title, status: 'open', priority, ownerRole },
});

const links: PlanLink[] = [
  { kind: 'relates', card: { key: 'GTV-362', type: 'plan', title: 'متتبّع استرداد الأموال للعميل (أصغر نسخة): ثلاث مراحل ومدة متوقعة في صفحة الرحلة', status: 'draft', priority: 'P2' } },
  { kind: 'relates', card: { key: 'GTV-357', type: 'plan', title: 'إطلاق حجز الفنادق مع مزود واحد خلال أربعة أسابيع', status: 'draft', priority: 'P1' } },
  idea('GTV-473', 'السعر الإجمالي من أول شاشة وشفافية الرسوم حتى الدفع', 'P1', 'frontend'),
  idea('GTV-474', 'مفتاح «السعر شامل الحقائب» ومقارنة فئات الأجرة بلغة بسيطة', 'P1', 'frontend'),
  idea('GTV-475', 'ترتيب وسائل الدفع حسب دولة العميل وApple Pay أولًا', 'P1', 'backend'),
  idea('GTV-476', 'التقسيط حسب السوق: Tamara وTabby في الخليج، وvalU في مصر', 'P2', 'backend'),
  idea('GTV-477', 'استرداد فوري إلى المحفظة مع مكافأة', 'P1', 'backend'),
  idea('GTV-478', 'حاسبة الاسترداد قبل الإلغاء مع مدة معلنة', 'P2', 'backend'),
  idea('GTV-479', 'فحص التأشيرة والترانزيت داخل الحجز', 'P2', 'backend'),
  idea('GTV-480', 'شبكة التواريخ ومنحنى الأسعار في البحث', 'P2', 'backend'),
  idea('GTV-481', 'خدمة ما بعد الحجز وحالة الرحلة الحية عبر WhatsApp', 'P2', 'backend'),
  idea('GTV-482', 'مساعد كتابة الاسم اللاتيني كما في الجواز', 'P1', 'frontend'),
  idea('GTV-483', 'مركز مساعدة ومدخل مساعدة واحد يعرف سياق الحجز', 'P1', 'frontend'),
  idea('GTV-484', 'مرشد فشل الدفع حسب السبب', 'P1', 'frontend'),
  idea('GTV-485', 'صفحات العطل والمواسم 2027 لكل دولة', 'P2', 'frontend'),
  idea('GTV-486', 'إحالة ثنائية تُدفع رصيدًا في المحفظة بعد السفر', 'P3', 'backend'),
  idea('GTV-487', 'ضمان الإلغاء لأي سبب: تجربة محدودة', 'P3', 'owner'),
];

const R = 'F:/Goteav/research/web-uplift-2026-11';

const sources: PlanSource[] = [
  { id: 'src1', kind: 'link', title: 'صفحة العرض المصمّمة لهذه الخطة', ref: 'https://claude.ai/artifact/6PwFfXoqSMLFzsiQkkahDL', privateLink: true },
  { id: 'src2', kind: 'hub_source', title: 'مصدر البحث في Hub', ref: 'web-uplift-research' },
  { id: 'src3', kind: 'folder', title: 'مجلد البحث', ref: `${R}/`, note: '6 تقارير' },
  { id: 'src4', kind: 'file', title: 'المنافسون العالميون', ref: `${R}/01-competitors-global.md`, note: '44 فكرة' },
  { id: 'src5', kind: 'file', title: 'المنافسون الإقليميون', ref: `${R}/02-competitors-regional.md`, note: '39 فكرة' },
  { id: 'src6', kind: 'file', title: 'تدقيق الرحلات', ref: `${R}/audit/03-journey-logic-audit.md`, note: '63 ملاحظة' },
  { id: 'src7', kind: 'file', title: 'أدوات المساعدة والملف الشخصي', ref: `${R}/04-assist-tools-and-profile.md`, note: '34 فكرة' },
  { id: 'src8', kind: 'file', title: 'تدقيق نظام التصميم', ref: `${R}/05-design-system-audit.md` },
  { id: 'src9', kind: 'file', title: 'اتجاه التصميم', ref: `${R}/design/references.md` },
  { id: 'src10', kind: 'file', title: 'نسخة الخطة المحلية', ref: `${R}/00-plan.md` },
];

const D = '2026-11-18T19:20:00.000Z';
const decisions: PlanDecision[] = [
  { id: 'd1', topic: 'الألوان', choice: 'ألوان الموقع الحالية كما هي: خلفية بيضاء، الكحلي للترويسة والعناوين، التركوازي للأزرار بنص أبيض، الذهبي للمسات صغيرة', decidedAt: D, decidedBy: 'owner' },
  { id: 'd2', topic: 'التدرّجات', choice: 'تُزال كل التدرّجات الزخرفية. يبقى تعتيم وظيفي خفيف فوق الصور فقط، بوصفة واحدة', decidedAt: D, decidedBy: 'owner' },
  { id: 'd3', topic: 'الأفاتار', choice: 'صورة العميل أو حرف اسمه، مع إطار Postmark (ختم التأشيرة) حسب المستوى BLUE / SILVER / GOLD', decidedAt: D, decidedBy: 'owner' },
  { id: 'd4', topic: 'الصفحات غير الطيران', choice: 'تبقى مع شارة «قريبًا»، وتُعطَّل الحجوزات الوهمية', decidedAt: D, decidedBy: 'owner' },
  { id: 'd5', topic: 'المحتوى المختلق', choice: 'يُحذف ويُستبدل بالحقيقي', decidedAt: D, decidedBy: 'owner' },
  { id: 'd6', topic: 'الشرائط الملوّنة على البطاقات', choice: 'ممنوعة', decidedAt: D, decidedBy: 'owner' },
];

export const plan472: PlanPageCard = {
  key: 'GTV-472',
  title: 'تطوير الموقع العام وحجز الطيران: تصميم أفخم بألوان الموقع الحالية بلا تدرّجات، إصلاح المنطق، وأفكار المنافسين',
  status: 'draft',
  priority: 'P1',
  tags: [],
  createdAt: '2026-11-18T19:18:00.000Z',
  createdBy: { name: { ar: 'المالك', en: 'Owner' }, via: 'mcp' },
  lastEventAt: '2026-11-18T19:25:09.823Z',
  revision: 1,
  commentCount: 1,
  body,
  steps,
  phases,
  links,
  attachments,
  sources,
  decisions,
  actions: ['submit_review', 'to_tasks', 'abandon'],
};

/**
 * DEMO STATE, not real data: the same plan as it would read once work is under way, so the design can show done steps, a running
 * phase and a step with its task. Task keys here are placeholders.
 */
export const plan472Midway: PlanPageCard = {
  ...plan472,
  status: 'in_progress',
  actions: ['finish', 'abandon'],
  steps: steps.map((s, i) => ({
    ...s,
    done: i < 9,
    taskKey: i < 12 ? `GTV-${500 + i}` : undefined,
  })),
};

/** A plan saved before phases, images, sources and decisions existed: the page must still read well. */
export const planPlain: PlanPageCard = {
  key: 'GTV-152',
  title: 'Hotels first slice',
  status: 'draft',
  priority: 'P2',
  tags: [],
  createdAt: '2026-11-09T10:00:00.000Z',
  createdBy: { name: { ar: 'المالك', en: 'Owner' }, via: 'web' },
  lastEventAt: '2026-11-09T10:00:00.000Z',
  revision: 1,
  commentCount: 0,
  body: 'One supplier, search and book, no payment change.',
  steps: [
    { id: 'x1', title: 'Pick the supplier', role: 'owner', done: false },
    { id: 'x2', title: 'Search endpoint behind a flag', role: 'backend', done: false },
    { id: 'x3', title: 'Results page in the lab', role: 'designer', done: false },
  ],
  phases: [],
  links: [],
  attachments: [],
  sources: [],
  decisions: [],
  actions: ['submit_review', 'to_tasks', 'abandon'],
};

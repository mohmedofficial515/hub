/**
 * Demo data for v5, added on top of the GTV-472 mock. Nothing here is from the plan itself; each part is marked in README.md.
 * - `size`: a fixed cycle, so the effort ring has mixed weights.
 * - `after`: dependencies read from the step titles (tokens before the lab versions, the owner's approval before the migration).
 * - `why` / `acceptance`: written for steps 10 and 11 only, to show the drawer; the other steps say they have none.
 * - `doneAt`: one step a day for the steps done in `midway`, so the finish estimate has a pace.
 * - `evidence`: screenshots and a clip from this lab session (the v2 rail before, the v3 rail after), not from the website.
 */
import type { PlanPageCard } from '@lab/mocks/hub-plan-page';
import type { Evidence, StepExtras, StepSize } from './model';

const SIZES: StepSize[] = ['S', 'M', 'S', 'L', 'M', 'S', 'M', 'M', 'S', 'L'];

const AFTER: Record<string, string[]> = {
  s11: ['s10'],
  s12: ['s2'],
  s13: ['s6'],
  s14: ['s11'],
  s16: ['s15'],
  s17: ['s15'],
  s19: ['s15', 's18'],
  s20: ['s15', 's18'],
  s21: ['s15'],
  s22: ['s15'],
  s23: ['s19', 's20', 's21', 's22'],
  s24: ['s23'],
  s25: ['s23'],
  s26: ['s23'],
  s27: ['s26'],
  s28: ['s25'],
  s29: ['s26'],
  s35: ['s34'],
  s36: ['s35'],
  s45: ['s44'],
  s46: ['s45'],
  s48: ['s23'],
};

const TEXT: Record<string, Pick<StepExtras, 'why' | 'acceptance'>> = {
  s10: {
    why: 'من يبحث بالعربية ثم يبدّل إلى الإنجليزية يفقد بحثه ويبدأ من جديد، فيترك الموقع.',
    acceptance: 'تغيير اللغة في صفحة النتائج يُبقي المدن والتواريخ وعدد المسافرين\nالرابط يحمل معاملات البحث في اللغتين\nاختبار يغطي التبديل في الاتجاهين',
  },
  s11: {
    why: 'أربع صفحات تعرض حجوزات وهمية توحي بمنتج غير موجود.',
    acceptance: 'شارة «قريبًا» على كل صفحة غير الطيران\nلا يظهر أي حجز وهمي في الحساب',
  },
};

/** The evidence pair and clip, under the names the media folder holds. */
export const DEMO_EVIDENCE: Evidence[] = [
  { id: 'e-before', kind: 'before', src: 'evidence/rail-before.jpg', caption: 'قبل: مراحل مكدّسة بعناوين مكسورة (لقطة تجريبية)' },
  { id: 'e-after', kind: 'after', src: 'evidence/rail-after.jpg', caption: 'بعد: مراحل بعرض واحد وأرقام على خط واحد (لقطة تجريبية)' },
  { id: 'e-clip', kind: 'video', src: 'evidence/rail-after-clip.mp4', poster: 'evidence/rail-after.jpg', caption: 'جولة قصيرة على النتيجة (مقطع تجريبي)' },
];

export function withDemo(card: PlanPageCard): PlanPageCard {
  const doneCount = card.steps.filter((s) => s.done).length;
  let day = 0;
  return {
    ...card,
    steps: card.steps.map((s, i) => {
      const extras: StepExtras = {
        size: SIZES[i % SIZES.length],
        after: AFTER[s.id],
        ...TEXT[s.id],
      };
      if (s.done) {
        extras.doneAt = new Date(Date.UTC(2026, 10, 19 - (doneCount - 1) + day++, 12)).toISOString();
        if (s.id === 's9') extras.evidence = DEMO_EVIDENCE;
      }
      return { ...s, ...extras };
    }),
  };
}

/**
 * Amount in words (SAMA rule 3: the written value is first class) for irreversible confirmations: refund, wallet top-up.
 * Pure like the money core: BigInt maths on decimal strings, no Intl. Lives next to `money-core.ts` and is part of the same port.
 *
 * Arabic follows cheque style and the counted-noun rule by the LAST TWO digits of the count:
 *   1  -> "<noun> واحد"            ريال سعودي واحد
 *   2  -> dual                      ريالان سعوديان
 *   3-10 -> plural                  ثلاثة ريالات سعودية
 *   11-99 -> singular accusative    أحد عشر ريالاً سعودياً
 *   0 (100, 1,000 ...) -> singular genitive   مئة ريال سعودي
 * The dual before the noun loses its nun: مئتا ريال، ألفا ريال، مليونا ريال. Scale nouns not adjacent to the counted noun take tanween
 * (اثنا عشر مليوناً وثلاثمئة وخمسة وأربعون ألفاً ...). Needs a native-speaker review before the port.
 */
import { absDec, decToString, parseDec } from './money-core';

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const HUNDRED = BigInt(100);
const THOUSAND = BigInt(1000);

export type Lang = 'ar' | 'en';

interface ArForms {
  fem: boolean;
  /** The noun for exactly one (the word "واحد"/"واحدة" is appended). */
  one: string;
  dual: string;
  /** 3 to 10 */
  plural: string;
  /** 11 to 99: singular accusative */
  acc: string;
  /** 100 and multiples: singular genitive */
  gen: string;
}
interface EnForms {
  one: string;
  many: string;
}
interface WordCurrency {
  ar: { main: ArForms; sub?: ArForms };
  en: { main: EnForms; sub?: EnForms };
  /** Minor digits of the currency (the sub-unit count has this many digits). */
  digits: number;
}

const forms = (fem: boolean, one: string, dual: string, plural: string, acc: string, gen: string): ArForms => ({ fem, one, dual, plural, acc, gen });

const WORD_CURRENCIES: Record<string, WordCurrency> = {
  SAR: {
    digits: 2,
    ar: {
      main: forms(false, 'ريال سعودي', 'ريالان سعوديان', 'ريالات سعودية', 'ريالاً سعودياً', 'ريال سعودي'),
      sub: forms(true, 'هللة', 'هللتان', 'هللات', 'هللةً', 'هللة'),
    },
    en: { main: { one: 'Saudi riyal', many: 'Saudi riyals' }, sub: { one: 'halala', many: 'halalas' } },
  },
  USD: {
    digits: 2,
    ar: {
      main: forms(false, 'دولار أمريكي', 'دولاران أمريكيان', 'دولارات أمريكية', 'دولاراً أمريكياً', 'دولار أمريكي'),
      sub: forms(false, 'سنت', 'سنتان', 'سنتات', 'سنتاً', 'سنت'),
    },
    en: { main: { one: 'US dollar', many: 'US dollars' }, sub: { one: 'cent', many: 'cents' } },
  },
  AED: {
    digits: 2,
    ar: {
      main: forms(false, 'درهم إماراتي', 'درهمان إماراتيان', 'دراهم إماراتية', 'درهماً إماراتياً', 'درهم إماراتي'),
      sub: forms(false, 'فلس', 'فلسان', 'فلوس', 'فلساً', 'فلس'),
    },
    en: { main: { one: 'UAE dirham', many: 'UAE dirhams' }, sub: { one: 'fils', many: 'fils' } },
  },
  KWD: {
    digits: 3,
    ar: {
      main: forms(false, 'دينار كويتي', 'ديناران كويتيان', 'دنانير كويتية', 'ديناراً كويتياً', 'دينار كويتي'),
      sub: forms(false, 'فلس', 'فلسان', 'فلوس', 'فلساً', 'فلس'),
    },
    en: { main: { one: 'Kuwaiti dinar', many: 'Kuwaiti dinars' }, sub: { one: 'fils', many: 'fils' } },
  },
  TRY: {
    digits: 2,
    ar: {
      main: forms(true, 'ليرة تركية', 'ليرتان تركيتان', 'ليرات تركية', 'ليرةً تركيةً', 'ليرة تركية'),
      sub: forms(false, 'قرش', 'قرشان', 'قروش', 'قرشاً', 'قرش'),
    },
    en: { main: { one: 'Turkish lira', many: 'Turkish liras' }, sub: { one: 'kuruş', many: 'kuruş' } },
  },
  JPY: {
    digits: 0,
    ar: { main: forms(false, 'ين ياباني', 'ينان يابانيان', 'ين ياباني', 'يناً يابانياً', 'ين ياباني') },
    en: { main: { one: 'Japanese yen', many: 'Japanese yen' } },
  },
};

export const hasWords = (code: string): boolean => code in WORD_CURRENCIES;
export const WORD_CODES = Object.keys(WORD_CURRENCIES);

/* ---------------------------------------------------------------- English */

const EN_UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const EN_SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function enBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const out: string[] = [];
  if (h) out.push(`${EN_UNITS[h]} hundred`);
  if (r) out.push(r < 20 ? EN_UNITS[r] : EN_TENS[Math.floor(r / 10)] + (r % 10 ? `-${EN_UNITS[r % 10]}` : ''));
  return out.join(' ');
}

/** "one thousand two hundred fifty" (no "and"); zero is "zero". */
export function numberToWordsEn(value: bigint): string {
  if (value === ZERO) return 'zero';
  const groups = toGroups(value);
  const out: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (groups[i]) out.push(enBelow1000(groups[i]) + (EN_SCALES[i] ? ` ${EN_SCALES[i]}` : ''));
  }
  return out.join(' ');
}

function toGroups(value: bigint): number[] {
  const groups: number[] = [];
  let v = value;
  while (v > ZERO) {
    groups.push(Number(v % THOUSAND));
    v /= THOUSAND;
  }
  return groups;
}

/* ---------------------------------------------------------------- Arabic */

const AR_UNITS_M = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
const AR_UNITS_F = ['', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثماني', 'تسع', 'عشر'];
const AR_TEENS_M = ['', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TEENS_F = ['', 'إحدى عشرة', 'اثنتا عشرة', 'ثلاث عشرة', 'أربع عشرة', 'خمس عشرة', 'ست عشرة', 'سبع عشرة', 'ثماني عشرة', 'تسع عشرة'];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];

/** 1..99. Units before tens ("خمسة وأربعون"); feminine 8 is "ثمان" inside a compound. */
function arBelow100(n: number, fem: boolean): string {
  if (n <= 10) return (fem ? AR_UNITS_F : AR_UNITS_M)[n];
  if (n < 20) return (fem ? AR_TEENS_F : AR_TEENS_M)[n - 10];
  const u = n % 10;
  const t = AR_TENS[Math.floor(n / 10)];
  if (!u) return t;
  const unit = fem ? (u === 8 ? 'ثمان' : u === 1 ? 'إحدى' : AR_UNITS_F[u]) : AR_UNITS_M[u];
  return `${unit} و${t}`;
}

/** 1..999. `construct` turns the dual hundred "مئتان" into "مئتا" when it directly precedes the counted noun. */
function arBelow1000(n: number, fem: boolean, construct: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return arBelow100(r, fem);
  const hw = h === 2 && r === 0 && construct ? 'مئتا' : AR_HUNDREDS[h];
  return r ? `${hw} و${arBelow100(r, fem)}` : hw;
}

interface ScaleForms {
  one: string;
  dual: string;
  constructDual: string;
  plural: string;
  acc: string;
  gen: string;
}
const AR_SCALES: ScaleForms[] = [
  { one: '', dual: '', constructDual: '', plural: '', acc: '', gen: '' },
  { one: 'ألف', dual: 'ألفان', constructDual: 'ألفا', plural: 'آلاف', acc: 'ألفاً', gen: 'ألف' },
  { one: 'مليون', dual: 'مليونان', constructDual: 'مليونا', plural: 'ملايين', acc: 'مليوناً', gen: 'مليون' },
  { one: 'مليار', dual: 'ملياران', constructDual: 'مليارا', plural: 'مليارات', acc: 'ملياراً', gen: 'مليار' },
  { one: 'تريليون', dual: 'تريليونان', constructDual: 'تريليونا', plural: 'تريليونات', acc: 'تريليوناً', gen: 'تريليون' },
];

/** The count `g` (1..999) of one scale: "ثلاثة آلاف", "اثنا عشر ألفاً", "مئتا ألف". `adjacent` = the counted noun follows directly. */
function arScalePhrase(g: number, scale: ScaleForms, adjacent: boolean): string {
  const low = g % 100;
  const high = g - low;
  const dual = adjacent ? scale.constructDual : scale.dual;
  if (low === 0) return `${arBelow1000(g, false, true)} ${scale.gen}`;
  if (low === 1) return high ? `${arBelow1000(high, false, false)} و${scale.one}` : scale.one;
  if (low === 2) return high ? `${arBelow1000(high, false, false)} و${dual}` : dual;
  if (low <= 10) return `${arBelow1000(g, false, false)} ${scale.plural}`;
  return `${arBelow1000(g, false, false)} ${adjacent ? scale.gen : scale.acc}`;
}

/** A count n >= 1 with its counted noun (the major or the minor unit). */
function arPhrase(n: bigint, f: ArForms): string {
  const one = f.fem ? 'واحدة' : 'واحد';
  if (n === ONE) return `${f.one} ${one}`;
  if (n === TWO) return f.dual;
  const low = Number(n % HUNDRED);
  const groups = toGroups(n);
  const g0 = groups[0] ?? 0;
  const lowest = groups.findIndex((g) => g !== 0);
  const comps: string[] = [];
  for (let i = groups.length - 1; i >= 1; i -= 1) {
    if (groups[i]) comps.push(arScalePhrase(groups[i], AR_SCALES[i], i === lowest && g0 === 0));
  }
  if (g0 === 0) return `${comps.join(' و')} ${f.gen}`;
  const high = g0 - (g0 % 100);
  if (low === 0) return `${[...comps, arBelow1000(g0, f.fem, true)].join(' و')} ${f.gen}`;
  if (low === 1 || low === 2) {
    const noun = low === 1 ? `${f.one} ${one}` : f.dual;
    return [...comps, high ? `${arBelow1000(high, false, false)} و${noun}` : noun].join(' و');
  }
  return `${[...comps, arBelow1000(g0, f.fem, false)].join(' و')} ${low <= 10 ? f.plural : f.acc}`;
}

/**
 * The amount written in words in the UI language. Demo currencies only (`hasWords`); `null` for others, a malformed value, a negative
 * value or more than 15 integer digits.
 */
export function amountInWords(value: string, currency: string, lang: Lang): string | null {
  const cfg = WORD_CURRENCIES[currency];
  const d = parseDec(value);
  if (!cfg || !d || d.u < ZERO) return null;
  const [whole, frac = ''] = decToString(absDec(d), cfg.digits).split('.');
  if (whole.length > 15) return null;
  const w = BigInt(whole);
  const f = frac ? BigInt(frac) : ZERO;
  if (lang === 'en') {
    const parts: string[] = [];
    if (w > ZERO || f === ZERO) parts.push(`${numberToWordsEn(w)} ${w === ONE ? cfg.en.main.one : cfg.en.main.many}`);
    if (f > ZERO && cfg.en.sub) parts.push(`${numberToWordsEn(f)} ${f === ONE ? cfg.en.sub.one : cfg.en.sub.many}`);
    const joined = parts.join(' and ');
    return joined.charAt(0).toUpperCase() + joined.slice(1);
  }
  const parts: string[] = [];
  if (w > ZERO) parts.push(arPhrase(w, cfg.ar.main));
  else if (f === ZERO) parts.push(`صفر ${cfg.ar.main.gen}`);
  if (f > ZERO && cfg.ar.sub) parts.push(arPhrase(f, cfg.ar.sub));
  return parts.join(' و');
}

/** Sample amounts of the Language review section: [value, currency]. Edge cases of the grammar first. */
export const LANGUAGE_SAMPLES: [string, string][] = [
  ['1', 'SAR'],
  ['2', 'SAR'],
  ['3', 'SAR'],
  ['10', 'SAR'],
  ['11', 'SAR'],
  ['100', 'SAR'],
  ['101', 'SAR'],
  ['200', 'SAR'],
  ['1250', 'SAR'],
  ['2000', 'SAR'],
  ['2500.75', 'SAR'],
  ['1000000', 'SAR'],
  ['2000000', 'SAR'],
  ['0.50', 'SAR'],
  ['1.01', 'SAR'],
  ['12345678.90', 'AED'],
  ['3', 'USD'],
  ['12.05', 'USD'],
  ['1500000.01', 'USD'],
  ['1', 'AED'],
  ['5.25', 'AED'],
  ['2', 'KWD'],
  ['12.345', 'KWD'],
  ['1234.567', 'KWD'],
  ['1', 'TRY'],
  ['2', 'TRY'],
  ['8.50', 'TRY'],
  ['21', 'TRY'],
  ['18750000', 'JPY'],
  ['1250', 'JPY'],
];

/* ---------------------------------------------------------------- tests */

export interface WordsTest {
  id: string;
  label: string;
  expected: string;
  actual: string;
  pass: boolean;
}

const ar = (v: string, c: string) => amountInWords(v, c, 'ar') ?? 'null';
const en = (v: string, c: string) => amountInWords(v, c, 'en') ?? 'null';

/** [label, actual, expected] */
export function runWordsTest(): WordsTest[] {
  const cases: [string, string, string][] = [
    ['ar 1 SAR', ar('1', 'SAR'), 'ريال سعودي واحد'],
    ['ar 2 SAR (dual)', ar('2', 'SAR'), 'ريالان سعوديان'],
    ['ar 3 SAR (plural)', ar('3', 'SAR'), 'ثلاثة ريالات سعودية'],
    ['ar 10 SAR (plural)', ar('10', 'SAR'), 'عشرة ريالات سعودية'],
    ['ar 11 SAR (accusative)', ar('11', 'SAR'), 'أحد عشر ريالاً سعودياً'],
    ['ar 25 SAR', ar('25', 'SAR'), 'خمسة وعشرون ريالاً سعودياً'],
    ['ar 100 SAR (genitive)', ar('100', 'SAR'), 'مئة ريال سعودي'],
    ['ar 101 SAR (cheque style)', ar('101', 'SAR'), 'مئة وريال سعودي واحد'],
    ['ar 102 SAR', ar('102', 'SAR'), 'مئة وريالان سعوديان'],
    ['ar 111 SAR', ar('111', 'SAR'), 'مئة وأحد عشر ريالاً سعودياً'],
    ['ar 200 SAR (construct dual)', ar('200', 'SAR'), 'مئتا ريال سعودي'],
    ['ar 300 SAR', ar('300', 'SAR'), 'ثلاثمئة ريال سعودي'],
    ['ar 1,000 SAR', ar('1000', 'SAR'), 'ألف ريال سعودي'],
    ['ar 1,001 SAR', ar('1001', 'SAR'), 'ألف وريال سعودي واحد'],
    ['ar 1,250 SAR', ar('1250', 'SAR'), 'ألف ومئتان وخمسون ريالاً سعودياً'],
    ['ar 1,200 SAR (construct)', ar('1200', 'SAR'), 'ألف ومئتا ريال سعودي'],
    ['ar 2,000 SAR (construct dual)', ar('2000', 'SAR'), 'ألفا ريال سعودي'],
    ['ar 2,005 SAR', ar('2005', 'SAR'), 'ألفان وخمسة ريالات سعودية'],
    ['ar 3,000 SAR', ar('3000', 'SAR'), 'ثلاثة آلاف ريال سعودي'],
    ['ar 12,000 SAR', ar('12000', 'SAR'), 'اثنا عشر ألف ريال سعودي'],
    ['ar 100,000 SAR', ar('100000', 'SAR'), 'مئة ألف ريال سعودي'],
    ['ar 200,000 SAR', ar('200000', 'SAR'), 'مئتا ألف ريال سعودي'],
    ['ar 2,500.75 SAR', ar('2500.75', 'SAR'), 'ألفان وخمسمئة ريال سعودي وخمس وسبعون هللةً'],
    ['ar 1,000,000 SAR', ar('1000000', 'SAR'), 'مليون ريال سعودي'],
    ['ar 2,000,000 SAR (construct dual)', ar('2000000', 'SAR'), 'مليونا ريال سعودي'],
    ['ar 3,000,000 USD', ar('3000000', 'USD'), 'ثلاثة ملايين دولار أمريكي'],
    ['ar 0.50 SAR (halala only)', ar('0.50', 'SAR'), 'خمسون هللةً'],
    ['ar 1.01 SAR', ar('1.01', 'SAR'), 'ريال سعودي واحد وهللة واحدة'],
    ['ar 2.02 SAR', ar('2.02', 'SAR'), 'ريالان سعوديان وهللتان'],
    ['ar 0.00 SAR', ar('0', 'SAR'), 'صفر ريال سعودي'],
    ['ar 12,345,678.90 AED (tanween)', ar('12345678.90', 'AED'), 'اثنا عشر مليوناً وثلاثمئة وخمسة وأربعون ألفاً وستمئة وثمانية وسبعون درهماً إماراتياً وتسعون فلساً'],
    ['ar 21 TRY (feminine)', ar('21', 'TRY'), 'إحدى وعشرون ليرةً تركيةً'],
    ['ar 3 TRY (feminine plural)', ar('3', 'TRY'), 'ثلاث ليرات تركية'],
    ['ar 8.50 TRY', ar('8.50', 'TRY'), 'ثماني ليرات تركية وخمسون قرشاً'],
    ['ar 12.345 KWD (fils)', ar('12.345', 'KWD'), 'اثنا عشر ديناراً كويتياً وثلاثمئة وخمسة وأربعون فلساً'],
    ['ar 2 KWD', ar('2', 'KWD'), 'ديناران كويتيان'],
    ['ar 18,750,000 JPY', ar('18750000', 'JPY'), 'ثمانية عشر مليوناً وسبعمئة وخمسون ألف ين ياباني'],
    ['en 1,250 SAR', en('1250', 'SAR'), 'One thousand two hundred fifty Saudi riyals'],
    ['en 1 SAR', en('1', 'SAR'), 'One Saudi riyal'],
    ['en 2,500.75 SAR', en('2500.75', 'SAR'), 'Two thousand five hundred Saudi riyals and seventy-five halalas'],
    ['en 0.50 SAR', en('0.50', 'SAR'), 'Fifty halalas'],
    ['en 1.01 USD', en('1.01', 'USD'), 'One US dollar and one cent'],
    ['en 2.02 USD', en('2.02', 'USD'), 'Two US dollars and two cents'],
    ['en 1,000,000 SAR', en('1000000', 'SAR'), 'One million Saudi riyals'],
    ['en 2,000,000 AED', en('2000000', 'AED'), 'Two million UAE dirhams'],
    ['en 1,234.567 KWD', en('1234.567', 'KWD'), 'One thousand two hundred thirty-four Kuwaiti dinars and five hundred sixty-seven fils'],
    ['en 18,750,000 JPY', en('18750000', 'JPY'), 'Eighteen million seven hundred fifty thousand Japanese yen'],
    ['en 101 USD', en('101', 'USD'), 'One hundred one US dollars'],
    ['null for an unsupported currency', amountInWords('5', 'XYZ', 'en') ?? 'null', 'null'],
    ['null for a negative amount', amountInWords('-5', 'USD', 'en') ?? 'null', 'null'],
  ];
  return cases.map(([label, actual, expected], i) => ({ id: `w${i}`, label, expected, actual, pass: actual === expected }));
}

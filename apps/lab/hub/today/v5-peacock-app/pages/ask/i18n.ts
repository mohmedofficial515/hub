import type { PluralForms } from '../../kit';

interface Dict {
  title: string;
  meta: string;
  inputLabel: string;
  placeholder: string;
  search: string;
  scope: string;
  scopes: { all: string; docs: string; cards: string };
  docs: string;
  cards: string;
  resultCount: PluralForms;
  noHeading: string;
  openDoc: string;
  handoff: {
    title: string;
    body: string;
    noQuery: string;
    command: string;
    what: string;
    steps: string[];
    where: string;
    setup: string;
    setupLink: string;
    decision: string;
  };
  empty: {
    recent: string;
    clearRecent: string;
    try: string;
    tryBody: string;
  };
  noResults: { title: string; body: string };
  emptyWorkspace: { title: string; body: string; action: string };
  errorThing: string;
  loading: string;
  statusLine: string;
}

export const messages: { ar: Dict; en: Dict } = {
  ar: {
    title: 'اسأل المشروع',
    meta: 'بحث في الوثائق والبطاقات، بمقتطفات من النص نفسه. لا يكتب Hub إجابات.',
    inputLabel: 'ابحث في الوثائق والبطاقات',
    placeholder: 'ابحث بكلمات مثل: الاسترداد، المحفظة…',
    search: 'ابحث',
    scope: 'نطاق البحث',
    scopes: { all: 'الكل', docs: 'الوثائق', cards: 'البطاقات' },
    docs: 'في الوثائق',
    cards: 'في البطاقات',
    resultCount: { zero: 'لا نتائج', one: 'نتيجة واحدة', two: 'نتيجتان', few: '# نتائج', many: '# نتيجة', other: '# نتيجة' },
    noHeading: 'المقدمة',
    openDoc: 'افتح {path} عند هذا القسم',
    handoff: {
      title: 'تريد إجابة مكتوبة؟',
      body: 'Claude Code على جهازك يكتبها، وتظهر في طرفيتك لا هنا.',
      noQuery: 'اكتب سؤالك أولًا ليظهر الأمر جاهزًا للنسخ.',
      command: 'الأمر',
      what: 'ماذا يفعل هذا الأمر',
      steps: ['يبحث في هذه الوثائق والبطاقات نفسها، عبر MCP.', 'يقرأ أنسب الأقسام بحسابك أنت.', 'يجيب بلغتك، ويذكر لكل معلومة مسارها أو مفتاح بطاقتها.'],
      where: 'وإذا لم تجب الوثائق، يقول ذلك صراحة ويعرض فتح قرار.',
      setup: 'لم تثبّت حزمة الفريق بعد؟',
      setupLink: 'الأمر في صفحة التوكنات',
      decision: 'افتح قرارًا',
    },
    empty: {
      recent: 'بحثت عنها مؤخرًا',
      clearRecent: 'امسح السجل',
      try: 'جرّب',
      tryBody: 'يبحث في النص الكامل بالعربية والإنجليزية. مفتاح البطاقة يأخذك إليها مباشرة.',
    },
    noResults: { title: 'لا شيء يطابق بحثك', body: 'جرّب كلمات أقل، أو الكلمة نفسها بالعربية أو الإنجليزية.' },
    emptyWorkspace: { title: 'لا شيء للبحث فيه بعد', body: 'يبدأ البحث عند فهرسة أول مصدر وثائق.', action: 'افتح المصادر' },
    errorThing: 'نتائج البحث',
    loading: 'جارٍ البحث',
    statusLine: '{count} عن «{q}»',
  },
  en: {
    title: 'Ask the project',
    meta: 'Search across docs and cards, with excerpts of the text itself. Hub writes no answers.',
    inputLabel: 'Search docs and cards',
    placeholder: 'Search by words such as: refunds, wallet…',
    search: 'Search',
    scope: 'Search in',
    scopes: { all: 'All', docs: 'Docs', cards: 'Cards' },
    docs: 'In docs',
    cards: 'In cards',
    resultCount: { zero: 'No results', one: '1 result', other: '# results' },
    noHeading: 'Introduction',
    openDoc: 'Open {path} at this section',
    handoff: {
      title: 'Want a written answer?',
      body: 'Claude Code on your machine writes it, and it appears in your terminal, not here.',
      noQuery: 'Type your question first and the command appears here, ready to copy.',
      command: 'Command',
      what: 'What this command does',
      steps: ['Searches these same docs and cards, through MCP.', 'Reads the best sections, on your own account.', 'Answers in your language, citing a path or a card key for each fact.'],
      where: 'If the docs do not answer, it says so and offers to open a decision.',
      setup: 'Team pack not installed yet?',
      setupLink: 'The command is on the tokens page',
      decision: 'Open a decision',
    },
    empty: {
      recent: 'Recent searches',
      clearRecent: 'Clear history',
      try: 'Try',
      tryBody: 'It searches the full text in Arabic and English. A card key takes you straight to the card.',
    },
    noResults: { title: 'Nothing matched', body: 'Try fewer words, or the same word in Arabic or English.' },
    emptyWorkspace: { title: 'Nothing to search yet', body: 'Search starts once the first docs source is indexed.', action: 'Open sources' },
    errorThing: 'the search results',
    loading: 'Searching',
    statusLine: '{count} for “{q}”',
  },
};

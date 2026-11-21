import type { HubCard } from '@lab/mocks/hub-app';
import { getWb, startDoc, startTask, send } from './store';
import type { L, Mode, ScriptId } from './mock';

const l = (ar: string, en: string): L => ({ ar, en });

export interface Suggestion {
  id: string;
  label: L;
  /** What it does and what will happen, in the suggestion's own words. */
  what: L;
  then: L;
  mode?: Mode;
  run: () => void;
}

interface Where {
  view: string;
  card: HubCard | null;
  /** A doc open on the Docs page, by card and path. */
  doc: { key: string; path: string } | null;
}

const ask = (key: string | null, view: string, prompt: L, reply: L, mode: Mode = 'ask', script: ScriptId = 'answer') => () =>
  send({ text: prompt, script, reply, mode, context: key ? { cardKey: key } : { view }, fresh: !getWb().activeId });

const fromCard = (c: HubCard): Suggestion[] => {
  const k = c.key;
  switch (c.type) {
    case 'task': {
      if (c.status === 'done' || c.status === 'cancelled') {
        return [
          { id: 'document', label: l('وثّق هذه المهمة', 'Document this task'), what: l('يكتب ما أنجزته في الوثائق، بعد أن يبحث عن وثيقة موجودة.', 'Writes what it achieved into the docs, after searching for an existing doc.'), then: l('لا يُحفظ شيء قبل موافقتك.', 'Nothing is saved until you approve.'), run: () => startDoc('document', { key: k }) },
          { id: 'what', label: l('ماذا تغيّر بها؟', 'What did it change?'), what: l('يلخص ما تغيّر في الكود بسبب هذه المهمة.', 'Sums up what changed in the code because of it.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: ask(k, '', l(`ماذا غيّرت ${k}؟`, `What did ${k} change?`), l(`غيّرت \`${k}\` ملفين في مسار الدفع، وتقريرها على البطاقة.`, `\`${k}\` changed two files on the payment path, and its report is on the card.`)) },
        ];
      }
      if (c.status === 'in_review') {
        return [
          { id: 'check', label: l('هل تحقق شروط القبول؟', 'Does it meet its acceptance items?'), what: l('يقارن ما سُلّم بشروط البطاقة ويشغّل فحوصها.', 'Compares what was delivered with the card’s items and runs its checks.'), then: l('يقرأ ويفحص فقط، والتأكيد لك على البطاقة.', 'It only reads and checks, and confirming stays with you on the card.'), mode: 'ask', run: ask(k, '', l(`هل تحقق ${k} شروط قبولها؟`, `Does ${k} meet its acceptance items?`), l('شرطان تحققا بالاختبارات، وشرط واحد عن الشكل لا أستطيع فحصه من الكود. أكّد ذلك بنفسك قبل أن تغلقها.', 'Two items are met by the tests, and one about how it looks I cannot check from the code. Confirm that yourself before you close it.')) },
          { id: 'document', label: l('وثّق هذه المهمة', 'Document this task'), what: l('يكتب ما أنجزته في الوثائق، بعد أن يبحث عن وثيقة موجودة.', 'Writes what it achieved into the docs, after searching for an existing doc.'), then: l('لا يُحفظ شيء قبل موافقتك.', 'Nothing is saved until you approve.'), run: () => startDoc('document', { key: k }) },
        ];
      }
      const blockers = c.links.filter((x) => x.kind === 'blocked_by').map((x) => x.key);
      const shared: Suggestion = { id: 'plan', label: l('خطّط لهذا', 'Plan this'), what: l('يضع خطوات وفحوصًا لهذه المهمة، ولا يغيّر شيئًا.', 'Writes steps and checks for this task, and changes nothing.'), then: l('ينتهي الدور بخطة وزر لتنفيذها.', 'The turn ends in a plan with a button to run it.'), mode: 'plan', run: () => send({ text: l(`خطّط لـ ${k}`, `Plan ${k}`), script: 'plan', mode: 'plan', context: { cardKey: k, action: 'plan' }, fresh: true }) };
      if (blockers.length) {
        return [
          { id: 'blocked', label: l('ما الذي يعطّلها؟', 'What is holding it up?'), what: l(`تنتظر ${blockers.join(' و')}.`, `It waits on ${blockers.join(' and ')}.`), then: l('يشرح ما ينقص ومن عليه الخطوة.', 'Explains what is missing and whose move it is.'), mode: 'ask', run: ask(k, '', l(`ما الذي يعطّل ${k}؟`, `What is holding up ${k}?`), l(`\`${k}\` تنتظر ${blockers.map((b) => `\`${b}\``).join(' و')}. الخطوة التالية ليست في الكود: قرار أو تسليم ينقصها.`, `\`${k}\` waits on ${blockers.map((b) => `\`${b}\``).join(' and ')}. The next move is not in the code: it needs a decision or a delivery.`)) },
          shared,
          { id: 'do', label: l('نفّذها بخطوات المهمة', 'Do it with the task steps'), what: l('افهم، خطّط، نفّذ، تحقّق، أبلغ، مع قائمة حية.', 'Understand, Plan, Execute, Verify, Report, with a live checklist.'), then: l('تعمل رغم أنها معطلة، فاقرأ التعطيل أولًا.', 'It runs even though the task is blocked, so read the blocker first.'), mode: 'execute', run: () => startTask(k) },
        ];
      }
      return [
        { id: 'do', label: l('نفّذها بخطوات المهمة', 'Do it with the task steps'), what: l('افهم، خطّط، نفّذ، تحقّق، أبلغ، مع قائمة حية.', 'Understand, Plan, Execute, Verify, Report, with a live checklist.'), then: l('يصل التقرير إلى البطاقة، وتبقى مفتوحة حتى تؤكد.', 'The report reaches the card, and it stays open until you confirm.'), mode: 'execute', run: () => startTask(k) },
        shared,
        { id: 'explain', label: l('اشرح المطلوب', 'Explain what it asks'), what: l('يقرأ البطاقة وشروط قبولها ويشرحها.', 'Reads the card and its acceptance items, and explains them.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: () => send({ text: l(`اشرح ${k}`, `Explain ${k}`), script: 'explain', mode: 'ask', context: { cardKey: k, action: 'explain' }, fresh: true }) },
      ];
    }
    case 'decision':
      return c.status === 'open'
        ? [
            { id: 'compare', label: l('قارن الخيارات لأقرر', 'Compare the options so I can decide'), what: l('يقارن كل خيار بما يكلفه وما يغيّره.', 'Compares each option by what it costs and what it changes.'), then: l('يقرأ فقط، والقرار لك.', 'It only reads, and the decision stays yours.'), mode: 'ask', run: ask(k, '', l(`قارن خيارات ${k} لأقرر.`, `Compare the options on ${k} so I can decide.`), l('**الفرق الحقيقي بين الخيارات:** الأول يغيّر السعر الظاهر، والثاني يغيّر الهامش فقط، والثالث يضيف قاعدة يصعب شرحها. البطاقة تنتظر قرارك، ولا أقرره أنا.', '**The real difference between the options:** the first changes the shown price, the second changes only the margin, and the third adds a rule that is hard to explain. The card waits for your decision, and I do not make it.')) },
            { id: 'blocks', label: l('ماذا ينتظر هذا القرار؟', 'What is waiting on this?'), what: l('يسرد ما يعطله هذا القرار.', 'Lists what this decision holds up.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: ask(k, '', l(`ماذا ينتظر ${k}؟`, `What is waiting on ${k}?`), l(`ينتظر \`${k}\`: ${c.links.filter((x) => x.kind === 'blocks').map((x) => `\`${x.key}\``).join(' و') || 'لا شيء مباشر'}.`, `Waiting on \`${k}\`: ${c.links.filter((x) => x.kind === 'blocks').map((x) => `\`${x.key}\``).join(' and ') || 'nothing directly'}.`)) },
          ]
        : [{ id: 'after', label: l('وثّق هذا القرار', 'Document this decision'), what: l('يكتب القرار وسببه في الوثائق بعد البحث عن مكانه.', 'Writes the decision and its reason into the docs, after finding where it belongs.'), then: l('لا يُحفظ شيء قبل موافقتك.', 'Nothing is saved until you approve.'), run: () => startDoc('document', { key: k }) }];
    case 'need':
      return c.status === 'delivered'
        ? [{ id: 'verify', label: l('تحقق من هذا التسليم', 'Verify this delivery'), what: l('يفحص ما سُلّم، ولا يغيّر شيئًا.', 'Checks what was delivered, and changes nothing.'), then: l('التأكيد يبقى لك على البطاقة.', 'Confirming stays with you on the card.'), mode: 'ask', run: ask(k, '', l(`تحقق من تسليم ${k}.`, `Verify the delivery on ${k}.`), l('الموقع المذكور موجود، ولم أقرأ القيمة نفسها لأن المحتوى سري. أكّد على البطاقة بعد أن تجربها.', 'The location it names exists, and I did not read the value itself because it is secret. Confirm on the card after you try it.')) }]
        : [
            { id: 'deliver', label: l('كيف أسلّم هذا؟', 'How do I deliver this?'), what: l('يشرح المطلوب بالضبط وأين يُوضع.', 'Explains exactly what is needed and where it goes.'), then: l('يقرأ فقط. لا تكتب القيمة في المحادثة.', 'It only reads. Do not type the value into the chat.'), mode: 'ask', run: ask(k, '', l(`كيف أسلّم ${k}؟`, `How do I deliver ${k}?`), l('المطلوب: ضع القيمة في `.env` على الخادم، ثم اكتب **مكانها** في نموذج التسليم، لا قيمتها. تحقق ذلك من تشغيل الاختبار المذكور في البطاقة.', 'What it needs: put the value in `.env` on the server, then write **where it is** in the delivery form, not the value. You can verify that by running the test the card names.')) },
            { id: 'who', label: l('ماذا يعطّل غيابه؟', 'What does its absence block?'), what: l('يسرد البطاقات التي تنتظره.', 'Lists the cards waiting on it.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: ask(k, '', l(`ماذا يعطّل غياب ${k}؟`, `What does missing ${k} block?`), l(`غيابه يعطّل: ${c.links.filter((x) => x.kind === 'blocks').map((x) => `\`${x.key}\``).join(' و') || 'لا شيء مسجّل'}.`, `Missing it blocks: ${c.links.filter((x) => x.kind === 'blocks').map((x) => `\`${x.key}\``).join(' and ') || 'nothing on record'}.`)) },
          ];
    case 'doc':
      return [
        { id: 'improve', label: l('حسّن هذه الوثيقة', 'Improve this doc'), what: l('يقترح تحديثًا من الكود والبطاقات.', 'Proposes an update from the code and the cards.'), then: l('بحث، ثم اقتراح، ثم مسودة فرقًا. لا يُكتب شيء قبل موافقتك.', 'Search, a proposal, then a draft as a diff. Nothing is written until you approve.'), run: () => startDoc('improve', { key: k, path: c.doc.path }) },
        { id: 'true', label: c.status === 'stale' ? l('ما القديم فيها؟', 'What is out of date in it?') : l('هل ما زالت صحيحة؟', 'Is it still true?'), what: l('يقارن الوثيقة بالكود الحالي.', 'Compares the doc with the current code.'), then: l('يقرأ فقط، ويذكر ما لم يستطع التحقق منه.', 'It only reads, and names what it could not verify.'), mode: 'ask', run: ask(k, 'docs', l(`هل ${c.doc.path} ما زالت صحيحة؟`, `Is ${c.doc.path} still true?`), l('معظمها يطابق الكود. قسمان تغيّرا بعد آخر تحديث، وعبارة واحدة لم أستطع التحقق منها لأنها تصف شاشة لا كودًا.', 'Most of it matches the code. Two sections changed after the last update, and I could not verify one claim because it describes a screen, not code.')) },
      ];
    case 'redesign':
      return c.status === 'approved' || c.status === 'ported'
        ? [{ id: 'port', label: l('خطة نقل هذه النسخة', 'Plan the port of this version'), what: l('يسرد المكونات المشتركة التي ستتغير والصفحات التي تستعملها.', 'Lists the shared components that will change and the pages that use them.'), then: l('يقرأ فقط. النقل نفسه يحتاج طلبًا منك.', 'It only reads. The port itself needs a request from you.'), mode: 'plan', run: () => send({ text: l(`خطة نقل ${k}`, `Plan the port of ${k}`), script: 'plan', mode: 'plan', context: { cardKey: k, action: 'plan' }, fresh: true }) }]
        : [
            { id: 'review', label: l('افتح مراجعة لهذه النسخة', 'Review this version'), what: l('يقارن النسخة بالصفحة الحالية وبمعايير المختبر.', 'Compares the version with the current page and the lab’s bar.'), then: l('يقرأ فقط، والموافقة لك.', 'It only reads, and approval stays yours.'), mode: 'ask', run: ask(k, '', l(`راجع ${k}.`, `Review ${k}.`), l('الفكرة واضحة والتسلسل جيد عند 1440. أضعف نقطة عند 390: الزر الأساسي تحت الطي. لا أغيّر حالتها، فالموافقة لك.', 'The idea is clear and the hierarchy holds at 1440. The weakest point is at 390: the main button sits below the fold. I will not change its status, because approval is yours.')) },
            { id: 'next', label: l('ابدأ النسخة التالية', 'Start the next version'), what: l('يبني نسخة جديدة من ملاحظات هذه النسخة.', 'Builds a new version from this one’s notes.'), then: l('لا تتغير الصفحة الحقيقية.', 'The real page does not change.'), run: () => send({ text: l(`أعد تصميم ${k}: النسخة التالية`, `Redesign ${k}: the next version`), script: 'redesign', mode: 'execute', context: { cardKey: k, action: 'redesign' }, fresh: true }) },
          ];
    default:
      return [
        { id: 'explain', label: l('اشرح هذا', 'Explain this'), what: l('يقرأ البطاقة وروابطها ويشرحها.', 'Reads the card and its links, and explains them.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: () => send({ text: l(`اشرح ${k}`, `Explain ${k}`), script: 'explain', mode: 'ask', context: { cardKey: k, action: 'explain' }, fresh: true }) },
        { id: 'plan', label: l('خطّط لهذا', 'Plan this'), what: l('يضع خطة، ولا يغيّر شيئًا.', 'Writes a plan, and changes nothing.'), then: l('ينتهي الدور بخطة وزر لتنفيذها.', 'The turn ends in a plan with a button to run it.'), mode: 'plan', run: () => send({ text: l(`خطّط لـ ${k}`, `Plan ${k}`), script: 'plan', mode: 'plan', context: { cardKey: k, action: 'plan' }, fresh: true }) },
      ];
  }
};

const fromPage = (view: string): Suggestion[] => {
  switch (view) {
    case 'today':
      return [
        { id: 'next', label: l('ماذا أفعل الآن، ولماذا؟', 'What should I do next, and why?'), what: l('يقرأ قائمة «التالي» ويشرح ترتيبها.', 'Reads the Do next list and explains its order.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: ask(null, 'today', l('ماذا أفعل الآن، ولماذا؟', 'What should I do next, and why?'), l('ابدأ بقرار `GTV-231`: تأخر، وتنتظره مهمتان منهما الدفع الحي. بعده `GTV-275`، جاهزة ولها موعد قريب.', 'Start with decision `GTV-231`: it is late, and two tasks wait on it, including live payments. After that `GTV-275`, which is ready and due soon.')) },
        { id: 'since', label: l('ما الذي تغيّر منذ أمس؟', 'What changed since yesterday?'), what: l('يلخص الأحداث الجديدة في المشروع.', 'Sums up what is new in the project.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: ask(null, 'today', l('ما الذي تغيّر منذ أمس؟', 'What changed since yesterday?'), l('ثلاثة أشياء تهمك: تسليم مفتاح Moyasar ينتظر تحققًا، ونسخة wallet v7 في المراجعة، وتغيّر كاسر في عقد الاسترداد.', 'Three things matter to you: the Moyasar key delivery awaits verifying, wallet v7 is in review, and the refund contract has a breaking change.')) },
      ];
    case 'tasks':
      return [
        { id: 'small', label: l('أي مهمة جاهزة أصغر؟', 'Which ready task is smallest?'), what: l('يختار من الجاهز حسب الحجم وما يعطله.', 'Picks from what is ready, by size and by what it blocks.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: ask(null, 'tasks', l('أي مهمة جاهزة أصغر؟', 'Which ready task is smallest?'), l('`GTV-276` صغيرة وجاهزة، ولا تعطل غيرها. `GTV-275` أكبر قليلًا، لكن موعدها أقرب.', '`GTV-276` is small and ready, and blocks nothing. `GTV-275` is a little larger, but due sooner.')) },
        { id: 'week', label: l('خطّط لأسبوعي', 'Plan my week'), what: l('يرتب الجاهز على أيام حسب حدود الطابور.', 'Lays out what is ready over the days, within the queue limits.'), then: l('خطة فقط، ولا يُجدول شيء قبل أن تقبل.', 'A plan only, and nothing is scheduled until you accept.'), mode: 'plan', run: () => send({ text: l('خطّط لأسبوعي', 'Plan my week'), script: 'plan', mode: 'plan', context: { view: 'tasks', action: 'plan' }, fresh: true }) },
      ];
    case 'docs':
      return [
        { id: 'gaps', label: l('ابحث عن النواقص', 'Find gaps'), what: l('يقارن ما تذكره البطاقات والكود بما في الوثائق.', 'Compares what cards and code mention with the docs.'), then: l('تقرير فقط، ولا يكتب شيئًا.', 'A report only. It writes nothing.'), mode: 'ask', run: () => startDoc('gaps') },
        { id: 'find', label: l('أين كُتب هذا؟', 'Where is this written?'), what: l('يبحث في الوثائق ويعطيك المصدر.', 'Searches the docs and gives you the source.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: ask(null, 'docs', l('أين كُتب ما يخص استرداد الدفع؟', 'Where is the payment refund written up?'), l('في `docs/21-confirmation-safety.md` القسم 5، وفي `docs/18-post-booking-services-admin.md` لمسار الموظفين.', 'In `docs/21-confirmation-safety.md` section 5, and in `docs/18-post-booking-services-admin.md` for the staff path.')) },
      ];
    case 'decisions':
      return [{ id: 'oldest', label: l('أي قرار أقدم ويعطل أكثر؟', 'Which decision is oldest and blocks most?'), what: l('يرتب القرارات المفتوحة بما تعطله.', 'Ranks open decisions by what they block.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: ask(null, 'decisions', l('أي قرار يعطل أكثر؟', 'Which decision blocks most?'), l('`GTV-231`: يعطل بطاقتين، ومنهما الدفع الحي.', '`GTV-231`: it blocks two cards, including live payments.')) }];
    case 'inbox':
      return [{ id: 'triage', label: l('ماذا يحتاج ردي اليوم؟', 'What needs my reply today?'), what: l('يفرز الوارد حسب ما ينتظرك.', 'Sorts the inbox by what waits on you.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: ask(null, 'inbox', l('ماذا يحتاج ردي اليوم؟', 'What needs my reply today?'), l('قرار واحد وإحالة واحدة. الباقي للعلم.', 'One decision and one handoff. The rest is for your information.')) }];
    case 'redesign':
      return [{ id: 'review', label: l('أي نسخة تنتظر قراري؟', 'Which version waits for my decision?'), what: l('يعرض النسخ في المراجعة وأقواها.', 'Shows the versions in review and the strongest one.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: ask(null, 'redesign', l('أي نسخة تنتظر قراري؟', 'Which version waits for my decision?'), l('`GTV-252` في المراجعة، ودرجتها الأعلى في صفحة المحفظة.', '`GTV-252` is in review, with the highest score on the wallet page.')) }];
    default:
      return [{ id: 'explain', label: l('اشرح هذه الصفحة', 'Explain this page'), what: l('يشرح ما تعرضه هذه الصفحة وما تفعله فيها.', 'Explains what this page shows and what you do on it.'), then: l('يقرأ فقط.', 'It only reads.'), mode: 'ask', run: () => send({ text: l('اشرح هذه الصفحة', 'Explain this page'), script: 'explain', mode: 'ask', context: { view }, fresh: true }) }];
  }
};

/** Suggested prompts from where the owner is: the open card by its type and state, then the open doc, then the page (docs/16 §7.1). */
export function suggestionsFor({ view, card, doc }: Where): Suggestion[] {
  if (card) return fromCard(card).slice(0, 3);
  if (doc) {
    return [
      { id: 'improve', label: l('حسّن هذه الوثيقة', 'Improve this doc'), what: l('يقترح تحديثًا من الكود والبطاقات.', 'Proposes an update from the code and the cards.'), then: l('بحث، ثم اقتراح، ثم مسودة فرقًا. لا يُكتب شيء قبل موافقتك.', 'Search, a proposal, then a draft as a diff. Nothing is written until you approve.'), run: () => startDoc('improve', doc) },
      { id: 'gaps', label: l('ابحث عن النواقص', 'Find gaps'), what: l('يقارن ما تذكره البطاقات والكود بما في الوثائق.', 'Compares what cards and code mention with the docs.'), then: l('تقرير فقط، ولا يكتب شيئًا.', 'A report only. It writes nothing.'), mode: 'ask', run: () => startDoc('gaps') },
    ];
  }
  return fromPage(view).slice(0, 3);
}

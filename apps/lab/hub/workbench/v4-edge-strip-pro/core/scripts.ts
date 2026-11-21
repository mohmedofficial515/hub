import type { ChangedFile, DiffLine, Draft, GapReport, L, Report, Step } from './mock';

/**
 * The two protocols of docs/16 §7.1 as scripted turns. Every tool name and argument here is illustrative: `search_docs` and `save_doc` are named by the
 * docs but not built yet, and the others stand in for Hub's MCP tools. The turn's shape (steps, exact input, result, error) is what S1 proved.
 */
const l = (ar: string, en: string): L => ({ ar, en });
const opening = (cold: boolean): Step[] => (cold ? [{ t: 'starting', ms: 900 }, { t: 'thinking', ms: 400 }] : [{ t: 'thinking', ms: 500 }]);
const stage = (id: Extract<Step, { t: 'stage' }>['id'], state: Extract<Step, { t: 'stage' }>['state'], note?: L): Step => ({ t: 'stage', id, state, note });

// ── Task execution protocol ─────────────────────────────────────────────────────────────────────

const filesFor = (folder: string): ChangedFile[] => {
  if (folder.endsWith('backend')) {
    return [
      {
        path: 'src/wallet/wallet-topup.controller.ts',
        added: 9,
        removed: 2,
        diff: [
          { t: 'hunk', text: '@@ -22,6 +22,13 @@ export class WalletTopupController {' },
          { t: 'del', text: '  async topUp(@Body() body: TopupDto) {' },
          { t: 'del', text: '    return this.commands.execute(new TopUpWallet(body));' },
          { t: 'add', text: "  async topUp(@Body() body: TopupDto, @Headers('Idempotency-Key') key: string) {" },
          { t: 'add', text: '    if (!key) throw new IdempotencyKeyRequired();' },
          { t: 'add', text: '    const earlier = await this.keys.find(key);' },
          { t: 'add', text: '    if (earlier) return earlier;' },
          { t: 'add', text: '    const result = await this.commands.execute(new TopUpWallet(body));' },
          { t: 'add', text: '    await this.keys.keep(key, result, { hours: 24 });' },
          { t: 'add', text: '    return result;' },
          { t: 'ctx', text: '  }' },
        ],
      },
      {
        path: 'test/e2e/wallet-topup.e2e-spec.ts',
        added: 31,
        removed: 0,
        diff: [
          { t: 'hunk', text: '@@ -0,0 +1,4 @@' },
          { t: 'add', text: "it('charges once when two requests share a key', async () => {" },
          { t: 'add', text: "  const [a, b] = await Promise.all([topUp('k-1'), topUp('k-1')]);" },
          { t: 'add', text: '  expect(a.id).toBe(b.id);' },
          { t: 'add', text: '});' },
        ],
      },
    ];
  }
  return [
    {
      path: 'src/components/bookings/booking-row.tsx',
      added: 46,
      removed: 28,
      diff: [
        { t: 'hunk', text: '@@ -14,7 +14,9 @@ export function BookingRow({ booking }: Props) {' },
        { t: 'ctx', text: '  return (' },
        { t: 'del', text: '    <tr className="h-16 border-b">' },
        { t: 'del', text: '      <td>{booking.reference}</td>' },
        { t: 'add', text: '    <tr className="h-11 border-b border-border">' },
        { t: 'add', text: '      <td dir="ltr" className="key">' },
        { t: 'add', text: '        {booking.reference}' },
        { t: 'add', text: '      </td>' },
        { t: 'ctx', text: '    </tr>' },
      ],
    },
    {
      path: 'src/components/ui/table.tsx',
      added: 6,
      removed: 2,
      diff: [
        { t: 'hunk', text: '@@ -30,2 +30,6 @@' },
        { t: 'del', text: "const rowClass = 'h-16';" },
        { t: 'del', text: 'export const TableRow = tr(rowClass);' },
        { t: 'add', text: "const rowClass = { comfortable: 'h-16', dense: 'h-11' };" },
        { t: 'add', text: "export const TableRow = ({ density = 'comfortable', ...props }: RowProps) => (" },
        { t: 'add', text: '  <tr className={rowClass[density]} {...props} />' },
        { t: 'add', text: ');' },
      ],
    },
  ];
};

const understand = (key: string): Step[] => [
  stage('understand', 'running'),
  { t: 'tool', name: 'mcp__hub__get_card', detail: key, ms: 420, input: `{ "key": "${key}" }`, output: `{ "key": "${key}", "type": "task", "acceptance": "3 items", "links": 1, "docs": 1 }`, decision: 'rules' },
  { t: 'tool', name: 'mcp__hub__search_docs', detail: `"${key}"`, ms: 360, input: `{ "query": "${key}", "limit": 5 }`, output: 'docs/api-integration/README.md\ndocs/21-confirmation-safety.md', decision: 'rules' },
  stage('understand', 'done', l('قرأت البطاقة وشروط قبولها ووثيقتين مرتبطتين.', 'Read the card, its acceptance items and two linked docs.')),
];

const plan = (): Step[] => [stage('plan', 'running'), { t: 'thinking', ms: 500 }, stage('plan', 'done', l('3 خطوات و3 فحوص، كلها داخل المجلد.', '3 steps and 3 checks, all inside the folder.'))];

const execute = (files: ChangedFile[]): Step[] => [
  stage('execute', 'running'),
  ...files.map(
    (f): Step => ({
      t: 'tool',
      name: 'Edit',
      detail: f.path,
      ms: 620,
      result: l(`+${f.added} −${f.removed}`, `+${f.added} −${f.removed}`),
      input: `{ "file_path": "${f.path}", "old_string": "…", "new_string": "…" }`,
      output: 'The file was updated.',
      file: f,
      decision: 'rules',
    }),
  ),
  stage('execute', 'done', l('تغيّر ملفان في هذا المجلد. لم يُلتزم بشيء.', 'Two files changed in this folder. Nothing was committed.')),
];

const TYPECHECK_OK = '> tsc --noEmit\n\nDone in 8.2 s, 0 errors.';
const TESTS_OK = 'PASS src/components/bookings/booking-row.test.tsx (9 tests)\nPASS src/components/ui/table.test.tsx (6 tests)\n\nTests: 15 passed, 15 total\nTime: 12.4 s';
const TESTS_FAIL = [
  'FAIL src/components/ui/table.test.tsx',
  '  x keeps the comfortable height by default (21 ms)',
  '',
  '    Expected: "h-16"',
  '    Received: "h-11"',
  '',
  '      41 |   render(<TableRow />);',
  "    > 42 |   expect(row().className).toContain('h-16');",
  '',
  'Tests: 1 failed, 14 passed, 15 total',
].join('\n');
const LINT_OK = 'Checked 214 files, no problems.';

const reportStep = (key: string, files: ChangedFile[]): Step => ({
  t: 'report',
  report: {
    cardKey: key,
    summary: l('أنجزت ما تطلبه البطاقة وأصبحت كل الفحوص ناجحة. لا شيء مرفوع، والتغييرات في المجلد بانتظارك.', 'Did what the card asks, and every check passes. Nothing is pushed, and the changes wait for you in the folder.'),
    files: files.map(({ path, added, removed }) => ({ path, added, removed })),
    checks: [
      { command: 'pnpm typecheck', passed: true, output: TYPECHECK_OK },
      { command: 'pnpm test', passed: true, output: TESTS_OK },
      { command: 'pnpm lint', passed: true, output: LINT_OK },
    ],
    notChecked: [l('الشكل في متصفح حقيقي.', 'How it looks in a real browser.'), l('الأجهزة الأخرى.', 'Other devices.')],
  },
});

const finishReport = (key: string, files: ChangedFile[]): Step[] => [
  stage('report', 'running'),
  { t: 'tool', name: 'mcp__hub__add_evidence', detail: key, ms: 380, input: `{ "key": "${key}", "kind": "report", "files": ${files.length}, "checks": 3 }`, output: 'Saved on the card.', decision: 'rules' },
  reportStep(key, files),
  stage('report', 'done', l('وصل التقرير إلى البطاقة دليلًا.', 'The report reached the card as evidence.')),
  { t: 'text', text: l(`لم تُغلق \`${key}\`. التقرير عليها، وأنت من يؤكد.`, `\`${key}\` is still open. The report is on it, and you confirm it.`) },
];

export function taskScript(key: string, folder: string, cold: boolean, fail: boolean): Step[] {
  const files = filesFor(folder);
  const head: Step[] = [...opening(cold), { t: 'protocol', protocol: 'task', target: key }, ...understand(key), ...plan(), ...execute(files), stage('verify', 'running'), { t: 'tool', name: 'Bash', detail: 'pnpm typecheck', ms: 700, result: l('لا أخطاء', '0 errors'), input: '{ "command": "pnpm typecheck" }', output: TYPECHECK_OK, decision: 'rules' }];
  if (!fail) {
    return [
      ...head,
      { t: 'tool', name: 'Bash', detail: 'pnpm test', ms: 800, result: l('15 ناجحًا', '15 passing'), input: '{ "command": "pnpm test" }', output: TESTS_OK, decision: 'rules' },
      { t: 'tool', name: 'Bash', detail: 'pnpm lint', ms: 420, result: l('سليم', 'Clean'), input: '{ "command": "pnpm lint" }', output: LINT_OK, decision: 'rules' },
      stage('verify', 'done', l('3 من 3 فحوص نجحت.', '3 of 3 checks passed.')),
      ...finishReport(key, files),
      { t: 'end', usage: { input: 24600, output: 3880, cacheRead: 61200 } },
    ];
  }
  return [
    ...head,
    { t: 'tool', name: 'Bash', detail: 'pnpm test', ms: 800, input: '{ "command": "pnpm test" }', error: TESTS_FAIL, decision: 'rules' },
    stage('verify', 'failed', l('فحص واحد فشل: `pnpm test`. توقفت هنا، ولم أكتب تقريرًا بالنجاح.', 'One check failed: `pnpm test`. I stopped here and wrote no success report.')),
    stage('report', 'skipped'),
    {
      t: 'text',
      text: l(
        'توقفت عند التحقق. اختبار `table.test.tsx` يتوقع الارتفاع القديم، وقد يكون الخطأ في الاختبار أو في التغيير نفسه، ولا أحسم ذلك وحدي. النتيجة الكاملة في الخطوة المفتوحة أعلاه.',
        'I stopped at Verify. `table.test.tsx` expects the old height, so either the test or the change is wrong, and I will not settle that alone. The full output is in the step above.',
      ),
    },
    { t: 'end', state: 'failed', usage: { input: 22100, output: 2960, cacheRead: 58400 } },
    {
      t: 'choice',
      choice: {
        variant: 'verify',
        title: l('فشل فحص، فالمهمة لم تكتمل', 'A check failed, so the task is not finished'),
        body: l('المطلوب منك: هل أصلح وأعيد الفحص، أم نتوقف ونسجّل ما حدث على البطاقة؟', 'Your call: should I fix it and check again, or stop and note what happened on the card?'),
        options: [
          { id: 'fix', label: l('أصلح وأعيد الفحص', 'Fix and check again'), tip: l('يعدّل Claude ويعيد الفحوص الثلاثة. لا يصل تقرير نجاح إلا إن نجحت كلها.', 'Claude edits, then runs all three checks again. A success report only follows if they all pass.'), primary: true },
          { id: 'note', label: l('توقف وسجّل على البطاقة', 'Stop and note it on the card'), tip: l('يضع Claude ما حدث والفحص الفاشل على البطاقة، موسومًا بأنه لم يكتمل. التغييرات تبقى في المجلد.', 'Claude puts what happened and the failed check on the card, marked as not finished. The changes stay in the folder.') },
        ],
      },
      branches: {
        fix: [
          stage('verify', 'running', l('إعادة الفحوص بعد الإصلاح.', 'Running the checks again after the fix.')),
          { t: 'tool', name: 'Edit', detail: 'src/components/ui/table.tsx', ms: 500, result: l('+1 −1', '+1 −1'), input: '{ "file_path": "src/components/ui/table.tsx", "old_string": "density = \'dense\'", "new_string": "density = \'comfortable\'" }', output: 'The file was updated.', decision: 'rules' },
          { t: 'tool', name: 'Bash', detail: 'pnpm test', ms: 800, result: l('15 ناجحًا', '15 passing'), input: '{ "command": "pnpm test" }', output: TESTS_OK, decision: 'rules' },
          { t: 'tool', name: 'Bash', detail: 'pnpm lint', ms: 420, result: l('سليم', 'Clean'), input: '{ "command": "pnpm lint" }', output: LINT_OK, decision: 'rules' },
          stage('verify', 'done', l('3 من 3 فحوص نجحت بعد الإصلاح.', '3 of 3 checks passed after the fix.')),
          ...finishReport(key, files),
          { t: 'end', usage: { input: 9100, output: 1240, cacheRead: 64800 } },
        ],
        note: [
          { t: 'tool', name: 'mcp__hub__add_evidence', detail: key, ms: 380, input: `{ "key": "${key}", "kind": "note", "finished": false }`, output: 'Saved on the card.', decision: 'rules' },
          {
            t: 'report',
            report: {
              cardKey: key,
              partial: true,
              summary: l('توقف العمل عند التحقق. التغييرات في المجلد، وفحص واحد يفشل.', 'Work stopped at Verify. The changes are in the folder, and one check fails.'),
              files: files.map(({ path, added, removed }) => ({ path, added, removed })),
              checks: [
                { command: 'pnpm typecheck', passed: true, output: TYPECHECK_OK },
                { command: 'pnpm test', passed: false, output: TESTS_FAIL },
              ],
              notChecked: [l('`pnpm lint` لم يبدأ.', '`pnpm lint` never ran.')],
            },
          },
          { t: 'end', usage: { input: 3100, output: 410, cacheRead: 58400 } },
        ],
      },
    },
  ];
}

// ── Document development protocol ───────────────────────────────────────────────────────────────

const HOLD_SECTION: DiffLine[] = [
  { t: 'add', text: '' },
  { t: 'add', text: '### 4.4 When the hold gets no answer' },
  { t: 'add', text: '' },
  { t: 'add', text: 'A hold with no answer counts as refused, so no money moves. The customer sees the same message as for a refused seat.' },
  { t: 'add', text: 'The hold gives up after 10.5 s.', flag: 'f1' },
  { t: 'add', text: '' },
];

const hold = (base: string): Draft => ({
  docKey: 'GTV-180',
  path: 'docs/21-confirmation-safety.md',
  base,
  state: 'open',
  before: '## 5. R2: Customer chooses the refund destination',
  insert: '',
  lines: [
    { t: 'hunk', text: '@@ -58,4 +58,10 @@ ## 4. R1: Silent hold before charge' },
    { t: 'ctx', text: '  "excludeAirlines": ["ZZ"]' },
    { t: 'ctx', text: '}' },
    { t: 'ctx', text: '```' },
    ...HOLD_SECTION,
    { t: 'ctx', text: '## 5. R2: Customer chooses the refund destination' },
  ],
  flags: [
    {
      id: 'f1',
      claim: l('«تتوقف محاولة الإمساك بعد 10.5 ثانية»', '"The hold gives up after 10.5 s"'),
      why: l('الرقم من سجل واحد في القسم 1، ولم أجد في `src/` إعدادًا يثبّته. لا أكتبه حقيقة قبل أن تؤكده.', 'The number comes from one log in §1, and I found no setting in `src/` that fixes it. I will not write it as fact until you confirm it.'),
      state: 'open',
    },
  ],
});

const generic = (key: string, path: string, base: string): Draft => ({
  docKey: key,
  path,
  base,
  state: 'open',
  before: '',
  insert: '',
  lines: [
    { t: 'hunk', text: '@@ end of file @@' },
    { t: 'add', text: '' },
    { t: 'add', text: '## Checked against the code' },
    { t: 'add', text: '' },
    { t: 'add', text: 'The steps above match the current code in the folder this doc describes.' },
    { t: 'add', text: 'No screen has changed since this was written.', flag: 'f1' },
  ],
  flags: [
    {
      id: 'f1',
      claim: l('«لم تتغير أي شاشة منذ كتابة هذا»', '"No screen has changed since this was written"'),
      why: l('قرأت الكود ولم أرَ الشاشات نفسها، فلا أستطيع التأكد من هذا.', 'I read the code but never saw the screens, so I cannot confirm this.'),
      state: 'open',
    },
  ],
});

const CONFLICT_DIFF: DiffLine[] = [
  { t: 'hunk', text: '@@ -61,1 +61,1 @@ ## 4. R1: Silent hold before charge' },
  { t: 'del', text: '  "onlyWhenDepartureWithinHours": 48,' },
  { t: 'add', text: '  "onlyWhenDepartureWithinHours": 72,' },
];

const saving = (d: Draft): Step[] => [
  stage('save', 'running'),
  { t: 'tool', name: 'mcp__hub__save_doc', detail: d.path, ms: 500, input: `{ "path": "${d.path}", "base": "${d.base}", "text": "…" }`, output: 'Saved. The earlier text is kept as a revision.', decision: 'rules' },
  { t: 'saved', docKey: d.docKey, path: d.path },
  stage('save', 'done', l('حُفظت، والنص السابق باقٍ مراجعة. لم يُلتزم في Git.', 'Saved, with the earlier text kept as a revision. Nothing was committed to Git.')),
  stage('link', 'running'),
  { t: 'end', usage: { input: 4200, output: 620, cacheRead: 31000 } },
  { t: 'links', docKey: d.docKey, keys: ['GTV-259', 'GTV-231'] },
];

const refused = (d: Draft): Step[] => [
  stage('save', 'running'),
  { t: 'tool', name: 'mcp__hub__save_doc', detail: d.path, ms: 500, input: `{ "path": "${d.path}", "base": "${d.base}", "text": "…" }`, error: `refused: base_out_of_date\nbase: ${d.base}\ncurrent: r4, saved 2 min ago`, decision: 'rules' },
  stage('save', 'failed', l('رُفض الحفظ: تغيّر الملف بعد أن بدأتُ المسودة. لم يُفقد شيء.', 'The save was refused: the file changed after I started the draft. Nothing was lost.')),
  { t: 'end', state: 'failed', usage: { input: 1800, output: 140, cacheRead: 31000 } },
  {
    t: 'choice',
    choice: {
      variant: 'conflict',
      title: l('تغيّر الملف من تحت المسودة', 'The file changed underneath this draft'),
      body: l('حفظ أحدهم نسخة أحدث قبل دقيقتين، فلم أكتب فوقها. هذا ما تغيّر:', 'Someone saved a newer version 2 minutes ago, so I did not write over it. This is what changed:'),
      path: d.path,
      diff: CONFLICT_DIFF,
      options: [
        { id: 'redraft', label: l('أعد المسودة على النص الجديد', 'Redraft on the new text'), tip: l('يقرأ Claude النسخة الأحدث ويعرض مسودة جديدة. لا يُحفظ شيء قبل موافقتك.', 'Claude reads the newer version and shows a new draft. Nothing is saved until you approve it.'), primary: true },
        { id: 'drop', label: l('تجاهل المسودة', 'Discard the draft'), tip: l('تبقى الوثيقة كما حفظها الآخر.', 'The doc stays as it was last saved.') },
      ],
    },
    branches: {
      redraft: [
        stage('save', 'pending'),
        stage('draft', 'running'),
        { t: 'tool', name: 'mcp__hub__get_doc', detail: d.path, ms: 400, input: `{ "path": "${d.path}" }`, output: 'Revision r4, 960 words.', decision: 'rules' },
        stage('draft', 'done', l('مسودة جديدة على النسخة r4.', 'A new draft on revision r4.')),
        { t: 'end', usage: { input: 3800, output: 520, cacheRead: 31000 } },
        { t: 'draft', draft: { ...d, base: 'r4' }, onSave: saving({ ...d, base: 'r4' }), onDiscard: discarded() },
      ],
      drop: discarded(),
    },
  },
];

function discarded(): Step[] {
  return [stage('draft', 'skipped'), stage('save', 'skipped'), stage('link', 'skipped'), { t: 'text', text: l('تركت الوثيقة كما هي، ولم يُحفظ شيء.', 'I left the doc as it is, and nothing was saved.') }, { t: 'end', usage: { input: 900, output: 60, cacheRead: 31000 } }];
}

const drafting = (d: Draft, conflict: boolean): Step[] => [
  stage('draft', 'running'),
  { t: 'tool', name: 'mcp__hub__get_doc', detail: d.path, ms: 400, input: `{ "path": "${d.path}" }`, output: `Revision ${d.base}, 960 words.`, decision: 'rules' },
  { t: 'tool', name: 'Grep', detail: 'preChargeHold src/', ms: 300, input: '{ "pattern": "preChargeHold", "path": "src/" }', output: 'src/payments/hold/pre-charge-hold.service.ts\nsrc/settings/flight-provider.settings.ts', decision: 'rules' },
  stage('draft', 'done', l('مسودة جاهزة، وعبارة واحدة لم أستطع التحقق منها.', 'The draft is ready, with one claim I could not verify.')),
  { t: 'end', usage: { input: 11200, output: 1460, cacheRead: 26000 } },
  { t: 'draft', draft: d, onSave: conflict ? refused(d) : saving(d), onDiscard: discarded() },
];

/** "Improve this doc". With `conflict`, the first save is refused because the file changed. */
export function improveDoc(key: string, path: string, cold: boolean, conflict: boolean): Step[] {
  const d = key === 'GTV-180' ? hold('r3') : generic(key, path, 'r2');
  return [
    ...opening(cold),
    { t: 'protocol', protocol: 'doc', target: path },
    stage('search', 'running'),
    { t: 'tool', name: 'mcp__hub__search_docs', detail: `"${path.split('/').pop()}"`, ms: 420, input: `{ "query": "${path}", "limit": 5 }`, output: `${path}\ndocs/05-flights-and-payments.md\ndocs/25-launch-readiness.md`, decision: 'rules' },
    { t: 'tool', name: 'mcp__hub__list_cards', detail: '{ "mentions": "hold" }', ms: 320, input: '{ "mentions": "hold", "status": "open" }', output: 'GTV-259\nGTV-231', decision: 'rules' },
    stage('search', 'done', l('3 وثائق قريبة، وهذه هي المكان الصحيح.', '3 nearby docs, and this one is the right home.')),
    stage('propose', 'running'),
    stage('propose', 'done', l('تحديث لا وثيقة جديدة.', 'An update, not a new doc.')),
    { t: 'end', usage: { input: 7400, output: 380, cacheRead: 22000 } },
    {
      t: 'choice',
      choice: {
        variant: 'proposal',
        title: l('أقترح تحديث هذه الوثيقة، لا كتابة جديدة', 'I suggest updating this doc, not writing a new one'),
        body: l('تذكر `GTV-259` ماذا يحدث حين لا تردّ البوابة، ولا تذكره الوثيقة. مكانه هنا، بعد إعدادات الإمساك، فلا حاجة إلى وثيقة أخرى.', '`GTV-259` says what happens when the gateway does not answer, and the doc does not. It belongs here, after the hold settings, so no other doc is needed.'),
        path,
        options: [
          { id: 'go', label: l('اكتب المسودة', 'Write the draft'), tip: l('يعرض Claude التغيير فرقًا مقابل النص الحالي. لا يُحفظ شيء بعد.', 'Claude shows the change as a diff against the current text. Nothing is saved yet.'), primary: true },
          { id: 'stop', label: l('ليس الآن', 'Not now'), tip: l('تبقى الوثيقة كما هي، وينتهي البروتوكول هنا.', 'The doc stays as it is, and the protocol ends here.') },
        ],
      },
      branches: { go: drafting(d, conflict), stop: discarded() },
    },
  ];
}

/** "Document this task". Search finds a similar doc, so the warning comes before any writing. */
export function documentTask(key: string, cold: boolean): Step[] {
  const d = hold('r3');
  const fresh: Draft = {
    ...d,
    docKey: '',
    path: `docs/28-${key.toLowerCase()}.md`,
    base: 'new',
    before: '',
    lines: [{ t: 'hunk', text: '@@ new file @@' }, { t: 'add', text: `# ${key}` }, ...HOLD_SECTION],
  };
  return [
    ...opening(cold),
    { t: 'protocol', protocol: 'doc', target: key },
    stage('search', 'running'),
    { t: 'tool', name: 'mcp__hub__get_card', detail: key, ms: 380, input: `{ "key": "${key}" }`, output: `{ "key": "${key}", "type": "task" }`, decision: 'rules' },
    { t: 'tool', name: 'mcp__hub__search_docs', detail: `"${key}"`, ms: 420, input: `{ "query": "${key}", "limit": 5 }`, output: 'docs/21-confirmation-safety.md  (similar: 0.82)\ndocs/05-flights-and-payments.md  (similar: 0.41)', decision: 'rules' },
    stage('search', 'done', l('وجدتُ وثيقة قريبة جدًا.', 'Found a very similar doc.')),
    stage('propose', 'running'),
    { t: 'end', usage: { input: 5200, output: 220, cacheRead: 22000 } },
    {
      t: 'choice',
      choice: {
        variant: 'duplicate',
        title: l('توجد وثيقة تغطي معظم هذا', 'A doc already covers most of this'),
        body: l('`docs/21-confirmation-safety.md` تشرح الموضوع نفسه. وثيقة ثانية ستختلف عنها مع الوقت، فأنصح بتحديثها.', '`docs/21-confirmation-safety.md` explains the same subject. A second doc would drift from it over time, so I suggest updating it.'),
        path: 'docs/21-confirmation-safety.md',
        options: [
          { id: 'update', label: l('حدّث الموجودة', 'Update the existing doc'), tip: l('يكتب Claude مسودة على `docs/21-confirmation-safety.md`، ولا يُنشئ ملفًا.', 'Claude drafts on `docs/21-confirmation-safety.md` and creates no file.'), primary: true },
          { id: 'new', label: l('وثيقة جديدة رغم ذلك', 'Write a new doc anyway'), tip: l('يبدأ ملفًا جديدًا. يبقى التحذير مسجلًا في المحادثة.', 'It starts a new file. The warning stays on record in this chat.') },
        ],
      },
      branches: {
        update: [stage('propose', 'done', l('تحديث الوثيقة الموجودة.', 'Update the existing doc.')), ...drafting(d, false)],
        new: [stage('propose', 'done', l('وثيقة جديدة بطلبك رغم وجود مشابهة.', 'A new doc at your request, despite a similar one.')), ...drafting(fresh, false)],
      },
    },
  ];
}

export const GAPS: GapReport = {
  scope: l('قارنتُ 34 بطاقة مفتوحة و`src/payments/` مع 62 وثيقة.', 'I compared 34 open cards and `src/payments/` with 62 docs.'),
  notChecked: l('لم أقرأ بقية `src/`، ولا الوثائق غير المفهرسة.', 'I did not read the rest of `src/`, or any doc that is not indexed.'),
  gaps: [
    { id: 'g1', kind: 'missing', topic: l('ماذا يحدث حين لا ترد بوابة الدفع', 'What happens when the gateway does not answer'), why: l('تذكره بطاقة ويعالجه الكود، ولا تذكره أي وثيقة.', 'A card mentions it and the code handles it, but no doc does.'), cards: ['GTV-259'], paths: ['src/payments/paytr/paytr.adapter.ts'] },
    { id: 'g2', kind: 'missing', topic: l('منع تكرار إشعارات الدفع', 'Ignoring repeated payment notices'), why: l('في الكود فقط. إن تغيّر لن يعرف أحد القاعدة.', 'Only in the code. If it changes, nobody will know the rule.'), cards: [], paths: ['src/payments/paytr/paytr.webhook.ts'] },
    { id: 'g3', kind: 'stale', topic: l('وثيقة 17: معالج حجز الوكلاء', 'Doc 17: agent booking wizard'), why: l('آخر تحديث قبل تغيّر خطوتين في الكود، وتقول البطاقة إن الوثيقة قديمة.', 'Last updated before two steps changed in the code, and a card says the doc is stale.'), cards: ['GTV-276'], paths: ['docs/17-admin-agent-booking.md'] },
  ],
};

export const gapsScript = (cold: boolean): Step[] => [
  ...opening(cold),
  { t: 'tool', name: 'mcp__hub__search_docs', detail: '{ "all": true }', ms: 500, input: '{ "all": true, "fields": ["path", "headings"] }', output: '62 docs indexed.', decision: 'rules' },
  { t: 'tool', name: 'mcp__hub__list_cards', detail: '{ "status": "open" }', ms: 400, input: '{ "status": "open" }', output: '34 cards.', decision: 'rules' },
  { t: 'tool', name: 'Grep', detail: 'payments src/', ms: 450, input: '{ "pattern": "webhook|hold|void", "path": "src/payments" }', output: '41 matches in 9 files.', decision: 'rules' },
  { t: 'gaps', report: GAPS },
  { t: 'end', usage: { input: 14200, output: 980, cacheRead: 30000 } },
];

export type { Report };

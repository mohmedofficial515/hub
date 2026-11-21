import type { ChangedFile, DiffLine, DocDuplicate, Draft, GapReport, L, Step } from './mock';

/**
 * The two protocols of docs/16 §7.1 and the structured results of §7.2 as scripted turns. Tool names follow what is built or specified: `get_card`, `search_docs`, `start_task`,
 * `report_stage`, `save_doc`, and §7.2's `report_work`, `propose_plan` and `propose_doc`.
 */
const l = (ar: string, en: string): L => ({ ar, en });
const opening = (cold: boolean): Step[] => (cold ? [{ t: 'starting' }, { t: 'thinking', ms: 400 }] : [{ t: 'thinking', ms: 500 }]);
const stage = (id: Extract<Step, { t: 'stage' }>['id'], state: Extract<Step, { t: 'stage' }>['state'], note?: L): Step => ({ t: 'stage', id, state, note });

// ── Task execution protocol ─────────────────────────────────────────────────────────────────────

const filesFor = (folder: string): ChangedFile[] => {
  if (folder.endsWith('backend')) {
    return [
      {
        path: 'src/wallet/wallet-topup.controller.ts',
        source: 'tool',
        additions: 9,
        deletions: 2,
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
        source: 'tool',
        additions: 31,
        deletions: 0,
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
      source: 'tool',
      additions: 46,
      deletions: 28,
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
      source: 'tool',
      additions: 6,
      deletions: 2,
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
const fileFacts = (files: ChangedFile[]) => files.map(({ path, source, additions, deletions }) => ({ path, source, additions, deletions }));

const report = (name: string): Step => ({ t: 'tool', name: 'mcp__hub__report_stage', detail: name, ms: 90, input: `{ "protocol": "work", "stage": "${name}", "state": "done" }`, output: 'Recorded.', decision: 'config' });

const understand = (key: string): Step[] => [
  stage('understand', 'running'),
  { t: 'tool', name: 'mcp__hub__get_card', detail: key, ms: 420, input: `{ "key": "${key}" }`, output: `{ "key": "${key}", "type": "task", "acceptance": "3 items", "links": 1, "docs": 1 }`, decision: 'config' },
  { t: 'tool', name: 'mcp__hub__search_docs', detail: `"${key}"`, ms: 360, input: `{ "query": "${key}", "limit": 5 }`, output: 'docs/api-integration/README.md\ndocs/21-confirmation-safety.md', decision: 'config' },
  { t: 'tool', name: 'mcp__hub__start_task', detail: key, ms: 180, input: `{ "key": "${key}" }`, output: `${key} is now in progress.`, decision: 'config' },
  { t: 'started', key },
  stage('understand', 'done', l('قرأت البطاقة وشروط قبولها ووثيقتين مرتبطتين، وبدأت المهمة.', 'Read the card, its acceptance items and two linked docs, and started the task.')),
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
      result: l(`+${f.additions} −${f.deletions}`, `+${f.additions} −${f.deletions}`),
      input: `{ "file_path": "${f.path}", "old_string": "…", "new_string": "…" }`,
      output: 'The file was updated.',
      file: f,
      decision: 'config',
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
const E2E_FAIL = 'FAIL test/e2e/bookings.e2e-spec.ts\n  x lists a booking on a narrow row\n\nTests: 1 failed, 8 passed, 9 total';
const LINT_OK = 'Checked 214 files, no problems.';

const bash = (command: string, ms: number, output: string, result?: L, error?: boolean): Step => ({ t: 'tool', name: 'Bash', detail: command, ms, result, input: `{ "command": "${command}" }`, ...(error ? { error: output } : { output }), decision: 'config' });

const NOT_CHECKED: L[] = [l('الشكل في متصفح حقيقي.', 'How it looks in a real browser.'), l('الأجهزة الأخرى.', 'Other devices.')];

const reporting = (key: string, checks: number): Step[] => [stage('report', 'running'), { t: 'tool', name: 'mcp__hub__report_work', detail: key, ms: 380, input: `{ "card": "${key}", "summary": "…", "checks": [${checks} items], "notChecked": [2 items] }`, output: 'Stored as evidence on the card.', decision: 'config' }];

const passedChecks = [
  { name: 'typecheck', command: 'pnpm typecheck', outcome: 'passed' as const },
  { name: 'test', command: 'pnpm test', outcome: 'passed' as const },
  { name: 'lint', command: 'pnpm lint', outcome: 'passed' as const },
];

const verifyAll = (): Step[] => [bash('pnpm typecheck', 700, TYPECHECK_OK, l('لا أخطاء', '0 errors')), bash('pnpm test', 800, TESTS_OK, l('15 ناجحًا', '15 passing')), bash('pnpm lint', 420, LINT_OK, l('سليم', 'Clean'))];

export function taskScript(key: string, folder: string, cold: boolean, fail: boolean): Step[] {
  const files = filesFor(folder);
  const head: Step[] = [...opening(cold), { t: 'protocol', protocol: 'task', target: key }, ...understand(key), ...plan(), ...execute(files), stage('verify', 'running')];
  if (!fail) {
    return [
      ...head,
      ...verifyAll(),
      stage('verify', 'done', l('3 من 3 فحوص نجحت.', '3 of 3 checks passed.')),
      ...reporting(key, 3),
      {
        t: 'report',
        report: {
          card: key,
          summary: l('أنجزت ما تطلبه البطاقة، وكل الفحوص نجحت. لا شيء مرفوع، والتغييرات في المجلد بانتظارك.', 'Did what the card asks, and every check passes. Nothing is pushed, and the changes wait for you in the folder.'),
          checks: passedChecks,
          changedFiles: fileFacts(files),
          notChecked: NOT_CHECKED,
        },
      },
      stage('report', 'done'),
      { t: 'end', usage: { input: 24600, output: 3880, cacheRead: 61200 } },
    ];
  }
  // As the skill is built: a failed check stops at Verify, says what failed, and asks with `AskUserQuestion`. The report comes after the answer, and its runs keep the failure either way.
  return [
    ...head,
    bash('pnpm typecheck', 700, TYPECHECK_OK, l('لا أخطاء', '0 errors')),
    bash('pnpm test', 800, TESTS_FAIL, undefined, true),
    stage('verify', 'failed', l('فحص واحد فشل: `pnpm test`. توقفت هنا، و`pnpm lint` لم يبدأ.', 'One check failed: `pnpm test`. I stopped here, and `pnpm lint` never ran.')),
    {
      t: 'text',
      text: l(
        'اختبار `table.test.tsx` يتوقع الارتفاع القديم، فإما الاختبار خطأ أو التغيير، ولا أحسم ذلك وحدي. النتيجة الكاملة في الخطوة المفتوحة أعلاه.',
        '`table.test.tsx` expects the old height, so either the test or the change is wrong, and I will not settle that alone. The full output is in the step above.',
      ),
    },
    { t: 'end', state: 'failed', usage: { input: 22100, output: 2960, cacheRead: 58400 } },
    {
      t: 'question',
      question: {
        variant: 'verify',
        multiSelect: false,
        header: l('فشل فحص، فالمهمة لم تكتمل', 'A check failed, so the task is not finished'),
        text: l('هل أصلح وأعيد الفحوص، أم أكتب التقرير كما هو؟ يبقى الفشل في التقرير في الحالتين.', 'Should I fix it and run the checks again, or report it as it stands? The failure stays in the report either way.'),
        options: [
          { id: 'fix', label: l('أصلح وأعد الفحوص', 'Fix and run the checks again'), description: l('يعدّل Claude ويعيد الفحوص الثلاثة. يبقى هذا الفشل في تاريخ الفحص.', 'Claude edits, then runs all three checks again. This failure stays in the check’s history.'), primary: true },
          { id: 'report', label: l('اكتب التقرير كما هو', 'Report it as it stands'), description: l('يصل تقرير بالفحص الفاشل إلى البطاقة، وتبقى قيد العمل. التغييرات تبقى في المجلد.', 'A report with the failed check reaches the card, and it stays in progress. The changes stay in the folder.') },
        ],
      },
      branches: {
        fix: [
          stage('verify', 'running', l('إعادة الفحوص الثلاثة بعد الإصلاح.', 'Running all three checks again after the fix.')),
          { t: 'tool', name: 'Edit', detail: 'src/components/ui/table.tsx', ms: 500, result: l('+1 −1', '+1 −1'), input: '{ "file_path": "src/components/ui/table.tsx", "old_string": "density = \'dense\'", "new_string": "density = \'comfortable\'" }', output: 'The file was updated.', decision: 'config' },
          ...verifyAll(),
          stage('verify', 'done', l('فشل مرة، ونجح في المرة الثانية: 3 من 3.', 'Failed once, passed on the 2nd run: 3 of 3.')),
          ...reporting(key, 3),
          {
            t: 'report',
            report: {
              card: key,
              summary: l('أصلحت الخطأ في القيمة الافتراضية للكثافة، وكل الفحوص نجحت. لا شيء مرفوع.', 'Fixed the wrong default density, and every check passes. Nothing is pushed.'),
              checks: passedChecks,
              changedFiles: fileFacts(files),
              notChecked: NOT_CHECKED,
            },
          },
          stage('report', 'done'),
          { t: 'end', usage: { input: 9100, output: 1240, cacheRead: 64800 } },
        ],
        report: [
          ...reporting(key, 3),
          {
            t: 'report',
            report: {
              card: key,
              summary: l('توقف العمل عند التحقق. التغييرات في المجلد، وفحص واحد يفشل.', 'Work stopped at Verify. The changes are in the folder, and one check fails.'),
              checks: [
                { name: 'typecheck', command: 'pnpm typecheck', outcome: 'passed' },
                { name: 'test', command: 'pnpm test', outcome: 'failed' },
                { name: 'lint', command: 'pnpm lint', outcome: 'skipped', note: l('لم يبدأ لأن الاختبارات فشلت.', 'Never started, because the tests failed.') },
              ],
              changedFiles: fileFacts(files),
              notChecked: NOT_CHECKED,
            },
          },
          stage('report', 'done'),
          { t: 'end', usage: { input: 3100, output: 410, cacheRead: 58400 } },
        ],
      },
    },
  ];
}

const baseTask = (key: string, folder: string, cold: boolean): Step[] => [...opening(cold), { t: 'protocol', protocol: 'task', target: key }, ...understand(key), ...plan(), ...execute(filesFor(folder)), stage('verify', 'running')];

/** A report whose words go further than its steps: one check with no step behind it. The server keeps it as claimed, and the task stays. */
export function taskClaimedScript(key: string, folder: string, cold: boolean): Step[] {
  return [
    ...baseTask(key, folder, cold),
    bash('pnpm typecheck', 700, TYPECHECK_OK, l('لا أخطاء', '0 errors')),
    bash('pnpm test', 800, TESTS_OK, l('15 ناجحًا', '15 passing')),
    stage('verify', 'done', l('يقول Claude إن الفحوص نجحت.', 'Claude says the checks passed.')),
    ...reporting(key, 3),
    {
      t: 'report',
      report: {
        card: key,
        summary: l('أنجزت ما تطلبه البطاقة وكل الفحوص ناجحة.', 'Did what the card asks, and every check passes.'),
        checks: passedChecks,
        changedFiles: fileFacts(filesFor(folder)),
        notChecked: [],
      },
    },
    stage('report', 'done'),
    { t: 'end', usage: { input: 21000, output: 2400, cacheRead: 52000 } },
  ];
}

/** A report that says a failed step passed. The server refuses all of it, nothing reaches the card, and Claude has to correct it (docs/16 §7.2 as built). */
export function taskRefusedScript(key: string, folder: string, cold: boolean): Step[] {
  const checks = (e2e: 'passed' | 'failed') => [
    { name: 'typecheck', command: 'pnpm typecheck', outcome: 'passed' as const },
    { name: 'e2e', command: 'pnpm test:e2e bookings', outcome: e2e },
  ];
  return [
    ...baseTask(key, folder, cold),
    bash('pnpm typecheck', 700, TYPECHECK_OK, l('لا أخطاء', '0 errors')),
    bash('pnpm test:e2e bookings', 800, E2E_FAIL, undefined, true),
    stage('verify', 'done', l('يقول Claude إن الفحوص نجحت.', 'Claude says the checks passed.')),
    ...reporting(key, 2),
    { t: 'report', report: { card: key, summary: l('أنجزت ما تطلبه البطاقة وكل الفحوص ناجحة.', 'Did what the card asks, and every check passes.'), checks: checks('passed'), changedFiles: fileFacts(filesFor(folder)), notChecked: [] } },
    { t: 'thinking', ms: 500 },
    ...reporting(key, 2),
    { t: 'report', report: { card: key, summary: l('صححت التقرير: اختبار e2e يفشل، والمهمة لم تكتمل.', 'I corrected the report: the e2e test fails, and the task is not finished.'), checks: checks('failed'), changedFiles: fileFacts(filesFor(folder)), notChecked: [] } },
    stage('report', 'done'),
    { t: 'end', usage: { input: 21000, output: 2400, cacheRead: 52000 } },
  ];
}

// ── Document development protocol ───────────────────────────────────────────────────────────────

const HOLD_SECTION: DiffLine[] = [
  { t: 'add', text: '' },
  { t: 'add', text: '### 4.4 When the hold gets no answer' },
  { t: 'add', text: '' },
  { t: 'add', text: 'A hold with no answer counts as refused, so no money moves. The customer sees the same message as for a refused seat.' },
  { t: 'add', text: 'The hold gives up after 10.5 s.', flag: 'c2' },
  { t: 'add', text: '' },
];

const hold = (baseVersion: string): Draft => ({
  docKey: 'GTV-180',
  source: 'backend',
  path: 'docs/21-confirmation-safety.md',
  title: l('الإمساك حين لا يصل رد', 'A hold that gets no answer'),
  reason: l('تذكر `GTV-259` ماذا يحدث حين لا تردّ البوابة، ولا تذكره الوثيقة. رقم الـ10.5 ثانية من سجل واحد في القسم 1، ولم أجد في `src/` إعدادًا يثبّته.', '`GTV-259` says what happens when the gateway does not answer, and the doc does not. The 10.5 s comes from one log in §1, and I found no setting in `src/` that fixes it.'),
  baseVersion,
  duplicates: [],
  status: 'open',
  refusedCode: null,
  savedVersion: null,
  before: '## 5. R2: Customer chooses the refund destination',
  lines: [
    { t: 'hunk', text: '@@ -58,4 +58,10 @@ ## 4. R1: Silent hold before charge' },
    { t: 'ctx', text: '  "excludeAirlines": ["ZZ"]' },
    { t: 'ctx', text: '}' },
    { t: 'ctx', text: '```' },
    ...HOLD_SECTION,
    { t: 'ctx', text: '## 5. R2: Customer chooses the refund destination' },
  ],
  claims: [
    { id: 'c1', text: l('«الإمساك بلا رد يُعد مرفوضًا، فلا يتحرك مال»', '"A hold with no answer counts as refused, so no money moves"'), status: 'verified', source: 'src/payments/hold/pre-charge-hold.service.ts', answer: null },
    { id: 'c2', text: l('«تتوقف محاولة الإمساك بعد 10.5 ثانية»', '"The hold gives up after 10.5 s"'), status: 'unverified', source: null, answer: null },
  ],
});

const generic = (docKey: string | null, path: string, baseVersion: string): Draft => ({
  docKey,
  source: 'backend',
  path,
  title: l('فحص الوثيقة مقابل الكود', 'Checking the doc against the code'),
  reason: l('لم تُفحص هذه الوثيقة مقابل الكود الحالي منذ آخر تغيير. قرأت الكود ولم أرَ الشاشات نفسها.', 'This doc has not been checked against the current code since the last change. I read the code, and never saw the screens.'),
  baseVersion,
  duplicates: [],
  status: 'open',
  refusedCode: null,
  savedVersion: null,
  before: '',
  lines: [
    { t: 'hunk', text: '@@ end of file @@' },
    { t: 'add', text: '' },
    { t: 'add', text: '## Checked against the code' },
    { t: 'add', text: '' },
    { t: 'add', text: 'The steps above match the current code in the folder this doc describes.' },
    { t: 'add', text: 'No screen has changed since this was written.', flag: 'c1' },
  ],
  claims: [{ id: 'c1', text: l('«لم تتغير أي شاشة منذ كتابة هذا»', '"No screen has changed since this was written"'), status: 'unverified', source: null, answer: null }],
});

const ARABIC_DOC_PATH = 'docs/ar/21-confirmation-safety.md';

const arabicDraft = (): Draft => ({
  docKey: null,
  source: 'backend',
  path: ARABIC_DOC_PATH,
  title: l('الإمساك حين لا يصل رد', 'A hold that gets no answer'),
  reason: l('النسخة العربية لا تذكر ما يحدث حين لا تردّ البوابة. رقم الـ10.5 ثانية من سجل واحد، ولم أجد إعدادًا يثبّته في `src/`.', 'The Arabic version does not say what happens when the gateway does not answer. The 10.5 s comes from one log, and I found no setting in `src/` that fixes it.'),
  baseVersion: 'a41f9c2',
  duplicates: [],
  status: 'open',
  refusedCode: null,
  savedVersion: null,
  before: '',
  lines: [
    { t: 'hunk', text: '@@ -58,3 +58,8 @@ ## 4. الإمساك الصامت قبل الخصم' },
    { t: 'ctx', text: 'يُمسك المبلغ قبل تأكيد المقعد، ولا يُخصم شيء قبل ذلك.' },
    { t: 'del', text: 'إن تأخر الرد يُعاد الطلب مرة واحدة.' },
    { t: 'add', text: '### 4.4 حين لا يصل رد' },
    { t: 'add', text: 'الإمساك بلا رد يُعد مرفوضًا، فلا يتحرك مال، ويرى العميل رسالة المقعد المرفوض نفسها.' },
    { t: 'add', text: 'تتوقف المحاولة بعد 10.5 ثانية، حسب الإعداد preChargeHold.timeout.', flag: 'c2' },
    { t: 'add', text: 'See `pre-charge-hold.service.ts` for the code path.' },
    { t: 'ctx', text: '## 5. يختار العميل وجهة الاسترداد' },
  ],
  claims: [
    { id: 'c1', text: l('«الإمساك بلا رد يُعد مرفوضًا»', '"A hold with no answer counts as refused"'), status: 'verified', source: 'src/payments/hold/pre-charge-hold.service.ts', answer: null },
    { id: 'c2', text: l('«تتوقف المحاولة بعد 10.5 ثانية»', '"The attempt stops after 10.5 s"'), status: 'unverified', source: null, answer: null },
  ],
});

const CONFLICT_DIFF: DiffLine[] = [
  { t: 'hunk', text: '@@ -61,1 +61,1 @@ ## 4. R1: Silent hold before charge' },
  { t: 'del', text: '  "onlyWhenDepartureWithinHours": 48,' },
  { t: 'add', text: '  "onlyWhenDepartureWithinHours": 72,' },
];

const saveInput = () => '{ "draft": "…" }';

const saving = (d: Draft): Step[] => [
  stage('save', 'running'),
  { t: 'tool', name: 'mcp__hub__save_doc', detail: d.path ?? '', ms: 500, input: saveInput(), output: 'Saved. The earlier text is kept as a revision.', decision: 'user_temporary' },
  { t: 'draftState', status: 'saved', savedVersion: 'e7a10c4' },
  { t: 'saved', doc: d.docKey ?? '', path: d.path ?? '' },
  stage('save', 'done', l('حُفظت، والنص السابق باقٍ مراجعة. لم يُلتزم في Git.', 'Saved, with the earlier text kept as a revision. Nothing was committed to Git.')),
  stage('link', 'running'),
  { t: 'end', usage: { input: 4200, output: 620, cacheRead: 31000 } },
  { t: 'links', doc: d.docKey ?? '', keys: ['GTV-259', 'GTV-231'] },
];

const refused = (d: Draft): Step[] => [
  stage('save', 'running'),
  { t: 'tool', name: 'mcp__hub__save_doc', detail: d.path ?? '', ms: 500, input: saveInput(), error: `hub.docs.stale_base\nbaseVersion: ${d.baseVersion}\ncurrent: 7bd02ee, saved 2 min ago`, decision: 'user_temporary' },
  { t: 'draftState', status: 'refused', refusedCode: 'hub.docs.stale_base' },
  stage('save', 'failed', l('رُفض الحفظ: تغيّر الملف بعد أن بدأتُ المسودة. لم يُكتب شيء.', 'The save was refused: the file changed after I started the draft. Nothing was written.')),
  { t: 'end', state: 'failed', usage: { input: 1800, output: 140, cacheRead: 31000 } },
  {
    t: 'question',
    question: {
      variant: 'conflict',
      multiSelect: false,
      header: l('تغيّر الملف من تحت المسودة', 'The file changed underneath this draft'),
      text: l('لم أكتب فوق النسخة الأحدث. هذا ما تغيّر:', 'I did not write over the newer version. This is what changed:'),
      changedOn: l('تغيّر على القرص أو من جهاز آخر قبل دقيقتين. لا يذكر Hub من أين.', 'It changed on disk or from another device 2 minutes ago. Hub does not say which.'),
      path: d.path ?? undefined,
      diff: CONFLICT_DIFF,
      options: [
        { id: 'redraft', label: l('أعد المسودة على النص الجديد', 'Redraft on the new text'), description: l('يقرأ Claude النسخة الأحدث ويعرض مسودة جديدة، وتبقى إجاباتك على العبارات نفسها. لا يُحفظ شيء قبل موافقتك.', 'Claude reads the newer version and shows a new draft, and your answers on the same claims stay. Nothing is saved until you approve it.'), primary: true },
        { id: 'drop', label: l('تجاهل المسودة', 'Discard the draft'), description: l('تبقى الوثيقة كما هي على القرص.', 'The doc stays as it is on disk.') },
      ],
    },
    branches: {
      redraft: [
        stage('save', 'pending'),
        stage('draft', 'running'),
        { t: 'tool', name: 'mcp__hub__get_doc', detail: d.path ?? '', ms: 400, input: `{ "key": "${d.docKey}" }`, output: 'Version 7bd02ee, 960 words.', decision: 'config' },
        { t: 'tool', name: 'mcp__hub__propose_doc', detail: d.path ?? '', ms: 240, input: `{ "doc": "${d.docKey}", "baseVersion": "7bd02ee", "draft": "…", "claims": [2 items] }`, output: 'Draft shown to the owner.', decision: 'config' },
        stage('draft', 'done', l('مسودة جديدة على النسخة 7bd02ee.', 'A new draft on version 7bd02ee.')),
        { t: 'end', usage: { input: 3800, output: 520, cacheRead: 31000 } },
        { t: 'draft', draft: { ...d, baseVersion: '7bd02ee' }, onSave: saving({ ...d, baseVersion: '7bd02ee' }), onDiscard: discarded() },
      ],
      drop: discarded(),
    },
  },
];

function discarded(): Step[] {
  return [stage('draft', 'skipped'), stage('save', 'skipped'), stage('link', 'skipped'), { t: 'text', text: l('تركت الوثيقة كما هي، ولم يُحفظ شيء.', 'I left the doc as it is, and nothing was saved.') }, { t: 'end', usage: { input: 900, output: 60, cacheRead: 31000 } }];
}

const drafting = (d: Draft, conflict: boolean, onUpdate?: Step[]): Step[] => [
  stage('draft', 'running'),
  { t: 'tool', name: 'mcp__hub__get_doc', detail: d.path ?? '', ms: 400, input: `{ "key": "${d.docKey ?? d.path}" }`, output: `Version ${d.baseVersion}, 960 words.`, decision: 'config' },
  { t: 'tool', name: 'Grep', detail: 'preChargeHold src/', ms: 300, input: '{ "pattern": "preChargeHold", "path": "src/" }', output: 'src/payments/hold/pre-charge-hold.service.ts\nsrc/settings/flight-provider.settings.ts', decision: 'config' },
  { t: 'tool', name: 'mcp__hub__propose_doc', detail: d.path ?? '', ms: 240, input: `{ "doc": "${d.docKey ?? ''}", "title": "…", "baseVersion": "${d.baseVersion ?? ''}", "draft": "…", "claims": [${d.claims.length} items] }`, output: 'Draft shown to the owner.', decision: 'config' },
  stage('draft', 'done', l('مسودة جاهزة، وعبارة واحدة لم أستطع التحقق منها.', 'The draft is ready, with one claim I could not verify.')),
  { t: 'end', usage: { input: 11200, output: 1460, cacheRead: 26000 } },
  { t: 'draft', draft: d, onSave: conflict ? refused(d) : saving(d), onDiscard: discarded(), onUpdate },
];

const NEARBY: DocDuplicate[] = [
  { key: 'GTV-180', title: l('أمان التأكيد', 'Confirmation safety'), source: 'backend', path: 'docs/21-confirmation-safety.md', url: '/docs?doc=GTV-180', overlap: l('تشرح الإمساك قبل الخصم والمقعد المرفوض.', 'Explains the hold before charge and the refused seat.') },
];

/** "Improve this doc". With `conflict`, the first save is refused because the file changed. */
export function improveDoc(key: string, path: string, cold: boolean, conflict: boolean): Step[] {
  const d = key === 'GTV-180' ? hold('c81e0a7') : generic(key || null, path, 'e0d41b9');
  return [
    ...opening(cold),
    { t: 'protocol', protocol: 'doc', target: path },
    stage('search', 'running'),
    { t: 'tool', name: 'mcp__hub__search_docs', detail: `"${path.split('/').pop()}"`, ms: 420, input: `{ "query": "${path}", "limit": 5 }`, output: `${path}\ndocs/05-flights-and-payments.md\ndocs/25-launch-readiness.md`, decision: 'config' },
    { t: 'tool', name: 'mcp__hub__list_cards', detail: '{ "mentions": "hold" }', ms: 320, input: '{ "mentions": "hold", "status": "open" }', output: 'GTV-259\nGTV-231', decision: 'config' },
    stage('search', 'done', l('3 وثائق قريبة، وهذه هي المكان الصحيح.', '3 nearby docs, and this one is the right home.')),
    stage('propose', 'running'),
    stage('propose', 'done', l('تحديث لا وثيقة جديدة.', 'An update, not a new doc.')),
    { t: 'end', usage: { input: 7400, output: 380, cacheRead: 22000 } },
    {
      t: 'question',
      question: {
        variant: 'proposal',
        multiSelect: false,
        header: l('أقترح تحديث هذه الوثيقة، لا كتابة جديدة', 'I suggest updating this doc, not writing a new one'),
        text: l('تذكر `GTV-259` ماذا يحدث حين لا تردّ البوابة، ولا تذكره الوثيقة. مكانه هنا، بعد إعدادات الإمساك، فلا حاجة إلى وثيقة أخرى.', '`GTV-259` says what happens when the gateway does not answer, and the doc does not. It belongs here, after the hold settings, so no other doc is needed.'),
        path,
        options: [
          { id: 'go', label: l('اكتب المسودة', 'Write the draft'), description: l('يعرض Claude التغيير فرقًا مقابل النص الحالي. لا يُحفظ شيء بعد.', 'Claude shows the change as a diff against the current text. Nothing is saved yet.'), primary: true },
          { id: 'stop', label: l('ليس الآن', 'Not now'), description: l('تبقى الوثيقة كما هي، وينتهي البروتوكول هنا.', 'The doc stays as it is, and the protocol ends here.') },
        ],
      },
      branches: { go: drafting(d, conflict), stop: discarded() },
    },
  ];
}

/** An Arabic document, so the diff has to read and review in Arabic (review B5). */
export function improveArabicDoc(cold: boolean): Step[] {
  const d = arabicDraft();
  return [...opening(cold), { t: 'protocol', protocol: 'doc', target: d.path ?? '' }, stage('search', 'running'), { t: 'tool', name: 'mcp__hub__search_docs', detail: '"21-confirmation-safety"', ms: 320, input: `{ "query": "${d.path}", "limit": 5 }`, output: `${d.path}\ndocs/21-confirmation-safety.md`, decision: 'config' }, stage('search', 'done', l('وجدتُ النسخة العربية وأصلها الإنجليزي.', 'Found the Arabic version and its English source.')), stage('propose', 'done', l('تحديث النسخة العربية.', 'Update the Arabic version.')), ...drafting(d, false)];
}

/**
 * "Document this task". Claude proposes a new file, and the server's check answers with a duplicate on the draft itself (`doc.draft`, `duplicates`), so the warning is what the owner reads first. Updating the
 * existing doc is the filled answer, and saving a second one says "anyway".
 */
export function documentTask(key: string, cold: boolean): Step[] {
  const existing = hold('c81e0a7');
  const fresh: Draft = {
    ...existing,
    docKey: null,
    path: `docs/28-${key.toLowerCase()}.md`,
    baseVersion: null,
    duplicates: NEARBY,
    before: '',
    lines: [{ t: 'hunk', text: '@@ new file @@' }, { t: 'add', text: `# ${key}` }, ...HOLD_SECTION],
  };
  return [
    ...opening(cold),
    { t: 'protocol', protocol: 'doc', target: key },
    stage('search', 'running'),
    { t: 'tool', name: 'mcp__hub__get_card', detail: key, ms: 380, input: `{ "key": "${key}" }`, output: `{ "key": "${key}", "type": "task" }`, decision: 'config' },
    { t: 'tool', name: 'mcp__hub__search_docs', detail: `"${key}"`, ms: 420, input: `{ "query": "${key}", "limit": 5 }`, output: 'docs/05-flights-and-payments.md', decision: 'config' },
    stage('search', 'done', l('لم أجد مكانًا واضحًا له بالبحث.', 'Search found no clear home for it.')),
    stage('propose', 'done', l('وثيقة جديدة.', 'A new doc.')),
    ...drafting(fresh, false, [stage('propose', 'done', l('تحديث الوثيقة الموجودة، كما حذّر Hub.', 'Update the existing doc, as Hub warned.')), ...drafting(existing, false)]),
  ];
}

export const GAPS: GapReport = {
  scope: l('قارنتُ 34 بطاقة مفتوحة و`src/payments/` مع 62 وثيقة.', 'I compared 34 open cards and `src/payments/` with 62 docs.'),
  notChecked: l('لم أقرأ بقية `src/`، ولا الوثائق غير المفهرسة، فما لم يُذكر هنا لم يُفحص كله.', 'I did not read the rest of `src/`, or any doc that is not indexed, so what is not listed here was not all checked.'),
  gaps: [
    { id: 'g1', kind: 'missing', topic: l('ماذا يحدث حين لا ترد بوابة الدفع', 'What happens when the gateway does not answer'), why: l('تذكره بطاقة ويعالجه الكود، ولا تذكره أي وثيقة.', 'A card mentions it and the code handles it, but no doc does.'), cards: ['GTV-259'], paths: ['src/payments/paytr/paytr.adapter.ts'], doc: { key: 'GTV-180', path: 'docs/21-confirmation-safety.md' } },
    { id: 'g2', kind: 'missing', topic: l('منع تكرار إشعارات الدفع', 'Ignoring repeated payment notices'), why: l('في الكود فقط. إن تغيّر لن يعرف أحد القاعدة.', 'Only in the code. If it changes, nobody will know the rule.'), cards: [], paths: ['src/payments/paytr/paytr.webhook.ts'], doc: { key: '', path: 'docs/05-flights-and-payments.md' } },
    { id: 'g3', kind: 'stale', topic: l('وثيقة 17: معالج حجز الوكلاء', 'Doc 17: agent booking wizard'), why: l('آخر تحديث قبل تغيّر خطوتين في الكود، وتقول البطاقة إن الوثيقة قديمة.', 'Last updated before two steps changed in the code, and a card says the doc is stale.'), cards: ['GTV-276'], paths: ['docs/17-admin-agent-booking.md'], doc: { key: '', path: 'docs/17-admin-agent-booking.md' } },
  ],
};

export const gapsScript = (cold: boolean): Step[] => [
  ...opening(cold),
  { t: 'tool', name: 'mcp__hub__search_docs', detail: '{ "all": true }', ms: 500, input: '{ "all": true, "fields": ["path", "headings"] }', output: '62 docs indexed.', decision: 'config' },
  { t: 'tool', name: 'mcp__hub__list_cards', detail: '{ "status": "open" }', ms: 400, input: '{ "status": "open" }', output: '34 cards.', decision: 'config' },
  { t: 'tool', name: 'Grep', detail: 'payments src/', ms: 450, input: '{ "pattern": "webhook|hold|void", "path": "src/payments" }', output: '41 matches in 9 files.', decision: 'config' },
  { t: 'gaps', report: GAPS },
  { t: 'end', usage: { input: 14200, output: 980, cacheRead: 30000 } },
];

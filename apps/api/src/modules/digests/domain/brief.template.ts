/**
 * @file Brief and weekly summary as Markdown (docs/07 §6.1, §6.2). Typed functions with golden files, like the card
 * templates: no model is called (D06), and a missing field fails the type check.
 */
import type { BriefCard, BriefSections, WeeklySections } from '@hub/contracts';

type Locale = 'ar' | 'en';

const TEXT = {
  en: {
    title: 'Your morning brief',
    awaiting: 'Awaiting you',
    awaitingEmpty: 'Nothing is waiting for you.',
    decide: 'Decide',
    need: 'Need',
    handoff: 'Handoff',
    review: 'Review',
    due: 'due',
    deadlines: 'Deadlines',
    overdue: 'overdue',
    escalated: 'escalated',
    changes: 'What changed since your last brief',
    commits: 'commits by',
    sessionBy: 'session by',
    newHandoff: 'New handoff',
    decided: 'Decided',
    ready: 'Ready for you',
    readyEmpty: 'No ready tasks for your specialty.',
    mySessions: 'Your sessions without a summary',
    runDone: 'run /hub:done to add it',
    blocked: 'Blocked',
    by: 'by',
    released: 'Released',
    weekly: 'Weekly summary',
    counts: 'Counts',
    events: 'events',
    prsMerged: 'PRs merged',
    sessions: 'sessions',
    noSummary: 'without a summary',
    handoffs: 'Handoffs',
    created: 'created',
    applied: 'applied',
    pending: 'still pending',
    needs: 'Needs',
    delivered: 'delivered',
    verified: 'verified',
    open: 'open',
    redesign: 'Redesign',
    approved: 'approved',
    ported: 'ported',
    inReview: 'in review',
    overdueTitle: 'Overdue',
    nextWeek: 'Next week',
    repos: 'Repositories',
    contributors: 'Contributors',
    nothing: 'A quiet week.',
    merged: 'Merged',
  },
  ar: {
    title: 'موجزك الصباحي',
    awaiting: 'بانتظارك',
    awaitingEmpty: 'لا شيء ينتظرك.',
    decide: 'قرار',
    need: 'احتياج',
    handoff: 'إحالة',
    review: 'مراجعة',
    due: 'الموعد',
    deadlines: 'المواعيد',
    overdue: 'متأخر',
    escalated: 'مصعّد',
    changes: 'ما تغيّر منذ موجزك الأخير',
    commits: 'التزامات من',
    sessionBy: 'جلسة من',
    newHandoff: 'إحالة جديدة',
    decided: 'حُسم',
    ready: 'جاهز لك',
    readyEmpty: 'لا مهام جاهزة لتخصصك.',
    mySessions: 'جلساتك بلا ملخص',
    runDone: 'نفّذ /hub:done لإضافته',
    blocked: 'متوقف',
    by: 'بسبب',
    released: 'صدر',
    weekly: 'ملخص الأسبوع',
    counts: 'الأرقام',
    events: 'حدث',
    prsMerged: 'طلبات دمج',
    sessions: 'جلسات',
    noSummary: 'بلا ملخص',
    handoffs: 'الإحالات',
    created: 'أُنشئت',
    applied: 'طُبّقت',
    pending: 'ما زالت معلقة',
    needs: 'الاحتياجات',
    delivered: 'سُلّمت',
    verified: 'تُحقق منها',
    open: 'مفتوحة',
    redesign: 'إعادة التصميم',
    approved: 'موافق عليها',
    ported: 'نُقلت',
    inReview: 'قيد المراجعة',
    overdueTitle: 'المتأخر',
    nextWeek: 'الأسبوع القادم',
    repos: 'المستودعات',
    contributors: 'المساهمون',
    nothing: 'أسبوع هادئ.',
    merged: 'دُمج',
  },
} as const;

/** Keys read left to right inside an Arabic sentence (docs/07 §7). */
const key = (value: string, locale: Locale): string => (locale === 'ar' ? `⁦${value}⁩` : value);

const line = (label: string, card: BriefCard, locale: Locale, t: (typeof TEXT)[Locale]): string =>
  `- ${label} ${key(card.key, locale)} · ${card.title}${card.dueAt ? ` · ${t.due} ${card.dueAt.slice(0, 10)}` : ''}`;

const section = (title: string, lines: readonly string[]): string[] =>
  lines.length > 0 ? [`## ${title}`, ...lines, ''] : [];

export function renderBrief(sections: BriefSections, date: string, locale: Locale): string {
  const t = TEXT[locale];
  const { awaitingMe: a } = sections;
  const awaiting = [
    ...a.decisions.map((card) => line(t.decide, card, locale, t)),
    ...a.needs.map((card) => line(t.need, card, locale, t)),
    ...a.handoffs.map((card) => line(t.handoff, card, locale, t)),
    ...a.reviews.map((card) => line(t.review, card, locale, t)),
  ];
  const out = [
    `# ${t.title} · ${date}`,
    '',
    `## ${t.awaiting}`,
    ...(awaiting.length > 0 ? awaiting : [t.awaitingEmpty]),
    '',
    ...section(
      t.deadlines,
      sections.deadlines.map((card) => {
        const marks = [card.overdue ? t.overdue : null, card.escalated ? t.escalated : null].filter(Boolean);
        return `${line('', card, locale, t).replace('-  ', '- ')}${marks.length ? ` (${marks.join(', ')})` : ''}`;
      }),
    ),
    ...section(t.changes, [
      ...sections.changes.repos.map(
        (repo) => `- **${repo.name}**: ${repo.commitCount} ${t.commits} ${repo.authors.join(', ')}`,
      ),
      ...sections.changes.sessions.map(
        (s) => `- ${t.sessionBy} ${s.author ?? '?'}: ${key(s.key, locale)} · ${s.title}`,
      ),
      ...sections.changes.handoffs.map((h) => `- ${t.newHandoff}: ${key(h.key, locale)} · ${h.title}`),
    ]),
    ...section(
      t.decided,
      sections.decided.map(
        (d) =>
          `- ${key(d.key, locale)} · ${d.title}${d.option ? ` → **${d.option}**` : ''}${d.rationale ? `: ${d.rationale}` : ''}`,
      ),
    ),
    `## ${t.ready}`,
    ...(sections.readyTasks.length > 0
      ? sections.readyTasks.map((card) => `- [${card.priority}] ${key(card.key, locale)} · ${card.title}`)
      : [t.readyEmpty]),
    '',
    ...section(
      t.mySessions,
      sections.mySessions.map((s) => `- ${s.repo ?? '?'}/${s.branch ?? '?'}: ${t.runDone}`),
    ),
    ...section(
      t.blocked,
      sections.blocked.map(
        (b) =>
          `- ${key(b.key, locale)} · ${b.title}${b.blockerKey ? ` ${t.by} ${key(b.blockerKey, locale)}${b.blockerRole ? ` (${b.blockerRole})` : ''}` : ''}`,
      ),
    ),
    ...section(
      t.released,
      sections.releases.map((r) => `- ${r.version ?? key(r.key, locale)} · ${r.title}`),
    ),
  ];
  return `${out.join('\n').trimEnd()}\n`;
}

export function renderWeekly(sections: WeeklySections, week: string, locale: Locale): string {
  const t = TEXT[locale];
  const cardLine = (card: BriefCard) => `- ${key(card.key, locale)} · ${card.title}`;
  const events = Object.values(sections.counts.byKind).reduce((sum, n) => sum + n, 0);
  const c = sections.counts;
  const out = [
    `# ${t.weekly} · ${week} (${sections.from} → ${sections.to})`,
    '',
    ...(events === 0 ? [t.nothing, ''] : []),
    ...section(t.counts, [
      ...(events > 0 ? [`- ${events} ${t.events}`] : []),
      ...(c.commits > 0 ? [`- ${c.commits} commits`] : []),
      ...(c.prsMerged > 0 ? [`- ${c.prsMerged} ${t.prsMerged}`] : []),
      ...(c.sessions > 0 ? [`- ${c.sessions} ${t.sessions} (${c.sessionsNoSummary} ${t.noSummary})`] : []),
    ]),
    ...section(t.decided, sections.decided.map(cardLine)),
    ...section(t.released, sections.released.map(cardLine)),
    ...section(t.merged, sections.merged.map(cardLine)),
    ...section(
      t.handoffs,
      sections.handoffs.created + sections.handoffs.applied + sections.handoffs.pending.length > 0
        ? [
            `- ${sections.handoffs.created} ${t.created}, ${sections.handoffs.applied} ${t.applied}, ${sections.handoffs.pending.length} ${t.pending}`,
            ...sections.handoffs.pending.map((card) => `  ${cardLine(card)} (${card.ageHours} h)`),
          ]
        : [],
    ),
    ...section(
      t.needs,
      sections.needs.delivered + sections.needs.verified + sections.needs.open > 0
        ? [
            `- ${sections.needs.delivered} ${t.delivered}, ${sections.needs.verified} ${t.verified}, ${sections.needs.open} ${t.open}`,
          ]
        : [],
    ),
    ...section(
      t.redesign,
      sections.redesign.approved + sections.redesign.ported + sections.redesign.inReview > 0
        ? [
            `- ${sections.redesign.approved} ${t.approved}, ${sections.redesign.ported} ${t.ported}, ${sections.redesign.inReview} ${t.inReview}`,
          ]
        : [],
    ),
    ...section(t.overdueTitle, sections.overdue.map(cardLine)),
    ...section(t.nextWeek, sections.nextWeek.map(cardLine)),
    ...section(
      t.repos,
      sections.topRepos.map((repo) => `- ${repo.name}: ${repo.commits}`),
    ),
    ...section(
      t.contributors,
      sections.contributors.map((row) => `- ${row.user.displayName ?? '?'}: ${row.events}`),
    ),
  ];
  return `${out.join('\n').trimEnd()}\n`;
}

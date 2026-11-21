'use client';

/**
 * @file questions.tsx
 * @description A report's open questions as a deck: one question at a time, its options to pick (one, or several when the question allows it), the
 * option Claude recommends and why, a note on any pick, and Other for an answer in the owner's own words. Dots show where each answer stands, Take the
 * recommendations fills what is left, and one Send carries every answer back to Claude in a single message.
 */
import type { ReportQuestion, ReportQuestionInput } from '@hub/contracts';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, PenLine, Send, Sparkles, ThumbsUp, X } from 'lucide-react';
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';

import {
  Bidi,
  Button,
  cn,
  fmt,
  focusRing,
  IconButton,
  matchKey,
  num,
  Tooltip,
  useLocale,
  useRoving,
  useT,
} from '@/components/kit';
import {
  answersMessage,
  emptyAnswer,
  isAnswered,
  type QuestionAnswer,
  questionsOf,
  toggle,
  withRecommended,
} from '@/features/planning/questions';

import type { PlanningMessages } from '../messages';

type Deck = PlanningMessages['studio']['deck'];

const field =
  'w-full resize-none rounded-lg border border-input bg-background px-2.5 py-1.5 text-body-sm text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15';

export function Questions({
  questions: raw,
  onAsk,
  busy,
  blocked = false,
  prompt,
  label,
}: {
  questions: readonly ReportQuestionInput[];
  /** Sends the answers. False means they were not taken (a request already waits), so the picks stay. */
  onAsk?: ((text: string) => boolean | Promise<boolean>) | undefined;
  busy: boolean;
  /** A request already waits for Claude: Send holds back and says why. */
  blocked?: boolean | undefined;
  /** What goes before the answers: each studio asks for its own report back. */
  prompt?: string;
  /** The deck's name for a screen reader: the section's title. */
  label?: string | undefined;
}) {
  const w = useT<PlanningMessages>('planning').studio;
  const d = w.deck;
  const locale = useLocale();
  const reduce = useReducedMotion();
  const questions = useMemo(() => questionsOf(raw), [raw]);
  const signature = questions.map((q) => q.text).join('\n');
  const [answers, setAnswers] = useState<Record<number, QuestionAnswer>>({});
  const [at, setAt] = useState(0);
  const [heading, setHeading] = useState<1 | -1>(1);
  const roving = useRoving(Math.min(at, Math.max(questions.length - 1, 0)));

  // A new set of questions (the report changed) starts fresh.
  useEffect(() => {
    setAnswers({});
    setAt(0);
  }, [signature]);

  if (!onAsk) return <QuestionList questions={questions} words={d} />;

  const total = questions.length;
  const index = Math.min(at, total - 1);
  const q = questions[index]!;
  const answer = answers[index] ?? emptyAnswer();
  const answered = questions.filter((_, i) => isAnswered(answers[i])).length;
  const withAdvice = questions.some((x, i) => x.recommended.length > 0 && !isAnswered(answers[i]));

  const go = (next: number) => {
    if (next < 0 || next >= total || next === index) return;
    setHeading(next > index ? 1 : -1);
    setAt(next);
  };
  const set = (next: QuestionAnswer) => setAnswers((a) => ({ ...a, [index]: next }));
  const takeRecommended = () =>
    setAnswers((a) => {
      const out = { ...a };
      questions.forEach((x, i) => {
        const r = withRecommended(x, out[i]);
        if (r) out[i] = r;
      });
      return out;
    });
  const send = async () => {
    if (blocked) return;
    const text = answersMessage(prompt ?? w.answersPrompt, questions, answers, d.other, w.deck.sep);
    if (!text) return;
    // The answers are cleared only once Claude has them, or they wait in line: a refused send keeps every pick.
    if (!(await onAsk(text))) return;
    setAnswers({});
    setAt(0);
  };
  // Arrows move between questions, in the reading direction, unless the owner is typing or is on the dots (which move focus themselves).
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('textarea, input, [data-roving]')) return;
    const forward = locale === 'ar' ? 'ArrowLeft' : 'ArrowRight';
    const back = locale === 'ar' ? 'ArrowRight' : 'ArrowLeft';
    if (matchKey(e, forward)) go(index + 1);
    else if (matchKey(e, back)) go(index - 1);
    else return;
    e.preventDefault();
  };
  const Prev = locale === 'ar' ? ChevronRight : ChevronLeft;
  const Next = locale === 'ar' ? ChevronLeft : ChevronRight;
  const slide = reduce ? 0 : 28 * heading * (locale === 'ar' ? -1 : 1);

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={label ?? w.sections.questions}
      onKeyDown={onKey}
      className="flex min-w-0 flex-col gap-3"
    >
      {/* Where the owner is, and where each answer stands. */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-caption font-semibold text-foreground tabular-nums">
            {fmt(d.of, { n: num(index + 1, locale), total: num(total, locale) })}
          </span>
          <span role="status" className="text-caption text-muted-foreground tabular-nums">
            · {fmt(d.answered, { n: num(answered, locale), total: num(total, locale) })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            label={d.prev}
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="md:size-8"
          >
            <Prev aria-hidden className="size-4" strokeWidth={2} />
          </IconButton>
          <IconButton
            label={d.next}
            onClick={() => go(index + 1)}
            disabled={index === total - 1}
            className="md:size-8"
          >
            <Next aria-hidden className="size-4" strokeWidth={2} />
          </IconButton>
        </div>
      </div>
      {/* One Tab stop; the arrows move along the dots. Each dot sits in a target big enough to hit. */}
      <nav aria-label={d.dots} className="-mx-1 flex flex-wrap" ref={roving.root} {...roving.groupProps}>
        {questions.map((x, i) => {
          const done = isAnswered(answers[i]);
          return (
            <button
              key={`${i}-${x.text}`}
              type="button"
              {...roving.itemProps(i)}
              aria-current={i === index ? 'step' : undefined}
              aria-label={fmt(done ? d.goToAnswered : d.goTo, { n: num(i + 1, locale) })}
              onClick={() => go(i)}
              className={cn(
                'group flex min-h-6 min-w-6 items-center justify-center rounded-full max-md:min-h-11 max-md:min-w-11',
                focusRing,
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'h-2 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none',
                  i === index
                    ? 'w-7 bg-foreground'
                    : done
                      ? 'w-2.5 bg-foreground/45'
                      : 'w-2.5 bg-border group-hover:bg-muted-foreground/40',
                )}
              />
            </button>
          );
        })}
      </nav>

      {/* The question. */}
      <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-muted/30 p-3.5 md:p-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={{ opacity: 0, x: slide }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -slide }}
            transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
            className="flex min-w-0 flex-col gap-3"
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className="min-w-0 text-body font-semibold text-pretty text-foreground">
                <Bidi>{q.text}</Bidi>
              </p>
              {isAnswered(answer) && (
                <IconButton label={d.clear} onClick={() => set(emptyAnswer())} className="shrink-0 md:size-7">
                  <X aria-hidden className="size-3.5" strokeWidth={2} />
                </IconButton>
              )}
            </div>
            <p className="-mt-1.5 text-caption text-muted-foreground">
              {q.options.length ? (q.multi ? d.pickMany : d.pickOne) : d.writeOwn}
            </p>
            <QuestionOptions question={q} answer={answer} onChange={set} words={d} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Moving on, and sending. */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          variant={answered && !blocked ? 'primary' : 'outline'}
          size="sm"
          disabled={answered === 0 || blocked}
          onClick={() => void send()}
        >
          <Send aria-hidden className="size-3.5 rtl:-scale-x-100" strokeWidth={1.75} />
          {fmt(busy ? d.sendLater : d.send, { n: num(answered, locale) })}
        </Button>
        {blocked && answered > 0 && (
          <span role="status" className="text-caption text-muted-foreground">
            {w.queueFull}
          </span>
        )}
        {withAdvice && (
          <Tooltip content={d.takeRecommendedTip}>
            <Button variant="outline" size="sm" onClick={takeRecommended}>
              <ThumbsUp aria-hidden className="size-3.5" strokeWidth={1.75} />
              {d.takeRecommended}
            </Button>
          </Tooltip>
        )}
        {index < total - 1 && (
          <Button variant="ghost" size="sm" onClick={() => go(index + 1)} className="ms-auto">
            {isAnswered(answer) ? d.next : d.skip}
            <Next aria-hidden className="size-3.5" strokeWidth={2} />
          </Button>
        )}
        {answered === total && total > 1 && (
          <span role="status" className="ms-auto text-caption text-muted-foreground">
            {d.allAnswered}
          </span>
        )}
      </div>
    </div>
  );
}

/** The options of one question, the recommended one marked, a note under each pick, and Other for the owner's own words. */
function QuestionOptions({
  question: q,
  answer,
  onChange,
  words: d,
}: {
  question: ReportQuestion;
  answer: QuestionAnswer;
  onChange: (a: QuestionAnswer) => void;
  words: Deck;
}) {
  const [noting, setNoting] = useState<number | null>(null);
  const role = q.multi ? 'checkbox' : 'radio';
  const open = q.options.length === 0;

  if (open) {
    return (
      <textarea
        dir="auto"
        rows={2}
        aria-label={q.text}
        value={answer.otherText}
        onChange={(e) => onChange({ ...answer, other: true, otherText: e.target.value })}
        placeholder={d.otherPlaceholder}
        className={cn(field, 'max-h-48 min-h-16')}
      />
    );
  }

  return (
    <div
      role={q.multi ? 'group' : 'radiogroup'}
      aria-label={q.text}
      className="grid min-w-0 items-start gap-2 @page-lg:grid-cols-2"
    >
      {q.options.map((o, i) => {
        const picked = answer.picks.includes(i);
        const advised = q.recommended.includes(i);
        const note = answer.notes[i] ?? '';
        return (
          <div
            key={`${i}-${o.label}`}
            className={cn(
              'flex min-w-0 flex-col rounded-xl border bg-card transition-colors duration-150',
              picked
                ? 'border-primary shadow-sm ring-1 ring-primary/25'
                : 'border-border hover:border-primary/40',
            )}
          >
            <button
              type="button"
              role={role}
              aria-checked={picked}
              onClick={() => onChange(toggle(q, answer, i))}
              className={cn('flex min-w-0 items-start gap-2.5 rounded-xl p-2.5 text-start', focusRing)}
            >
              <Mark multi={!!q.multi} on={picked} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="text-body-sm font-medium text-foreground">
                    <Bidi>{o.label}</Bidi>
                  </span>
                  {advised && (
                    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-success-soft px-1.5 text-caption font-semibold text-success-soft-foreground">
                      <Sparkles aria-hidden className="size-3" strokeWidth={2} />
                      {d.recommended}
                    </span>
                  )}
                </span>
                {o.detail && (
                  <span className="text-caption text-pretty text-muted-foreground">
                    <Bidi>{o.detail}</Bidi>
                  </span>
                )}
                {advised && q.why && (
                  <span className="text-caption text-pretty text-success-soft-foreground">
                    <Bidi>{fmt(d.why, { why: q.why })}</Bidi>
                  </span>
                )}
              </span>
            </button>
            {picked && (noting === i || note) ? (
              <div className="px-2.5 pb-2.5">
                <textarea
                  dir="auto"
                  rows={1}
                  autoFocus={noting === i && !note}
                  aria-label={`${o.label}: ${d.addNote}`}
                  value={note}
                  onChange={(e) => onChange({ ...answer, notes: { ...answer.notes, [i]: e.target.value } })}
                  onBlur={() => setNoting(null)}
                  placeholder={d.note}
                  className={cn(field, 'max-h-32 min-h-8 text-caption')}
                />
              </div>
            ) : (
              picked && (
                <button
                  type="button"
                  onClick={() => setNoting(i)}
                  className={cn(
                    'mx-2.5 mb-2 inline-flex h-7 items-center gap-1 self-start rounded-md px-1.5 text-caption text-primary hover:bg-primary/5 max-md:h-11',
                    focusRing,
                  )}
                >
                  <PenLine aria-hidden className="size-3.5" strokeWidth={1.75} />
                  {d.addNote}
                </button>
              )
            )}
          </div>
        );
      })}

      {/* Other: the owner's own answer. */}
      <div
        className={cn(
          'flex min-w-0 flex-col rounded-xl border border-dashed bg-card transition-colors duration-150 @page-lg:col-span-2',
          answer.other ? 'border-primary ring-1 ring-primary/25' : 'border-border hover:border-primary/40',
        )}
      >
        <button
          type="button"
          role={role}
          aria-checked={answer.other}
          onClick={() => onChange(toggle(q, answer, 'other'))}
          className={cn('flex min-w-0 items-start gap-2.5 rounded-xl p-2.5 text-start', focusRing)}
        >
          <Mark multi={!!q.multi} on={answer.other} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-body-sm font-medium text-foreground">{d.other}</span>
            <span className="text-caption text-muted-foreground">{d.otherHint}</span>
          </span>
        </button>
        {answer.other && (
          <div className="px-2.5 pb-2.5">
            <textarea
              dir="auto"
              rows={2}
              autoFocus={!answer.otherText}
              aria-label={`${q.text}: ${d.other}`}
              value={answer.otherText}
              onChange={(e) => onChange({ ...answer, otherText: e.target.value })}
              placeholder={d.otherPlaceholder}
              className={cn(field, 'max-h-40 min-h-14')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** A pick's mark: a square for several, a circle for one. */
function Mark({ multi, on }: { multi: boolean; on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 flex size-4.5 shrink-0 items-center justify-center border transition-colors',
        multi ? 'rounded-sm' : 'rounded-full',
        on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 bg-background',
      )}
    >
      {on && <Check className="size-3" strokeWidth={3} />}
    </span>
  );
}

/** The questions to read, where there is nobody to answer them: each with its options, the recommended one marked. */
function QuestionList({ questions, words: d }: { questions: readonly ReportQuestion[]; words: Deck }) {
  return (
    <ol className="flex min-w-0 list-decimal flex-col gap-2.5 ps-5 text-body-sm text-foreground marker:text-info">
      {questions.map((q, i) => (
        <li key={`${i}-${q.text}`} className="flex flex-col gap-1">
          <Bidi>{q.text}</Bidi>
          {q.options.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {q.options.map((o, j) => (
                <span
                  key={`${j}-${o.label}`}
                  className={cn(
                    'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-caption',
                    q.recommended.includes(j)
                      ? 'border-success/40 bg-success-soft text-success-soft-foreground'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {q.recommended.includes(j) && <Sparkles aria-hidden className="size-3" strokeWidth={2} />}
                  <Bidi>{o.label}</Bidi>
                  {q.recommended.includes(j) && <span className="sr-only">({d.recommended})</span>}
                </span>
              ))}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

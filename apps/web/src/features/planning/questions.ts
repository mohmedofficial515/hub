/**
 * @file questions.ts
 * @description A report's open questions as the owner answers them: the options picked, a note on any pick, and their own words under Other. One message
 * carries every answer back to Claude, in the shape the conversation reads back as the owner's answers (`- question` then `→ answer`).
 */
import { questionOf, type ReportQuestion, type ReportQuestionInput } from '@hub/contracts';

export interface QuestionAnswer {
  /** The options picked, by index. One at most when the question is not `multi`. */
  picks: number[];
  /** A note the owner added to a pick, by the option's index. */
  notes: Record<number, string>;
  /** Other is open, with the owner's own words. */
  other: boolean;
  otherText: string;
}

export const emptyAnswer = (): QuestionAnswer => ({ picks: [], notes: {}, other: false, otherText: '' });

export const questionsOf = (questions: readonly ReportQuestionInput[]): ReportQuestion[] =>
  questions.map(questionOf);

/** Whether an answer says anything: a pick, or Other with words in it. */
export const isAnswered = (a: QuestionAnswer | undefined): boolean =>
  !!a && (a.picks.length > 0 || (a.other && a.otherText.trim().length > 0));

/**
 * Picks an option. A single-answer question keeps one pick, and picking closes Other. A pick that was there is taken back, with its note.
 * Opening Other on a single-answer question clears the picks: the owner's words are the answer.
 */
export function toggle(q: ReportQuestion, a: QuestionAnswer, option: number | 'other'): QuestionAnswer {
  if (option === 'other') {
    const other = !a.other;
    return q.multi || !other ? { ...a, other } : { ...a, other, picks: [], notes: {} };
  }
  if (a.picks.includes(option)) {
    const { [option]: _gone, ...notes } = a.notes;
    return { ...a, picks: a.picks.filter((p) => p !== option), notes };
  }
  return q.multi
    ? { ...a, picks: [...a.picks, option].sort((x, y) => x - y) }
    : { ...a, picks: [option], notes: a.notes[option] ? { [option]: a.notes[option] } : {}, other: false };
}

/** The recommended options, for a question that has them and no answer yet. */
export function withRecommended(
  q: ReportQuestion,
  a: QuestionAnswer | undefined,
): QuestionAnswer | undefined {
  if (isAnswered(a) || q.recommended.length === 0) return a;
  return { ...emptyAnswer(), picks: [...q.recommended].sort((x, y) => x - y) };
}

/** An answer in one line: each pick with its note, then Other's words. */
export function answerLine(q: ReportQuestion, a: QuestionAnswer, otherWord: string): string {
  const parts = a.picks
    .filter((i) => q.options[i])
    .map((i) => {
      const note = a.notes[i]?.trim();
      return note ? `${q.options[i]!.label} (${oneLine(note)})` : q.options[i]!.label;
    });
  const own = a.other ? oneLine(a.otherText) : '';
  if (own) parts.push(q.options.length ? `${otherWord}: ${own}` : own);
  return parts.join('؛ ');
}

/** Every answered question, in the order the report asked them, under the studio's own request. */
export function answersMessage(
  prompt: string,
  questions: readonly ReportQuestion[],
  answers: Readonly<Record<number, QuestionAnswer>>,
  otherWord: string,
): string | null {
  const lines = questions.flatMap((q, i) => {
    const a = answers[i];
    if (!isAnswered(a)) return [];
    return [`- ${oneLine(q.text)}\n  → ${answerLine(q, a!, otherWord)}`];
  });
  return lines.length ? `${prompt}\n${lines.join('\n')}` : null;
}

const oneLine = (text: string) => text.trim().replace(/\s*\n+\s*/g, ' ');

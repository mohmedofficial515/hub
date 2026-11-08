import { describe, expect, it } from 'vitest';

import {
  createRunSchema,
  firstRunAt,
  inQuietHours,
  localInstant,
  nextWeekly,
  runPrompt,
  sectionOf,
  startOfLocalDay,
} from './agent-queue';

const IST = 'Europe/Istanbul';
const BERLIN = 'Europe/Berlin';

describe('the queue calendar', () => {
  it('reads a local date and time in the zone, not in UTC', () => {
    expect(localInstant('2026-11-08', '22:00', IST).toISOString()).toBe('2026-11-08T19:00:00.000Z');
  });

  it('is right across a DST change', () => {
    // Berlin leaves summer time on 2026-10-25 at 03:00.
    expect(localInstant('2026-10-24', '08:00', BERLIN).toISOString()).toBe('2026-10-24T06:00:00.000Z');
    expect(localInstant('2026-10-26', '08:00', BERLIN).toISOString()).toBe('2026-10-26T07:00:00.000Z');
  });

  it('finds the next weekly time, later today or next week', () => {
    // 2026-11-09 is a Monday.
    const mondayMorning = new Date('2026-11-09T04:00:00Z'); // 07:00 in Istanbul
    expect(nextWeekly('MON', '08:00', IST, mondayMorning).toISOString()).toBe('2026-11-09T05:00:00.000Z');
    const mondayNoon = new Date('2026-11-09T09:00:00Z');
    expect(nextWeekly('MON', '08:00', IST, mondayNoon).toISOString()).toBe('2026-11-16T05:00:00.000Z');
    expect(nextWeekly('SUN', '08:00', IST, mondayNoon).toISOString()).toBe('2026-11-15T05:00:00.000Z');
  });

  it('starts the day at local midnight', () => {
    expect(startOfLocalDay(new Date('2026-11-08T22:30:00Z'), IST).toISOString()).toBe(
      '2026-11-08T21:00:00.000Z',
    );
  });

  it('holds quiet hours that wrap past midnight, and none when both ends are equal', () => {
    const quiet = { from: '22:00', to: '07:00' };
    expect(inQuietHours(new Date('2026-11-08T20:30:00Z'), quiet, IST)).toBe(true); // 23:30
    expect(inQuietHours(new Date('2026-11-08T03:00:00Z'), quiet, IST)).toBe(true); // 06:00
    expect(inQuietHours(new Date('2026-11-08T09:00:00Z'), quiet, IST)).toBe(false); // 12:00
    expect(inQuietHours(new Date('2026-11-08T11:00:00Z'), { from: '13:00', to: '15:00' }, IST)).toBe(true);
    expect(inQuietHours(new Date('2026-11-08T11:00:00Z'), { from: '14:00', to: '14:00' }, IST)).toBe(false);
    expect(inQuietHours(new Date(), null, IST)).toBe(false);
  });

  it('gives no time for now, the local time for once, and the next week for weekly', () => {
    const now = new Date('2026-11-09T09:00:00Z');
    expect(firstRunAt({ kind: 'now' }, IST, now)).toBeNull();
    expect(firstRunAt({ kind: 'once', date: '2026-11-09', time: '22:00' }, IST, now)?.toISOString()).toBe(
      '2026-11-09T19:00:00.000Z',
    );
    expect(firstRunAt({ kind: 'weekly', day: 'MON', time: '08:00' }, IST, now)?.toISOString()).toBe(
      '2026-11-16T05:00:00.000Z',
    );
  });
});

describe('a run', () => {
  it('needs its card, its step or its words', () => {
    const base = {
      device: '0190f0f0-0000-7000-8000-000000000001',
      folder: 'C:/work/repo',
      when: { kind: 'now' },
    };
    expect(createRunSchema.safeParse({ ...base, source: 'task' }).success).toBe(false);
    expect(createRunSchema.safeParse({ ...base, source: 'task', cardKey: 'GTV-1' }).success).toBe(true);
    expect(createRunSchema.safeParse({ ...base, source: 'plan_step', cardKey: 'GTV-2' }).success).toBe(false);
    expect(
      createRunSchema.safeParse({ ...base, source: 'plan_step', cardKey: 'GTV-2', planStep: 0 }).success,
    ).toBe(true);
    expect(createRunSchema.safeParse({ ...base, source: 'prompt' }).success).toBe(false);
    expect(createRunSchema.safeParse({ ...base, source: 'prompt', prompt: 'Tidy the README' }).success).toBe(
      true,
    );
  });

  it('runs a task through the work protocol, and names a step and its plan', () => {
    expect(runPrompt({ source: 'task', cardKey: 'GTV-7' })).toBe('/hub:work GTV-7');
    expect(
      runPrompt({ source: 'plan_step', cardKey: 'GTV-9', planStep: 1, stepTitle: 'Add a test' }),
    ).toMatch(/^Carry out step 2 of plan GTV-9: Add a test/);
    expect(runPrompt({ source: 'prompt', prompt: 'Tidy the README' })).toBe('Tidy the README');
  });

  it('sits in one of four sections', () => {
    expect(sectionOf('scheduled')).toBe('next');
    expect(sectionOf('paused')).toBe('next');
    expect(sectionOf('waiting')).toBe('waiting');
    expect(sectionOf('interrupted')).toBe('recent');
  });
});

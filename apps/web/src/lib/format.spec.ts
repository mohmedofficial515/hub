/**
 * @file `when()`: a word or a weekday only while it can name one day, a date beyond that (review M3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { when } from './format';

// Thursday 5 November 2026, 20:33 in Istanbul (UTC+3).
const NOW = '2026-11-05T17:33:00.000Z';
const at = (day: string) => `${day}T15:42:00.000Z`; // 18:42 in Istanbul

describe('when', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['2026-11-05', 'today 18:42'],
    ['2026-11-04', 'yesterday 18:42'],
    ['2026-11-06', 'tomorrow 18:42'],
    ['2026-11-07', 'Sat 18:42'],
    ['2026-11-11', 'Wed 18:42'],
    ['2026-11-12', '12 Nov 18:42'],
    ['2026-11-19', '19 Nov 18:42'],
    ['2026-11-03', 'Tue 18:42'],
    ['2026-10-30', 'Fri 18:42'],
    ['2026-10-29', '29 Oct 18:42'],
  ])('en: %s reads %s', (day, expected) => {
    expect(when(at(day), 'en')).toBe(expected);
  });

  it.each([
    ['2026-11-05', 'اليوم 18:42'],
    ['2026-11-04', 'أمس 18:42'],
    ['2026-11-06', 'غدًا 18:42'],
    ['2026-11-07', 'السبت 18:42'],
    ['2026-11-11', 'الأربعاء 18:42'],
    ['2026-11-12', '12 نوفمبر 18:42'],
    ['2026-11-19', '19 نوفمبر 18:42'],
    ['2026-10-30', 'الجمعة 18:42'],
    ['2026-10-29', '29 أكتوبر 18:42'],
  ])('ar: %s reads %s', (day, expected) => {
    expect(when(at(day), 'ar')).toBe(expected);
  });

  it('a week to the day is a date, not the same weekday as today', () => {
    expect(when(at('2026-11-12'), 'en')).not.toMatch(/Thu/);
    expect(when(at('2026-10-29'), 'en')).not.toMatch(/Thu/);
  });

  it('counts days in the workspace timezone, not in UTC', () => {
    // 22:30 UTC on the 5th is already the 6th in Istanbul.
    expect(when('2026-11-05T22:30:00.000Z', 'en')).toBe('tomorrow 01:30');
  });
});

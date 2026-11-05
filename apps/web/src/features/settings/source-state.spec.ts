/**
 * @file source-state.spec.ts
 * @description A source's word comes only from its real fields.
 */
import { describe, expect, it } from 'vitest';

import { hoursFromRuns, intervalSecOf, type SourceFacts, sourceState } from './source-state';

const base: SourceFacts = {
  kind: 'local_path',
  enabled: true,
  config: { path: 'F:/x', purpose: 'docs' },
  lastRunAt: '2026-11-05T10:00:00Z',
  lastSuccessAt: '2026-11-05T10:00:00Z',
  lastError: null,
  lagSec: 10,
};

describe('sourceState', () => {
  it('reads disabled before anything else', () => {
    expect(sourceState({ ...base, enabled: false, lastError: 'x' })).toBe('disabled');
  });
  it('reads a stored error as failing', () => {
    expect(sourceState({ ...base, lastError: 'boom' })).toBe('failing');
  });
  it('says not connected for GitHub kinds with no success, and never run for a new folder', () => {
    const fresh = { lastRunAt: null, lastSuccessAt: null, lagSec: null };
    expect(sourceState({ ...base, ...fresh, kind: 'github_repo' })).toBe('not_connected');
    expect(sourceState({ ...base, ...fresh, kind: 'openapi' })).toBe('not_connected');
    expect(sourceState({ ...base, ...fresh })).toBe('never_run');
  });
  it('is lagging past three periods, read from the project settings', () => {
    const settings = { 'capture.docs.interval_sec': 100 };
    expect(sourceState({ ...base, lagSec: 301 }, settings)).toBe('lagging');
    expect(sourceState({ ...base, lagSec: 299 }, settings)).toBe('ok');
  });
});

describe('intervalSecOf', () => {
  it('picks the lab period for a lab folder', () => {
    expect(
      intervalSecOf({ kind: 'local_path', config: { purpose: 'lab' } }, { 'capture.lab.interval_sec': 7 }),
    ).toBe(7);
  });
});

describe('hoursFromRuns', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  it('draws nothing without a run in the last day', () => {
    expect(hoursFromRuns([], now)).toBeNull();
    expect(hoursFromRuns([{ startedAt: '2026-11-01T12:00:00Z', status: 'ok' }], now)).toBeNull();
  });
  it('names an hour by its worst run, newest at the end', () => {
    const hours = hoursFromRuns(
      [
        { startedAt: '2026-11-05T11:50:00Z', status: 'ok' },
        { startedAt: '2026-11-05T11:40:00Z', status: 'failed' },
        { startedAt: '2026-11-05T09:30:00Z', status: 'partial' },
      ],
      now,
    );
    expect(hours?.[23]).toBe('failed');
    expect(hours?.[21]).toBe('partial');
    expect(hours?.[0]).toBe('idle');
  });
});

/**
 * Mock data shaped like the real API, so a port swaps these for `useLoyaltySummary()` and the session user without
 * reshaping anything:
 * - `LoyaltySummary` is a subset of `LoyaltySummaryDto` (apiEndpoint/generated/v1/types.gen.ts).
 * - `Customer.avatar` is `GET /users/me` → `avatar: { url, thumbUrl, expiresAt } | null`.
 * - `Customer.cover` is NEW (v4): `GET /users/me` → `cover: { url, thumbUrl, expiresAt, presetId } | null`. A preset
 *   cover has `presetId` and public URLs; an uploaded one has `presetId: null` and presigned links like the avatar.
 * Levels and thresholds follow the backend defaults (loyalty.settings.ts): BLUE 0, SILVER USD 2,500, GOLD USD 10,000,
 * on lifetime spend, valid 12 months. The amounts are invented test values, not production data.
 */

import { COVER_PRESETS, UPLOADED_SAMPLE, type CoverPresetId } from './covers';

export type TierCode = 'BLUE' | 'SILVER' | 'GOLD';
/** What the frame draws: a known level, an unknown code from settings, or no loyalty data. */
export type FrameLevel = TierCode | 'OTHER' | 'NONE';

export interface LocalizedName {
  ar: string | null;
  en: string;
  tr: string | null;
}

export interface LoyaltySummary {
  availablePoints: number;
  pointsBalance: number;
  lifetimePoints: number;
  /** Decimal string, USD. */
  lifetimeSpendUsd: string;
  tier: { code: string; name: LocalizedName; expiresAt: string | null; multiplier: number };
  nextTier: {
    code: string;
    name: LocalizedName;
    remainingPoints?: number;
    /** Decimal string, USD. */
    remainingSpendUsd?: string;
  } | null;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  /** Year the account was created, for the Postmark micro-text. */
  memberSince: number;
  avatar: { url: string; thumbUrl: string; expiresAt: string } | null;
  cover: Cover | null;
}

export interface Cover {
  url: string;
  thumbUrl: string;
  expiresAt: string | null;
  /** Set when the cover is one of the gallery presets. */
  presetId: CoverPresetId | null;
}

/** Lab switch for the cover: none (flat navy, exactly v3), a gallery preset, or an uploaded photo. */
export type CoverChoice = 'none' | 'gallery' | 'upload';

const NAMES: Record<TierCode, LocalizedName> = {
  BLUE: { en: 'Blue', ar: 'أزرق', tr: 'Mavi' },
  SILVER: { en: 'Silver', ar: 'فضي', tr: 'Gümüş' },
  GOLD: { en: 'Gold', ar: 'ذهبي', tr: 'Altın' },
};

export const SUMMARIES: Record<TierCode, LoyaltySummary> = {
  BLUE: {
    availablePoints: 640,
    pointsBalance: 840,
    lifetimePoints: 840,
    lifetimeSpendUsd: '840.00',
    tier: { code: 'BLUE', name: NAMES.BLUE, expiresAt: '2027-05-02T00:00:00Z', multiplier: 1 },
    nextTier: { code: 'SILVER', name: NAMES.SILVER, remainingSpendUsd: '1660.00' },
  },
  SILVER: {
    availablePoints: 6980,
    pointsBalance: 7525,
    lifetimePoints: 7525,
    lifetimeSpendUsd: '6420.00',
    tier: { code: 'SILVER', name: NAMES.SILVER, expiresAt: '2027-03-14T00:00:00Z', multiplier: 1.25 },
    nextTier: { code: 'GOLD', name: NAMES.GOLD, remainingSpendUsd: '3580.00' },
  },
  GOLD: {
    availablePoints: 17140,
    pointsBalance: 18030,
    lifetimePoints: 18030,
    lifetimeSpendUsd: '12960.00',
    tier: { code: 'GOLD', name: NAMES.GOLD, expiresAt: '2027-09-30T00:00:00Z', multiplier: 1.5 },
    nextTier: null,
  },
};

/** A portrait served like the presigned avatar links; the broken one exercises the image-error fallback. */
const PHOTO = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=512&h=512&fit=crop&crop=faces&q=70';
const PHOTO_THUMB = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop&crop=faces&q=70';
const BROKEN = 'https://files.invalid/avatars/expired.webp';

export type Picture = 'photo' | 'initial' | 'broken';
export type Script = 'arabic' | 'latin';

export function coverFor(choice: CoverChoice): Cover | null {
  if (choice === 'gallery') {
    const p = COVER_PRESETS.find((c) => c.id === 'istanbul') ?? COVER_PRESETS[0];
    return { url: p.url, thumbUrl: p.thumbUrl, expiresAt: null, presetId: p.id };
  }
  if (choice === 'upload')
    return { url: UPLOADED_SAMPLE, thumbUrl: UPLOADED_SAMPLE, expiresAt: '2026-11-22T13:00:00Z', presetId: null };
  return null;
}

export function customerFor(script: Script, picture: Picture, cover: CoverChoice = 'none'): Customer {
  const base =
    script === 'arabic'
      ? { name: 'سارة القحطاني', email: 'sara.alqahtani@example.com' }
      : { name: 'Sara Alqahtani', email: 'sara.alqahtani@example.com' };
  const avatar =
    picture === 'photo'
      ? { url: PHOTO, thumbUrl: PHOTO_THUMB, expiresAt: '2026-11-21T13:00:00Z' }
      : picture === 'broken'
        ? { url: BROKEN, thumbUrl: BROKEN, expiresAt: '2026-11-21T11:00:00Z' }
        : null;
  return { id: 'cus_01JD4Q8', memberSince: 2024, avatar, cover: coverFor(cover), ...base };
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿ]/;

/**
 * Monogram: Arabic-script names give one isolated letter (joined letters do not form initials); Latin names give
 * the first and last initials. Never a transliteration.
 */
export function monogram(name: string, email = ''): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return (email[0] ?? '').toUpperCase();
  if (ARABIC.test(words[0][0])) return words[0][0];
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function frameLevelOf(code: string | undefined | null): FrameLevel {
  if (!code) return 'NONE';
  return code === 'BLUE' || code === 'SILVER' || code === 'GOLD' ? code : 'OTHER';
}

export type Progress =
  | { kind: 'spend'; spent: number; remaining: number; target: number; ratio: number; next: LocalizedName }
  | { kind: 'points'; earned: number; remaining: number; target: number; ratio: number; next: LocalizedName }
  | { kind: 'top' }
  | { kind: 'unknown'; next: LocalizedName };

/**
 * Progress to the next level, spend first (GTV-544). The tier ladder is not exposed to customers, so the target is
 * derived as what is counted so far plus what remains; it is never hard-coded.
 */
export function progressOf(summary: LoyaltySummary): Progress {
  const next = summary.nextTier;
  if (!next) return { kind: 'top' };
  if (next.remainingSpendUsd !== undefined) {
    const spent = Number(summary.lifetimeSpendUsd);
    const remaining = Number(next.remainingSpendUsd);
    const target = spent + remaining;
    return { kind: 'spend', spent, remaining, target, ratio: target > 0 ? spent / target : 0, next: next.name };
  }
  if (next.remainingPoints !== undefined) {
    const earned = summary.lifetimePoints;
    const remaining = next.remainingPoints;
    const target = earned + remaining;
    return { kind: 'points', earned, remaining, target, ratio: target > 0 ? earned / target : 0, next: next.name };
  }
  return { kind: 'unknown', next: next.name };
}

export function nameIn(name: LocalizedName, locale: 'ar' | 'en'): string {
  return (locale === 'ar' ? name.ar : null) ?? name.en;
}

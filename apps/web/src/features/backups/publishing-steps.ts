/**
 * @file publishing-steps.ts
 * @description Settings › Devices › Reaching Hub from other devices (docs/16 §10, docs/13 §14): where the owner is in the steps, from what Hub already knows.
 * The main machine's steps are done, next or later from the publishing facts and the owner's two-step sign-in; the other devices' steps start once the main
 * machine is published, since Hub cannot see another device before it connects.
 */
import type { PublishingDto } from '@hub/contracts';

export const MAIN_STEPS = ['install', 'https', 'serve', 'env', 'totp'] as const;
export type MainStep = (typeof MAIN_STEPS)[number];
export const OTHER_STEPS = ['install', 'open', 'pair'] as const;
export type OtherStep = (typeof OTHER_STEPS)[number];

export type StepState = 'done' | 'next' | 'later';

/** The one-line summary at the top: the next main-machine step, or `published`. */
export type PublishingSummary = Exclude<MainStep, 'totp'> | 'published';

export interface PublishingProgress {
  summary: PublishingSummary;
  main: Record<MainStep, StepState>;
  other: Record<OtherStep, StepState>;
}

export function publishingProgress(data: PublishingDto, totpEnabled: boolean): PublishingProgress {
  const tailscale = data.tailscale;
  const connected = tailscale.installed && tailscale.running;
  // `tailscale serve --https` needs the tailnet's certificates, so a serving machine has them.
  const serving = connected && tailscale.servesWeb && tailscale.servesApi;
  const published = serving && tailscale.matchesPublicUrl && data.secureCookies;
  const done: Record<MainStep, boolean> = {
    install: connected,
    https: serving,
    serve: serving,
    env: published,
    totp: totpEnabled,
  };
  const next = MAIN_STEPS.find((step) => !done[step]);
  const main = Object.fromEntries(
    MAIN_STEPS.map((step) => [step, done[step] ? 'done' : step === next ? 'next' : 'later']),
  ) as Record<MainStep, StepState>;
  const other = Object.fromEntries(
    OTHER_STEPS.map((step, index) => [step, published && index === 0 ? 'next' : 'later']),
  ) as Record<OtherStep, StepState>;
  const summary: PublishingSummary = published
    ? 'published'
    : (MAIN_STEPS.find((step) => step !== 'totp' && !done[step]) as PublishingSummary);
  return { summary, main, other };
}

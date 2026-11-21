import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleDashed, Clapperboard, Lock, Play, Sparkles, SquareCheck, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { Bidi, Button, fmt, focusRing, IconButton, Lightbox, longDate, Ltr, num, RoleBadge, showToast, Tooltip } from '../../../today/v5-peacock-app/kit';
import { messages } from '../i18n';
import { Compare } from './compare';
import { sayText, type Run } from './live';
import { StageStepper, useLiveWords } from './live-ui';
import { mediaUrl } from './media';
import { blockersOf, type NumberedStep, type PhaseGroup } from './model';
import { toneOf } from './tone';

const ease = [0.2, 0.7, 0.2, 1] as const;

function StepChip({ step, onOpen }: { step: NumberedStep; onOpen: (id: string) => void }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={() => onOpen(step.id)}
      className={cn('flex w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-start hover:bg-accent', focusRing)}
    >
      <span aria-hidden className={cn('grid size-5 shrink-0 place-items-center rounded-full border-2', step.done ? 'border-success bg-success text-success-foreground' : 'border-border text-muted-foreground')}>
        {step.done ? <Check className="size-3" strokeWidth={3} /> : <CircleDashed className="size-3" strokeWidth={2} />}
      </span>
      <Ltr className="shrink-0 text-caption font-semibold text-muted-foreground tabular-nums">{num(step.n, locale)}</Ltr>
      <span dir="auto" className="ps-clamp-2 min-w-0 flex-1 text-body-sm text-foreground">
        {step.title}
      </span>
      <span className="sr-only">{step.done ? t.stateDone : t.stateTodo}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="text-body-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * A step opened from the chapter, the waffle or Claude's card: a side drawer from the page's end edge. It holds why the step
 * exists, its acceptance checks, what it waits for and what it unlocks (each a link to that step), Claude's stages when it is
 * running, and its evidence: the before / after compare, the clip, and every image in the lightbox. Radix traps focus, Esc
 * closes, focus returns to the opener.
 */
export function StepDrawer({
  step,
  groups,
  nextId,
  run,
  onOpenStep,
  onClose,
}: {
  step: NumberedStep | null;
  groups: PhaseGroup[];
  nextId: string | null;
  run: Run | null;
  onOpenStep: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const words = useLiveWords();
  const [shot, setShot] = useState<number | null>(null);
  const all = groups.flatMap((g) => g.steps);
  const group = step ? groups.find((g) => g.steps.some((s) => s.id === step.id)) : undefined;
  const blockers = step ? blockersOf(step, all) : [];
  const deps = step ? (step.after ?? []).map((id) => all.find((s) => s.id === id)).filter((s): s is NumberedStep => !!s) : [];
  const unlocks = step ? all.filter((s) => s.after?.includes(step.id)) : [];
  const live = !!step && run?.stepId === step.id;
  const evidence = step?.evidence ?? [];
  const before = evidence.find((e) => e.kind === 'before');
  const after = evidence.find((e) => e.kind === 'after');
  const videos = evidence.filter((e) => e.kind === 'video');
  const images = evidence
    .filter((e) => e.kind !== 'video')
    .map((e) => ({ src: mediaUrl(e.src) ?? '', name: e.caption, alt: e.caption }))
    .filter((img) => img.src);
  const checks = (step?.acceptance ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <Dialog.Root open={!!step} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {step && (
          <Dialog.Portal forceMount container={document.getElementById('hub-root')}>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="ps-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                key="drawer"
                data-tone={group ? toneOf(group.index) : '0'}
                className="ps-drawer"
                initial={{ x: locale === 'ar' ? '-100%' : '100%' }}
                animate={{ x: 0 }}
                exit={{ x: locale === 'ar' ? '-100%' : '100%' }}
                transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              >
                <div className="ps-tone-soft flex min-w-0 items-start gap-3 border-b border-border p-4">
                  <span aria-hidden className={cn('grid size-10 shrink-0 place-items-center rounded-xl text-body-lg font-bold', step.done ? 'ps-tone-bg' : 'border-2 ps-tone-border ps-tone-fg bg-card')}>
                    {step.done ? <Check className="size-5" strokeWidth={3} /> : <Ltr>{num(step.n, locale)}</Ltr>}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="ps-tone-fg text-caption font-semibold">
                      {fmt(t.stepNo, { n: num(step.n, locale) })}
                      {group?.phase && ` · ${fmt(t.phase, { n: num(group.index, locale) })}: ${group.phase.title}`}
                    </p>
                    <Dialog.Title dir="auto" className="text-title-sm font-bold text-pretty text-foreground">
                      <Bidi>{step.title}</Bidi>
                    </Dialog.Title>
                  </div>
                  <Dialog.Close asChild>
                    <IconButton label={t.closeDrawer}>
                      <X className="size-5" strokeWidth={1.75} />
                    </IconButton>
                  </Dialog.Close>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
                  <motion.div
                    className="flex min-w-0 flex-col gap-5"
                    key={step.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease, delay: 0.08 }}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      {step.done ? (
                        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-success-soft px-2 text-caption font-semibold text-success-soft-foreground">
                          <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                          {step.doneAt ? fmt(t.doneOn, { date: longDate(step.doneAt, locale) }) : t.stateDone}
                        </span>
                      ) : step.id === nextId ? (
                        <span className="ps-tone-bg inline-flex h-6 items-center rounded-full px-2 text-caption font-semibold">{t.next}</span>
                      ) : null}
                      {blockers.length > 0 && (
                        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-warning-soft px-2 text-caption font-semibold text-warning-soft-foreground">
                          <Lock aria-hidden className="size-3.5" strokeWidth={2} />
                          {fmt(t.blockedBy, { list: blockers.map((b) => fmt(t.stepRef, { n: num(b.n, locale) })).join('، ') })}
                        </span>
                      )}
                      {step.size && (
                        <Tooltip content={t.effortHint}>
                          <span tabIndex={0} className={cn('inline-flex h-6 items-center gap-1 rounded-full border border-border px-2 text-caption text-foreground', focusRing)}>
                            {t.sizeLabel}: <Ltr className="font-semibold">{step.size}</Ltr> · {t.sizes[step.size]}
                          </span>
                        </Tooltip>
                      )}
                      {step.taskKey && (
                        <span className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card px-2 text-caption text-muted-foreground">
                          <SquareCheck aria-hidden className="size-3.5 text-type-task-fg" strokeWidth={2} />
                          {t.taskLabel} <Ltr mono>{step.taskKey}</Ltr>
                        </span>
                      )}
                      {step.role && <RoleBadge role={step.role} />}
                    </div>

                    {live && run && (
                      <div className="ps-claude flex flex-col gap-2.5 rounded-xl p-3">
                        <p className="flex items-center gap-1.5 text-body-sm font-semibold text-foreground">
                          <Sparkles aria-hidden className="size-4 text-primary" strokeWidth={2} />
                          {fmt(t.claudeWorking, { n: num(step.n, locale) })}
                        </p>
                        <StageStepper stages={run.stages} />
                        <p className="text-body-sm text-muted-foreground">
                          <Bidi>{sayText(words, run.note)}</Bidi>
                        </p>
                      </div>
                    )}

                    <Section title={t.why}>
                      <p dir="auto" className={cn('text-body text-pretty', step.why ? 'text-foreground' : 'text-muted-foreground')}>
                        {step.why ?? t.noWhy}
                      </p>
                    </Section>

                    <Section title={t.acceptance}>
                      {checks.length === 0 ? (
                        <p className="text-body-sm text-muted-foreground">{t.noAcceptance}</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {checks.map((c, i) => (
                            <motion.li
                              key={c}
                              initial={{ opacity: 0, x: locale === 'ar' ? 12 : -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.25, delay: 0.12 + i * 0.06 }}
                              className="flex items-start gap-2 text-body-sm text-foreground"
                            >
                              <span aria-hidden className={cn('mt-0.5 grid size-4.5 shrink-0 place-items-center rounded border-2', step.done ? 'ps-tone-bg ps-tone-border' : 'border-border')}>
                                {step.done && <Check className="size-3" strokeWidth={3} />}
                              </span>
                              <span dir="auto">{c}</span>
                            </motion.li>
                          ))}
                        </ul>
                      )}
                    </Section>

                    {deps.length === 0 && unlocks.length === 0 ? (
                      <p className="text-body-sm text-muted-foreground">{t.noDeps}</p>
                    ) : (
                      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                        {deps.length > 0 && (
                          <Section title={t.dependsOn}>
                            <div className="flex flex-col gap-1.5">
                              {deps.map((d) => (
                                <StepChip key={d.id} step={d} onOpen={onOpenStep} />
                              ))}
                            </div>
                          </Section>
                        )}
                        {unlocks.length > 0 && (
                          <Section title={t.unlocks}>
                            <div className="flex flex-col gap-1.5">
                              {unlocks.map((d) => (
                                <StepChip key={d.id} step={d} onOpen={onOpenStep} />
                              ))}
                            </div>
                          </Section>
                        )}
                      </div>
                    )}

                    <Section title={t.evidenceTitle}>
                      {evidence.length === 0 ? (
                        <p className="text-body-sm text-muted-foreground">{t.noEvidence}</p>
                      ) : (
                        <div className="flex min-w-0 flex-col gap-3">
                          {before && after && mediaUrl(before.src) && mediaUrl(after.src) && <Compare before={mediaUrl(before.src)!} after={mediaUrl(after.src)!} beforeAlt={before.caption} afterAlt={after.caption} />}
                          {videos.map((v) => (
                            <figure key={v.id} className="flex flex-col gap-1.5">
                              <video className="ps-video" src={mediaUrl(v.src)} poster={v.poster ? mediaUrl(v.poster) : undefined} controls preload="metadata" playsInline />
                              <figcaption dir="auto" className="text-caption text-muted-foreground">
                                {v.caption}
                              </figcaption>
                            </figure>
                          ))}
                          {images.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {images.map((img, i) => (
                                <button
                                  key={img.src}
                                  type="button"
                                  onClick={() => setShot(i)}
                                  aria-label={`${t.openShots}: ${img.name}`}
                                  className={cn('overflow-hidden rounded-lg border border-border bg-muted', focusRing)}
                                >
                                  <img src={img.src} alt="" className="h-16 w-28 object-cover object-top" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Section>
                  </motion.div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
                  {!step.done && (
                    <Button variant={blockers.length ? 'outline' : 'primary'} disabled={live} onClick={() => showToast({ message: fmt(t.queued, { n: num(step.n, locale) }) })}>
                      <Play aria-hidden className="size-4" strokeWidth={2} />
                      {t.runWithClaude}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => showToast({ message: fmt(t.hams.stepVideoToast, { n: num(step.n, locale) }) })}>
                    <Clapperboard aria-hidden className="size-4" strokeWidth={1.75} />
                    {t.hams.stepVideo}
                  </Button>
                </div>
                <Lightbox images={images} index={shot ?? 0} open={shot !== null} onOpenChange={(o) => !o && setShot(null)} onIndexChange={setShot} />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

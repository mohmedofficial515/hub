/** Top bar (book title, search, contents on narrow screens, lab preview), the sticky save bar and the toast. */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BookOpen, FlaskConical, List, X } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import type { SectionId } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { useBook, type Phase, type Viewer } from './store';
import { docOf, fill, plural } from './model';
import { SearchBox } from './search';
import { Toc } from './overview';
import { IconButton, PopContent, PopRoot, PopTrigger, Segmented, btn } from './ui';

export function TopBar({ active }: { active: SectionId | null }) {
  const book = useBook();
  const { t } = book;
  const [toc, setToc] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <D.Root open={toc} onOpenChange={setToc}>
          <D.Trigger asChild>
            <IconButton label={t.ui.openContents} className="-ms-2 lg:hidden">
              <List className="size-5" aria-hidden />
            </IconButton>
          </D.Trigger>
          <D.Portal>
            <D.Overlay className="fixed inset-0 z-50 bg-foreground/35 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none dark:bg-black/60" />
            <D.Content className="fixed inset-y-0 start-0 z-50 w-[min(20rem,88vw)] overflow-y-auto bg-background px-3 py-4 shadow-2xl outline-none data-[state=open]:animate-in ltr:data-[state=open]:slide-in-from-left rtl:data-[state=open]:slide-in-from-right motion-reduce:animate-none">
              <div className="mb-3 flex items-center justify-between px-2">
                <D.Title className="text-16 font-extrabold">{t.ui.bookTitle}</D.Title>
                <D.Close asChild>
                  <IconButton label={t.ui.closeContents}>
                    <X className="size-5" aria-hidden />
                  </IconButton>
                </D.Close>
              </div>
              <D.Description className="sr-only">{t.ui.contents}</D.Description>
              <Toc active={active} onPick={() => setToc(false)} />
            </D.Content>
          </D.Portal>
        </D.Root>
        <button
          type="button"
          onClick={() => book.go({ view: 'overview' })}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl text-16 font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-10"
        >
          <BookOpen className="size-5 text-primary" aria-hidden />
          {t.ui.bookTitle}
        </button>
        <SearchBox className="order-last w-full sm:order-none sm:mx-auto sm:w-auto sm:max-w-md sm:flex-1" />
        <LabPanel />
      </div>
    </header>
  );
}

function LabPanel() {
  const { t, viewer, setViewer, phase, setPhase } = useBook();
  return (
    <PopRoot>
      <PopTrigger asChild>
        <button type="button" className={cn(btn('quiet', 'sm'), 'ms-auto sm:ms-0')}>
          <FlaskConical className="size-4" aria-hidden />
          <span className="hidden md:inline">{t.ui.labTitle}</span>
          <span className="sr-only md:hidden">{t.ui.labTitle}</span>
        </button>
      </PopTrigger>
      <PopContent align="end" className="grid gap-4">
        <div>
          <p className="text-15 font-extrabold">{t.ui.labTitle}</p>
          <p className="text-12 text-muted-foreground">{t.ui.labNote}</p>
        </div>
        <div className="grid gap-1.5">
          <p className="text-13 font-bold">{t.ui.labViewer}</p>
          <Segmented<Viewer>
            label={t.ui.labViewer}
            value={viewer}
            onChange={setViewer}
            size="sm"
            options={[
              { value: 'owner', label: t.ui.labOwner },
              { value: 'staff', label: t.ui.labStaff },
            ]}
          />
        </div>
        <div className="grid gap-1.5">
          <p className="text-13 font-bold">{t.ui.labState}</p>
          <Segmented<Phase>
            label={t.ui.labState}
            value={phase}
            onChange={setPhase}
            size="sm"
            options={[
              { value: 'ready', label: t.ui.labReady },
              { value: 'loading', label: t.ui.labLoading },
              { value: 'empty', label: t.ui.labEmpty },
              { value: 'error', label: t.ui.labError },
            ]}
          />
        </div>
      </PopContent>
    </PopRoot>
  );
}

export function SaveBar() {
  const book = useBook();
  const { t, locale, route } = book;
  const reduce = useReducedMotion();
  const key = route.view === 'group' ? route.key : null;
  const n = key ? book.draftCount(key) : 0;
  const restoring = key ? book.restoring(key) : undefined;
  const approval = key ? docOf(key)?.group?.approval === 'second-approver' : false;
  return (
    <AnimatePresence>
      {key && n ? (
        <motion.div
          role="region"
          aria-label={t.ui.unsaved}
          initial={reduce ? { opacity: 0 } : { y: '100%' }}
          animate={reduce ? { opacity: 1 } : { y: 0 }}
          exit={reduce ? { opacity: 0 } : { y: '100%' }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.18)] backdrop-blur"
        >
          <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8 lg:ps-[calc(14.5rem+4.5rem)]">
            <p className="flex min-w-0 flex-1 items-center gap-3 text-14 font-semibold">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/35 text-14 font-extrabold tabular-nums text-foreground dark:bg-warning/25">
                {n}
              </span>
              <span className="min-w-0">
                {restoring
                  ? fill(t.ui.saveBarRestore, { v: restoring })
                  : fill(t.ui.saveBar, { n: plural(n, 'changeNom', locale, t), group: docOf(key)?.title[locale] ?? '' })}
              </span>
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <button type="button" className={cn(btn('outline'), 'flex-1 sm:flex-none')} onClick={() => book.discard(key)}>
                {t.ui.discard}
              </button>
              <button type="button" className={cn(btn('primary'), 'flex-[2] sm:flex-none')} onClick={() => book.openReview(key)}>
                {approval ? t.ui.reviewApproval : t.ui.review}
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function ToastView() {
  const book = useBook();
  const { toast, dismissToast, route, t } = book;
  const [hover, setHover] = useState(false);
  const barUp = route.view === 'group' && book.draftCount(route.key) > 0;
  useEffect(() => {
    if (!toast || hover) return;
    const id = window.setTimeout(dismissToast, 6000);
    return () => window.clearTimeout(id);
  }, [toast, hover, dismissToast]);
  return (
    <div aria-live="polite" className={cn('pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4', barUp ? 'bottom-36 sm:bottom-24' : 'bottom-6')}>
      {toast ? (
        <div
          key={toast.id}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="pointer-events-auto flex max-w-lg items-center gap-3 rounded-2xl bg-foreground px-4 py-2.5 text-14 text-background shadow-xl"
        >
          <span className="min-w-0 flex-1">{toast.text}</span>
          {toast.action ? (
            <button
              type="button"
              className="min-h-10 rounded-lg px-2 font-bold underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-background"
              onClick={() => {
                toast.action?.run();
                dismissToast();
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
          <button type="button" aria-label={t.ui.back} onClick={dismissToast} className="flex size-10 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-background">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

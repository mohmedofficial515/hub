import type { ReactNode } from 'react';
import { ExternalLink, FileText, Folder, Images, Library, Lightbulb, Link2, Lock, Route as RouteIcon, Scale, type LucideIcon } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { PlanAttachment, PlanDecision, PlanLink, PlanSource } from '@lab/mocks/hub-plan-page';
import { Bidi, CopyButton, focusRing, kitMessages, longDate, Ltr, num, plural, PriorityBadge, roleIcon, StatusBadge } from '../../../today/v5-peacock-app/kit';
import { messages } from '../i18n';
import { ideaBuckets } from './model';

const media = import.meta.glob<string>('../media/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' });

/** A titled surface: one neutral border on all four sides; the colour is the icon's only (D31). */
export function Panel({ id, icon: Icon, iconClass, title, count, aside, children, className }: { id: string; icon: LucideIcon; iconClass: string; title: string; count?: number; aside?: ReactNode; children: ReactNode; className?: string }) {
  const locale = useLocale();
  return (
    <section aria-labelledby={id} className={cn('min-w-0 rounded-xl border border-border bg-card', className)}>
      <header className="flex min-w-0 items-center gap-2 px-4 pt-3.5 pb-2">
        <Icon aria-hidden className={cn('size-4 shrink-0', iconClass)} strokeWidth={1.75} />
        <h2 id={id} className="min-w-0 flex-1 text-body font-semibold text-foreground">
          {title}
          {count !== undefined && (
            <span className="ms-1.5 text-body-sm font-normal text-muted-foreground tabular-nums">
              <Ltr>{num(count, locale)}</Ltr>
            </span>
          )}
        </h2>
        {aside}
      </header>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

export function DecisionsBox({ decisions }: { decisions: PlanDecision[] }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const latest = decisions.map((d) => d.decidedAt).sort().at(-1);
  return (
    <Panel
      id="plan-decisions"
      icon={Scale}
      iconClass="text-type-decision-fg"
      title={t.decisions}
      count={decisions.length || undefined}
      aside={latest && <span className="shrink-0 text-caption text-muted-foreground">{longDate(latest, locale)}</span>}
    >
      {decisions.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">{t.noDecisions}</p>
      ) : (
        <dl className="flex flex-col divide-y divide-border">
          {decisions.map((d) => (
            <div key={d.id} className="flex flex-col gap-0.5 py-2.5 first:pt-1 last:pb-0">
              <dt dir="auto" className="text-body-sm font-semibold text-foreground">
                <Bidi>{d.topic}</Bidi>
              </dt>
              <dd dir="auto" className="m-0 text-body-sm text-muted-foreground text-pretty">
                <Bidi>{d.choice}</Bidi>
                <span className="sr-only">
                  {' '}
                  ({kit.roles.owner}, {longDate(d.decidedAt, locale)})
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}

const hubHref = (key: string) => `http://127.0.0.1:7300/ar/goteav/planning?plan=${key}`;

function CardLine({ link, icon: Icon, iconClass, meta }: { link: PlanLink; icon: LucideIcon; iconClass: string; meta?: ReactNode }) {
  const kit = useT(kitMessages);
  const Role = link.card.ownerRole ? roleIcon[link.card.ownerRole] : null;
  return (
    <a
      href={hubHref(link.card.key)}
      target="_blank"
      rel="noreferrer"
      className={cn('flex min-h-11 min-w-0 items-start gap-2.5 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-accent md:min-h-0', focusRing)}
    >
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', iconClass)} strokeWidth={1.75} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span dir="auto" className="line-clamp-2 text-body-sm text-foreground">
          <Bidi>{link.card.title}</Bidi>
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
          <Ltr mono>{link.card.key}</Ltr>
          {Role && link.card.ownerRole && (
            <span className="inline-flex items-center gap-1">
              <Role aria-hidden className="size-3" strokeWidth={1.75} />
              {kit.roles[link.card.ownerRole]}
            </span>
          )}
          {meta}
        </span>
      </span>
    </a>
  );
}

export function IdeasBox({ links }: { links: PlanLink[] }) {
  const t = useT(messages);
  const locale = useLocale();
  const buckets = ideaBuckets(links);
  const total = buckets.reduce((n, b) => n + b.ideas.length, 0);
  return (
    <Panel id="plan-ideas" icon={Lightbulb} iconClass="text-type-idea-fg" title={t.ideas} count={total || undefined}>
      {total === 0 ? (
        <p className="text-body-sm text-muted-foreground">{t.noIdeas}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-caption text-muted-foreground">{t.bucketHint}</p>
          {buckets.map(({ bucket, ideas }) => (
            <section key={bucket} aria-labelledby={`bucket-${bucket}`} className="flex min-w-0 flex-col gap-0.5">
              <h3 id={`bucket-${bucket}`} className="flex items-center gap-2 px-2 pb-1 text-body-sm font-semibold text-foreground">
                {t.bucket[bucket]}
                <span className="text-caption font-normal text-muted-foreground">{plural(ideas.length, locale, t.ideasWord)}</span>
                <span aria-hidden className="h-px flex-1 bg-border" />
              </h3>
              <ul className="-mx-2 flex flex-col">
                {ideas.map((l) => (
                  <li key={l.card.key}>
                    <CardLine link={l} icon={Lightbulb} iconClass="text-type-idea-fg" meta={<PriorityBadge priority={l.card.priority} />} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function PlansBox({ links }: { links: PlanLink[] }) {
  const t = useT(messages);
  if (links.length === 0) return null;
  return (
    <Panel id="plan-related" icon={RouteIcon} iconClass="text-type-plan-fg" title={t.plans} count={links.length}>
      <ul className="-mx-2 flex flex-col">
        {links.map((l) => (
          <li key={l.card.key}>
            <CardLine link={l} icon={RouteIcon} iconClass="text-type-plan-fg" meta={<StatusBadge status={l.card.status} />} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const sourceIcon: Record<PlanSource['kind'], LucideIcon> = { folder: Folder, file: FileText, hub_source: Library, link: Link2 };

function SourceRow({ source }: { source: PlanSource }) {
  const t = useT(messages);
  const Icon = sourceIcon[source.kind];
  const name = source.ref.split('/').filter(Boolean).at(-1) ?? source.ref;
  const head = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span dir="auto" className="text-body-sm text-foreground">
          <Bidi>{source.title}</Bidi>
        </span>
        {source.note && <span dir="auto" className="text-caption text-muted-foreground">{source.note}</span>}
        {source.privateLink && (
          <span className="inline-flex items-center gap-1 text-caption text-muted-foreground">
            <Lock aria-hidden className="size-3" strokeWidth={1.75} />
            {t.privateLink}
          </span>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
        <span className="shrink-0">{t.sourceKind[source.kind]}</span>
        <Ltr mono className="min-w-0 truncate" >
          <span title={source.ref}>{source.kind === 'link' ? source.ref.replace(/^https?:\/\//, '') : name}</span>
        </Ltr>
      </span>
    </span>
  );
  if (source.kind === 'link') {
    return (
      <a
        href={source.ref}
        target="_blank"
        rel="noreferrer"
        aria-describedby="open-new-tab"
        className={cn('flex min-h-11 min-w-0 items-start gap-2.5 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-accent md:min-h-0', focusRing)}
      >
        <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
        {head}
        <ExternalLink aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground rtl:-scale-x-100" strokeWidth={1.75} />
      </a>
    );
  }
  return (
    <div className="flex min-w-0 items-start gap-2.5 px-2 py-2">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      {head}
      <CopyButton text={source.ref} label={`${t.copyPath}: ${source.ref}`} showText={false} compact className="-my-1 shrink-0" />
    </div>
  );
}

export function SourcesBox({ sources, attachments, onShots }: { sources: PlanSource[]; attachments: PlanAttachment[]; onShots: () => void }) {
  const t = useT(messages);
  const locale = useLocale();
  const shots = attachments.filter((a) => a.kind === 'screenshot');
  const total = sources.length + (shots.length ? 1 : 0);
  return (
    <Panel id="plan-sources" icon={Library} iconClass="text-type-doc-fg" title={t.sources} count={total || undefined}>
      <span id="open-new-tab" className="sr-only">
        {t.openLink}
      </span>
      {total === 0 ? (
        <p className="text-body-sm text-muted-foreground">{t.noSources}</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {sources.map((s) => (
            <li key={s.id}>
              <SourceRow source={s} />
            </li>
          ))}
          {shots.length > 0 && (
            <li>
              <button
                type="button"
                onClick={onShots}
                className={cn('flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-start transition-colors duration-150 hover:bg-accent md:min-h-0', focusRing)}
              >
                <Images aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-body-sm text-foreground">{t.attachmentsRow}</span>
                  <span className="text-caption text-muted-foreground">{plural(shots.length, locale, t.shotsWord)}</span>
                </span>
                <span aria-hidden className="flex shrink-0 -space-x-2">
                  {shots.slice(0, 4).map((a) => (
                    <img key={a.id} src={media[`../media/${a.url}`]} alt="" className="size-8 rounded-md border-2 border-card bg-muted object-cover object-top" />
                  ))}
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}

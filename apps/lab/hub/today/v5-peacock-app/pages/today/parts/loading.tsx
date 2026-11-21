import { useT } from '@lab/i18n';
import { LoadingRegion, Skeleton, SkeletonRow, useMedia } from '../../../kit';
import { messages } from '../i18n';

function BandSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5 bg-card px-3 py-2.5 max-md:last:col-span-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function LetterSkeleton({ framed, lines }: { framed: boolean; lines: number }) {
  return (
    <div className={framed ? 'flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4' : 'flex flex-col gap-2.5'}>
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? 'h-4 w-2/3' : 'h-4 w-full'} />
      ))}
      <Skeleton className="mt-1 h-8 w-40" />
    </div>
  );
}

function StackSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

function ReadSkeleton() {
  return (
    <>
      <Skeleton className="h-5 w-40" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-6 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
}

function TeamAndSources() {
  return (
    <>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-44" />
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5 bg-card px-3 py-2.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * First load only (a refresh keeps the page, review M7). Same blocks, same order and about the same heights as the
 * loaded page at each width, including team and sources, so nothing jumps when the data lands.
 */
export function LoadingView() {
  const t = useT(messages);
  const wide = useMedia('(min-width: 768px)');
  if (!wide) {
    return (
      <LoadingRegion label={t.loading} className="gap-6">
        <LetterSkeleton framed lines={3} />
        <StackSkeleton />
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="flex flex-col gap-3">
          <ReadSkeleton />
        </div>
        <BandSkeleton />
        <TeamAndSources />
      </LoadingRegion>
    );
  }
  return (
    <LoadingRegion label={t.loading} className="gap-8">
      <BandSkeleton />
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-7">
          <StackSkeleton />
          <Skeleton className="h-19 w-full rounded-lg" />
        </div>
        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-5 lg:col-span-5">
          <LetterSkeleton framed={false} lines={6} />
          <div className="mt-4 flex flex-col gap-3">
            <ReadSkeleton />
          </div>
        </div>
      </div>
      <TeamAndSources />
    </LoadingRegion>
  );
}

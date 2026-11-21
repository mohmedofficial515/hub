/** Section 9: states of the money display and of the switcher. Two of them (catalogue, flag) act on the whole page, header included. */
import { useState, type ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Badge } from '@dash/components/ui/badge';
import { Button } from '@dash/components/ui/button';
import { Card } from '@dash/components/ui/card';
import { Skeleton } from '@dash/components/ui/skeleton';
import { AmountView } from './amount';
import { useLab } from './env';
import { EstimatedTag } from './receipt';

function StateCard({ title, body, children, action }: { title: string; body: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card className="min-w-0 gap-3 rounded-2xl border bg-card p-4 shadow-none sm:p-5">
      <div className="min-w-0">
        <h3 className="text-14 font-extrabold">{title}</h3>
        <p className="mt-0.5 text-12 text-muted-foreground">{body}</p>
      </div>
      <div className="grid min-h-16 min-w-0 content-center gap-2 rounded-xl bg-muted/40 p-3 text-18 font-bold">{children}</div>
      {action}
    </Card>
  );
}

export function States() {
  const lab = useLab();
  const { t, catalogReady, setCatalogReady, switcherEnabled, setSwitcherEnabled } = lab;
  const [failed, setFailed] = useState(true);
  const s = t.states;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
      <StateCard
        title={s.loading.title}
        body={s.loading.body}
        action={
          <Button type="button" variant="outline" className="h-11 w-fit rounded-lg sm:h-9" onClick={() => setCatalogReady(!catalogReady)}>
            {catalogReady ? s.loading.on : s.loading.off}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <AmountView value="1250.00" currency="SAR" context="detail" />
          <AmountView value="12450.75" currency="USD" context="detail" />
        </div>
        {!catalogReady && <Badge variant="outline" className="w-fit text-11">{s.loading.badge}</Badge>}
      </StateCard>

      <StateCard title={s.unknown.title} body={s.unknown.body}>
        <AmountView value="1250.00" currency="XYZ" context="detail" />
        <AmountView value="3400.5" currency="QAR" context="detail" />
      </StateCard>

      <StateCard title={s.nullValue.title} body={s.nullValue.body}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <AmountView value={null} currency="USD" />
          <AmountView value="not-a-number" currency="USD" />
        </div>
      </StateCard>

      <StateCard title={s.stale.title} body={s.stale.body}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="border-b-2 border-dotted border-muted-foreground pb-0.5">
            <AmountView value="9040210.55" currency="SAR" context="kpi" />
          </span>
          <EstimatedTag days={2} />
          <Badge variant="attention" className="h-5 gap-1 px-1.5 text-11 font-semibold">
            <AlertTriangle aria-hidden />
            {s.stale.tag}
          </Badge>
        </div>
      </StateCard>

      <StateCard
        title={s.error.title}
        body={s.error.body}
        action={
          <Button type="button" variant="outline" className="h-11 w-fit gap-2 rounded-lg sm:h-9" onClick={() => setFailed((v) => !v)}>
            <RefreshCw className="size-4" aria-hidden />
            {failed ? s.error.retry : s.error.again}
          </Button>
        }
      >
        {failed ? (
          <div role="alert" className="flex items-center gap-2 text-13 font-semibold text-destructive-soft-foreground">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {s.error.message}
          </div>
        ) : (
          <Skeleton className="h-8 w-40 rounded-md" />
        )}
      </StateCard>

      <StateCard title={s.empty.title} body={s.empty.body}>
        <div className="flex items-center gap-3 text-13 font-semibold text-muted-foreground">
          <Inbox className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{s.empty.message}</span>
          <AmountView value={null} currency="USD" />
        </div>
      </StateCard>

      <StateCard
        title={s.flag.title}
        body={s.flag.body}
        action={
          <Button type="button" variant="outline" className="h-11 w-fit rounded-lg sm:h-9" onClick={() => setSwitcherEnabled(!switcherEnabled)}>
            {switcherEnabled ? s.flag.off : s.flag.on}
          </Button>
        }
      >
        <p className="text-13 font-medium text-muted-foreground">{switcherEnabled ? s.flag.enabled : s.flag.disabled}</p>
      </StateCard>
    </div>
  );
}

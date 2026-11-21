import { useT } from '@lab/i18n';
import { messages } from './i18n';

// Real primitives are imported live, e.g.:
// import { Button } from '@web/components/ui/button';
// import { Card } from '@dash/components/ui/card';

export default function Page() {
  const t = useT(messages);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold">{t.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>
      </header>
    </main>
  );
}

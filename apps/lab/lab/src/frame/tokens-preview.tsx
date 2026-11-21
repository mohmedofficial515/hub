import { useT } from '@lab/i18n';

const SWATCHES = [
  ['background', 'bg-background', 'text-foreground'],
  ['card', 'bg-card', 'text-card-foreground'],
  ['primary', 'bg-primary', 'text-primary-foreground'],
  ['secondary', 'bg-secondary', 'text-secondary-foreground'],
  ['muted', 'bg-muted', 'text-muted-foreground'],
  ['accent', 'bg-accent', 'text-accent-foreground'],
  ['destructive', 'bg-destructive', 'text-white'],
  ['popover', 'bg-popover', 'text-popover-foreground'],
] as const;

const TYPE = ['text-4xl font-bold', 'text-2xl font-semibold', 'text-lg font-medium', 'text-base', 'text-sm text-muted-foreground'];
const RADII = ['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl'];

const messages = {
  ar: { title: 'رموز التصميم الحالية', colors: 'الألوان', type: 'الخطوط', radius: 'الزوايا', sample: 'احجز رحلتك القادمة بسهولة' },
  en: { title: 'Current design tokens', colors: 'Colors', type: 'Typography', radius: 'Radius', sample: 'Book your next trip with ease' },
};

/** Live view of the tokens imported from the real project's globals.css. */
export function TokensPreview() {
  const t = useT(messages);
  return (
    <main className="min-h-dvh bg-background p-6 text-foreground md:p-10">
      <h1 className="text-2xl font-bold">{t.title}</h1>

      <h2 className="mt-8 mb-3 font-semibold">{t.colors}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {SWATCHES.map(([name, bg, fg]) => (
          <div key={name} className={`${bg} ${fg} flex h-24 items-end rounded-lg border border-border p-3 text-sm`}>
            {name}
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 font-semibold">{t.type}</h2>
      <div className="space-y-2">
        {TYPE.map((cls) => (
          <p key={cls} className={cls}>
            {t.sample}
          </p>
        ))}
      </div>

      <h2 className="mt-8 mb-3 font-semibold">{t.radius}</h2>
      <div className="flex flex-wrap gap-3">
        {RADII.map((cls) => (
          <div key={cls} className={`${cls} grid size-20 place-items-center border border-border bg-muted text-xs`}>
            {cls.replace('rounded-', '')}
          </div>
        ))}
      </div>
    </main>
  );
}

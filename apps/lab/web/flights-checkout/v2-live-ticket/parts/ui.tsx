/**
 * Version-local primitives. They follow 05-design-system-audit.md B.1–B.5: 8px controls, 18px cards, a hairline
 * instead of a shadow, 2px only for selection and focus, the navy focus ring, one `action` button per view.
 */
import { useId, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes } from 'react';
import { AlertTriangle, Check, ChevronDown, CircleAlert, Info } from 'lucide-react';
import { cn } from '@lab/utils';

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)';

type ButtonVariant = 'action' | 'outline' | 'ghost';

export function Button({
  variant = 'outline',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-bold whitespace-nowrap transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed',
        focusRing,
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-base',
        variant === 'action' && 'bg-(--action) text-(--action-foreground) hover:bg-(--action-hover)',
        variant === 'outline' &&
          'border border-(--border-strong) bg-(--card) text-(--foreground) hover:bg-(--surface-2)',
        variant === 'ghost' && 'text-(--brand-ink) hover:bg-(--surface-2)',
        className,
      )}
    />
  );
}

export function SectionCard({
  title,
  hint,
  icon,
  aside,
  children,
  className,
  id,
}: {
  title: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} id={id} className={cn('rounded-2xl border border-(--border) bg-(--card)', className)}>
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-(--border) px-4 py-4 sm:px-6">
        {icon && (
          <span aria-hidden className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-(--brand-soft) text-(--brand-ink)">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-lg font-bold text-(--brand-ink)">
            {title}
          </h2>
          {hint && <p className="mt-1 text-sm leading-6 text-(--ink-muted)">{hint}</p>}
        </div>
        {aside}
      </header>
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function Field({
  label,
  help,
  error,
  warning,
  children,
  htmlFor,
  className,
}: {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  warning?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-(--foreground)">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-6 text-(--danger-ink)" role="alert">
          <CircleAlert aria-hidden className="mt-1 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : warning ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-6 text-(--warning-ink)">
          <AlertTriangle aria-hidden className="mt-1 size-4 shrink-0" />
          <span>{warning}</span>
        </p>
      ) : help ? (
        <p className="mt-1.5 text-xs leading-5 text-(--ink-muted)">{help}</p>
      ) : null}
    </div>
  );
}

const controlBase =
  'h-12 w-full min-w-0 rounded-md border bg-(--card) px-3 text-base text-(--foreground) transition-[border-color] duration-200 placeholder:text-(--ink-subtle) focus:outline-2 focus:-outline-offset-1 focus:outline-(--ring)';

export function TextInput({ invalid, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, invalid ? 'border-(--danger)' : 'border-(--input)', className)}
    />
  );
}

export function SelectInput({
  invalid,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative min-w-0">
      <select
        {...props}
        aria-invalid={invalid || undefined}
        className={cn(controlBase, 'appearance-none pe-9', invalid ? 'border-(--danger)' : 'border-(--input)', className)}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-(--ink-muted)" />
    </div>
  );
}

/** Radio group drawn as one bordered group with an inner divider. Selected = navy fill (selection colour). */
export function Segmented<V extends string>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: V | '';
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  name: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-semibold text-(--foreground)">{label}</legend>
      <div className="grid h-12 grid-cols-2 overflow-hidden rounded-md border border-(--input)">
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                'relative flex cursor-pointer items-center justify-center gap-1.5 text-sm font-semibold transition-colors duration-150',
                i > 0 && 'border-s border-(--input)',
                on ? 'bg-(--brand) text-(--brand-foreground)' : 'bg-(--card) text-(--foreground) hover:bg-(--surface-2)',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-(--ring)',
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {on && <Check aria-hidden className="size-4" />}
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm leading-6', disabled && 'cursor-not-allowed opacity-50')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] border transition-colors duration-150',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--ring)',
          checked ? 'border-(--brand) bg-(--brand) text-(--brand-foreground)' : 'border-(--input) bg-(--card)',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="text-(--foreground)">{children}</span>
    </label>
  );
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warning'; children: ReactNode; className?: string }) {
  const Icon = tone === 'warning' ? AlertTriangle : Info;
  return (
    <p
      className={cn(
        'flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm leading-6',
        tone === 'info' ? 'bg-(--info-soft) text-(--foreground)' : 'bg-(--warning-soft) text-(--foreground)',
        className,
      )}
    >
      <Icon aria-hidden className={cn('mt-1 size-4 shrink-0', tone === 'info' ? 'text-(--info-ink)' : 'text-(--warning-ink)')} />
      <span>{children}</span>
    </p>
  );
}

/** Amounts, codes and times: an LTR isolate with tabular Latin digits. */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" translate="no" className={cn('tabular-nums', className)}>
      {children}
    </bdi>
  );
}

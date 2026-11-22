/**
 * One cell of the search group: a small label over a strong value (references.md 8.1 pattern 3), opening a
 * popover. Popovers render in place (no portal) so they keep the version's scoped tokens; nothing above them is
 * transformed, so their fixed positioning stays true.
 */
import type { ReactNode, Ref } from 'react';
import { Popover } from 'radix-ui';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@lab/utils';

export const focusRing =
  'outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)';

interface FieldProps {
  id: string;
  label: string;
  icon: LucideIcon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The chosen value; `null` shows the placeholder. */
  value: ReactNode | null;
  placeholder: string;
  invalid?: boolean;
  errorId?: string;
  /** Called when the popover closes: an element id moves focus there, '' leaves it alone, null returns it here. */
  focusAfterClose?: () => string | null;
  className?: string;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
  triggerRef?: Ref<HTMLButtonElement>;
  disabled?: boolean;
}

export function Field({
  id,
  label,
  icon: Icon,
  open,
  onOpenChange,
  value,
  placeholder,
  invalid,
  errorId,
  focusAfterClose,
  className,
  contentClassName,
  align = 'start',
  children,
  triggerRef,
  disabled,
}: FieldProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          className={cn(
            'group/field relative flex min-h-[72px] w-full min-w-0 flex-col justify-center gap-0.5 px-4 py-3 text-start transition-colors duration-150',
            'hover:bg-(--surface-2) data-[state=open]:bg-(--surface-2)',
            'outline-none focus-visible:z-10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)',
            'disabled:cursor-not-allowed disabled:opacity-50',
            invalid && 'z-[1] outline-solid outline-2 -outline-offset-2 outline-(--danger)',
            className,
          )}
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-(--ink-muted)">
            <Icon className="size-4 shrink-0" aria-hidden strokeWidth={1.75} />
            {label}
          </span>
          {value ?? <span className="truncate text-base font-medium text-(--ink-muted)">{placeholder}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Content
        align={align}
        sideOffset={8}
        collisionPadding={12}
        onCloseAutoFocus={(event) => {
          // null: back to this field; '': leave focus where it is (another popover took it); an id: go there.
          const next = focusAfterClose?.() ?? null;
          if (next !== null) {
            event.preventDefault();
            if (next) document.getElementById(next)?.focus();
          }
        }}
        className={cn(
          'z-40 max-h-(--radix-popover-content-available-height) overflow-y-auto rounded-2xl border border-(--border-strong) bg-(--popover) text-(--popover-foreground)',
          'origin-(--radix-popover-content-transform-origin) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]',
          contentClassName,
        )}
      >
        {children}
      </Popover.Content>
    </Popover.Root>
  );
}

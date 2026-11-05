import { useEffect, useId, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { Button, IconButton } from './button';
import { Field, Textarea } from './form';
import { portalRoot, useFocusReturn } from './hooks';
import { kitMessages } from './i18n';

/**
 * Centred dialog base (08 §3.4: 160 ms fade and scale). Traps focus, `Esc` closes, focus returns to the opener.
 * Full-width at the bottom edge on a phone.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const t = useT(kitMessages);
  const onCloseAutoFocus = useFocusReturn(open);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={portalRoot()}>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-(--scrim) motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150" />
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          // `autoFocus` loses to the sheet's focus trap when a dialog opens over it, so the field to land on is marked instead.
          onOpenAutoFocus={(e) => {
            const target = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-autofocus]');
            if (target) {
              e.preventDefault();
              target.focus();
            }
          }}
          className={cn(
            'fixed inset-x-0 bottom-0 z-[70] flex max-h-[90dvh] flex-col rounded-t-2xl border border-border bg-popover text-popover-foreground shadow-md outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-98 motion-safe:duration-150',
            'md:inset-x-auto md:start-1/2 md:top-1/2 md:bottom-auto md:w-full md:max-w-lg md:-translate-y-1/2 md:rounded-2xl md:ltr:-translate-x-1/2 md:rtl:translate-x-1/2',
            className,
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border p-4 md:p-5">
            <div className="min-w-0">
              <Dialog.Title className="text-title font-semibold text-foreground">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-body text-muted-foreground">{description}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <IconButton label={t.close} className="-me-1 -mt-1">
                <X aria-hidden className="size-4" strokeWidth={1.75} />
              </IconButton>
            </Dialog.Close>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">{children}</div>}
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4 md:p-5">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * 09 §19 ConfirmDialog, for destructive or irreversible actions (reject, cancel, revoke, archive, dismiss,
 * withdraw). `reason` adds a required field; `onConfirm` receives its text.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  reason = false,
  destructive = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  reason?: boolean;
  destructive?: boolean;
  onConfirm: (reason: string) => void;
}) {
  const t = useT(kitMessages);
  const id = useId();
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setText('');
      setTouched(false);
    }
  }, [open]);
  const missing = reason && !text.trim();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={() => {
              setTouched(true);
              if (missing) return;
              onConfirm(text.trim());
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {reason && (
        <Field id={id} label={t.confirm.reason} error={touched && missing ? t.confirm.reasonRequired : undefined} required>
          <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={3} data-autofocus />
        </Field>
      )}
    </Modal>
  );
}

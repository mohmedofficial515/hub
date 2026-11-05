import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { kitMessages } from './i18n';
import { focusRing } from './meta';
import { fmt } from './text';

/** Clipboard can be blocked inside the lab iframe, so it falls back to a hidden selection. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

export function CopyButton({
  text,
  label,
  showText = true,
  compact = false,
  className,
}: {
  /** What goes on the clipboard, and what the button shows in mono unless `showText` is false. */
  text: string;
  /** Accessible name. Defaults to "Copy <text>". */
  label?: string;
  showText?: boolean;
  /** 32 px on desktop instead of 36 px, for use inside sentences. Always 44 px on phones. */
  compact?: boolean;
  className?: string;
}) {
  const t = useT(kitMessages);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    await copyText(text);
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  };

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ?? fmt(t.copy.label, { text })}
      title={showText ? undefined : (label ?? fmt(t.copy.label, { text }))}
      className={cn(
        'relative z-10 inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-muted text-body-sm text-foreground transition-colors duration-150 hover:bg-accent',
        showText ? (compact ? 'h-11 px-2.5 md:h-8' : 'h-11 px-3 md:h-9') : 'size-11 justify-center md:size-9',
        focusRing,
        className,
      )}
    >
      {showText && (
        <code dir="ltr" translate="no" className="key truncate">
          {text}
        </code>
      )}
      <Icon aria-hidden className={cn('size-3.5 shrink-0', copied ? 'text-success-soft-foreground' : 'text-muted-foreground')} strokeWidth={1.75} />
      <span role="status" className="sr-only">
        {copied ? t.copy.copied : ''}
      </span>
    </button>
  );
}

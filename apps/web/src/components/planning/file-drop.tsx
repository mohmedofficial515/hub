'use client';

/**
 * @file file-drop.tsx
 * @description A file picker in the page's own words (owner, 2026-11-20): a zone to drop a file on, and a button that opens the system's chooser,
 * with the chosen file's name and size and any problem said under it. The native input stays in the page but out of sight, so the chooser,
 * the accept list and a screen reader's file control all still work; the zone itself is not a second control.
 */
import { FileUp, X } from 'lucide-react';
import { type DragEvent, useId, useRef, useState } from 'react';

import { Bidi, Button, cn, fmt, IconButton, useLocale } from '@/components/kit';

/** A size in the reader's numbers: bytes, KB or MB, one decimal at most. */
export function fileSize(bytes: number, locale: 'ar' | 'en'): string {
  const tag = locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB';
  const one = (n: number) => new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }).format(n);
  if (bytes < 1024) return `${one(bytes)} B`;
  if (bytes < 1024 * 1024) return `${one(bytes / 1024)} KB`;
  return `${one(bytes / (1024 * 1024))} MB`;
}

export interface FileDropWords {
  label: string;
  hint: string;
  drop: string;
  dropOr: string;
  choose: string;
  chosen: string;
  clearFile: string;
  dropActive: string;
}

export function FileDrop({
  accept,
  file,
  error,
  words,
  onFile,
}: {
  accept: string;
  file: File | null;
  error: string | null;
  words: FileDropWords;
  onFile: (file: File | null) => void;
}) {
  const locale = useLocale();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-body-sm font-medium text-foreground">
        {words.label}
      </label>
      <div
        data-pj-file-drop
        data-over={over}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={cn(
          'flex min-w-0 flex-col items-center gap-2 rounded-lg border-2 border-dashed px-3 py-4 text-center transition-colors duration-150 motion-reduce:transition-none',
          over ? 'border-primary bg-primary/5' : error ? 'border-destructive/60' : 'border-border',
        )}
      >
        <FileUp aria-hidden className="size-5 text-muted-foreground" strokeWidth={1.75} />
        <p className="text-body-sm text-muted-foreground">
          {over ? words.dropActive : `${words.drop} ${words.dropOr}`}
        </p>
        <Button size="sm" variant="outline" onClick={() => input.current?.click()} aria-describedby={hintId}>
          {words.choose}
        </Button>
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          tabIndex={-1}
          aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
          aria-invalid={!!error}
          onChange={(event) => {
            onFile(event.target.files?.[0] ?? null);
            // The same file chosen twice in a row still reaches the page.
            event.target.value = '';
          }}
        />
        {file && (
          <p
            data-pj-file-chosen
            className="flex min-w-0 max-w-full items-center gap-1 text-body-sm text-foreground"
          >
            <span className="min-w-0 truncate">
              <Bidi>{fmt(words.chosen, { name: file.name, size: fileSize(file.size, locale) })}</Bidi>
            </span>
            <IconButton label={words.clearFile} onClick={() => onFile(null)}>
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </IconButton>
          </p>
        )}
      </div>
      <p id={hintId} className="text-caption text-muted-foreground">
        {words.hint}
      </p>
      {error && (
        <p id={errorId} role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
          {error}
        </p>
      )}
    </div>
  );
}

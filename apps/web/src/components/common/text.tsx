'use client';

/**
 * @file text.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/text.tsx. Contract: apps/web/README.md.
 */
import { Fragment, type ReactNode } from 'react';

import { textDirection } from '@/lib/direction';
import { cn } from '@/lib/utils';

/** Replace `{name}` placeholders with plain values. */
export const fmt = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** Replace `{name}` placeholders with nodes, e.g. an LTR key inside an Arabic sentence. */
export function fill(template: string, slots: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    const slot = m?.[1];
    return <Fragment key={i}>{slot !== undefined && slot in slots ? slots[slot] : part}</Fragment>;
  });
}

/** Card keys, commands, branches, numbers with units: always an LTR isolate (docs/08 §4). */
export function Ltr({
  children,
  mono = false,
  className,
}: {
  children: ReactNode;
  mono?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <bdi dir="ltr" translate={mono ? 'no' : undefined} className={cn(mono && 'key', className)}>
      {children}
    </bdi>
  );
}

/** What must never reorder inside an Arabic sentence: 2026-11-10, 2%, GTV-231, v7-twin-tanks, GET /a/b, /hub:next. */
const ISOLATE =
  /(\d{4}-\d{2}-\d{2}|\d+(?:[.,]\d+)?%|\b[A-Z][A-Z0-9]{1,5}-\d+\b|\bv\d+-[\w-]+|(?:GET|POST|PUT|PATCH|DELETE) \/\S+|\/hub:\S+)/g;

const CARD_KEY = /^[A-Z][A-Z0-9]{1,5}-\d+$/;

/**
 * Render an API string (title, body) with its numbers and identifiers isolated (review: "(2%)" read "(%2)").
 * Use it wherever a mock or API sentence is shown; `fmt`/`fill` handle our own templates.
 */
export function Bidi({ children }: { children: string }) {
  // The whole string is isolated too and takes its direction from most of its letters: an English title's "?" stays at its end in the Arabic UI, and an Arabic line that opens with a product name stays Arabic.
  const dir = textDirection(children);
  // In a right-to-left line, an English aside in brackets is one left-to-right run with its own brackets, so a wrap
  // inside it never leaves "Refund →)" on one line and "(Wallet first" on the next (tour: mixed titles).
  const groups = dir === 'rtl' ? children.split(LATIN_ASIDE) : [children];
  if (groups.length === 1 && children.split(ISOLATE).length === 1) return <bdi dir={dir}>{children}</bdi>;
  return (
    <bdi dir={dir}>
      {groups.map((group, g) =>
        g % 2 === 1 ? (
          <bdi key={g} dir="ltr">
            {group}
          </bdi>
        ) : (
          <Fragment key={g}>{isolated(group)}</Fragment>
        ),
      )}
    </bdi>
  );
}

/** A bracketed aside with Latin letters and no Arabic ones: "(Refund → Wallet first)". */
const LATIN_ASIDE = /(\([^()\u0600-\u06FF]*[A-Za-z][^()\u0600-\u06FF]*\))/g;

function isolated(text: string): ReactNode[] {
  return text.split(ISOLATE).map((part, i) =>
    i % 2 === 1 ? (
      // A card key never breaks at its hyphen. A slug may: it can be longer than the line.
      <bdi key={i} dir="ltr" className={CARD_KEY.test(part) ? 'whitespace-nowrap' : undefined}>
        {part}
      </bdi>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

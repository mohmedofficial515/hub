import { Fragment, type ReactNode } from 'react';
import { cn } from '@lab/ui/hub-cn';

/** Replace `{name}` placeholders with plain values. */
export const fmt = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** Replace `{name}` placeholders with nodes, e.g. an LTR key inside an Arabic sentence. */
export function fill(template: string, slots: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return <Fragment key={i}>{m && m[1] in slots ? slots[m[1]] : part}</Fragment>;
  });
}

/** Card keys, commands, branches, numbers with units: always an LTR isolate (docs/08 §4). */
export function Ltr({ children, mono = false, className }: { children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <bdi dir="ltr" translate={mono ? 'no' : undefined} className={cn(mono && 'key', className)}>
      {children}
    </bdi>
  );
}

/** What must never reorder inside an Arabic sentence: 2026-11-10, 2%, GTV-231, v7-twin-tanks, GET /a/b, /hub:next. */
const ISOLATE = /(\d{4}-\d{2}-\d{2}|\d+(?:[.,]\d+)?%|GTV-\d+|\bv\d+-[\w-]+|(?:GET|POST|PUT|PATCH|DELETE) \/\S+|\/hub:\S+)/g;

/**
 * Render an API string (title, body) with its numbers and identifiers isolated (review: "(2%)" read "(%2)").
 * Use it wherever a mock or API sentence is shown; `fmt`/`fill` handle our own templates.
 */
export function Bidi({ children }: { children: string }) {
  const parts = children.split(ISOLATE);
  if (parts.length === 1) return <>{children}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <bdi key={i} dir="ltr">
            {part}
          </bdi>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

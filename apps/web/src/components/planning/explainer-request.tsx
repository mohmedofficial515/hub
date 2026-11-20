'use client';

/**
 * @file explainer-request.tsx
 * @description Asking Hams for a plan's explainer video (v5-live-plan, batch 4): style, voice (Google by default, with its eight voices), dialect,
 * aspect, length and captions, the folder where Hams lives on the member's machine, and a plain sentence on what leaves the machine, shown before
 * anything starts. Every choice is a native radio or select, so the arrows move within a group and a screen reader names each.
 */
import type { ExplainerRequest } from '@hub/contracts';
import { EXPLAINER_GOOGLE_VOICES, EXPLAINER_STYLES } from '@hub/contracts';
import {
  BarChart3,
  Captions,
  Layers,
  PenLine,
  Presentation,
  Shapes,
  ShieldCheck,
  Sparkles,
  Type,
  Video,
} from 'lucide-react';
import { type ReactNode, useId } from 'react';

import { Button, cn, fmt, useT } from '@/components/kit';
import { Select } from '@/components/ui/form';

import type { PlanningMessages } from './messages';

const STYLE_ICON = {
  whiteboard: PenLine,
  slides: Presentation,
  motion: Shapes,
  kinetic: Type,
  data: BarChart3,
  mixed: Layers,
} as const;

function Group({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0" aria-labelledby={id}>
      <legend id={id} className="mb-0.5 text-body-sm font-semibold text-foreground">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

/** A choice card: a native radio, drawn as a card with an icon, a title and one line. */
function Card({
  name,
  checked,
  onChange,
  icon,
  title,
  desc,
  badge,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  icon: ReactNode;
  title: string;
  desc: string;
  badge?: string | undefined;
}) {
  return (
    <label
      className={cn(
        'relative flex min-w-0 cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring motion-reduce:transition-none',
        checked ? 'border-primary bg-primary/8' : 'border-border bg-card hover:bg-accent',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-lg',
          checked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5 text-body-sm font-semibold text-foreground">
          {title}
          {badge && (
            <span className="rounded-full bg-success-soft px-1.5 text-caption font-medium text-success-soft-foreground">
              {badge}
            </span>
          )}
        </span>
        <span className="text-caption text-muted-foreground">{desc}</span>
      </span>
    </label>
  );
}

function Segments<K extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: K;
  options: [K, string][];
  onChange: (value: K) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 self-start rounded-lg border border-border p-0.5">
      {options.map(([key, label]) => (
        <label
          key={key}
          className={cn(
            'cursor-pointer rounded-md px-3 py-1.5 text-body-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
            value === key
              ? 'bg-foreground font-semibold text-background'
              : 'text-muted-foreground hover:bg-accent',
          )}
        >
          <input
            type="radio"
            name={name}
            checked={value === key}
            onChange={() => onChange(key)}
            className="sr-only"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export function ExplainerRequestPanel({
  value,
  onChange,
  device,
  folders,
  folder,
  onFolder,
  busy,
  onStart,
  onCancel,
}: {
  value: ExplainerRequest;
  onChange: (value: ExplainerRequest) => void;
  /** The member's device that runs Claude, by name; null when there is none. */
  device: string | null;
  folders: readonly string[];
  folder: string | null;
  onFolder: (folder: string) => void;
  busy: boolean;
  onStart: () => void;
  onCancel?: (() => void) | undefined;
}) {
  const v = useT<PlanningMessages>('planning').detail.video;
  const name = useId();
  const set = <K extends keyof ExplainerRequest>(key: K, next: ExplainerRequest[K]) =>
    onChange({ ...value, [key]: next });
  const blocked = !device ? v.noDevice : !folder ? v.noFolder : null;

  return (
    <div
      data-pj-explainer-request
      className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-background/40 p-4"
    >
      <p className="flex items-start gap-2 text-body-sm text-muted-foreground">
        <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
        {v.intro}
      </p>

      <Group label={v.style}>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {EXPLAINER_STYLES.map((id) => {
            const Icon = STYLE_ICON[id];
            const [title, desc] = v.styles[id];
            return (
              <Card
                key={id}
                name={`${name}-style`}
                checked={value.style === id}
                onChange={() => set('style', id)}
                icon={<Icon className="size-4" strokeWidth={1.75} />}
                title={title ?? id}
                desc={desc ?? ''}
                badge={id === 'whiteboard' ? v.recommended : undefined}
              />
            );
          })}
        </div>
      </Group>

      <Group label={v.voice}>
        <div className="grid min-w-0 gap-2 sm:grid-cols-3">
          {(['google', 'hams', 'none'] as const).map((id) => {
            const [title, desc] = v.voices[id];
            const Icon = id === 'none' ? Video : id === 'hams' ? ShieldCheck : Sparkles;
            return (
              <Card
                key={id}
                name={`${name}-voice`}
                checked={value.voice === id}
                onChange={() => set('voice', id)}
                icon={<Icon className="size-4" strokeWidth={1.75} />}
                title={title ?? id}
                desc={desc ?? ''}
              />
            );
          })}
        </div>
        {value.voice === 'google' && (
          <label className="flex flex-wrap items-center gap-2 text-body-sm text-foreground">
            {v.googleVoice}
            <Select
              value={value.googleVoice}
              onChange={(event) => set('googleVoice', event.target.value as ExplainerRequest['googleVoice'])}
              className="w-auto"
            >
              {EXPLAINER_GOOGLE_VOICES.map((voice) => (
                <option key={voice} value={voice}>
                  {v.googleVoices[voice]}
                </option>
              ))}
            </Select>
          </label>
        )}
      </Group>

      <div className="grid min-w-0 gap-4 md:grid-cols-3">
        <Group label={v.dialect}>
          <Segments
            name={`${name}-dialect`}
            value={value.dialect}
            onChange={(next) => set('dialect', next)}
            options={[
              ['egyptian', v.dialects.egyptian],
              ['msa', v.dialects.msa],
            ]}
          />
        </Group>
        <Group label={v.aspect}>
          <Segments
            name={`${name}-aspect`}
            value={value.aspect}
            onChange={(next) => set('aspect', next)}
            options={[
              ['landscape', v.aspects.landscape],
              ['portrait', v.aspects.portrait],
              ['square', v.aspects.square],
            ]}
          />
        </Group>
        <Group label={v.length}>
          <Segments
            name={`${name}-length`}
            value={value.length}
            onChange={(next) => set('length', next)}
            options={[
              ['chapters', v.lengths.chapters],
              ['short', v.lengths.short],
            ]}
          />
        </Group>
      </div>

      <label className="flex cursor-pointer items-center gap-2 self-start text-body-sm text-foreground">
        <input
          type="checkbox"
          checked={value.captions}
          onChange={(event) => set('captions', event.target.checked)}
          className="size-4 accent-(--primary)"
        />
        <Captions aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
        {v.captions}
      </label>

      {device && folders.length > 0 && (
        <label className="flex flex-col gap-1.5 text-body-sm font-medium text-foreground">
          {fmt(v.folder, { device })}
          <Select value={folder ?? ''} onChange={(event) => onFolder(event.target.value)} dir="ltr">
            {!folder && <option value="">—</option>}
            {folders.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </Select>
        </label>
      )}

      {/* What leaves the machine, said before anything starts. */}
      <p
        data-pj-explainer-notice={value.voice}
        className={cn(
          'flex items-start gap-2 rounded-lg px-3 py-2 text-body-sm',
          value.voice === 'google'
            ? 'border border-warning/50 bg-warning-soft text-warning-soft-foreground'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        {value.voice === 'google' ? v.googleNotice : v.localNotice}
      </p>

      {blocked && (
        <p role="status" className="text-body-sm text-muted-foreground">
          {blocked}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={busy || !!blocked} onClick={onStart}>
          <Video aria-hidden className="size-4" strokeWidth={2} />
          {v.start}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {v.cancel}
          </Button>
        )}
      </div>
    </div>
  );
}

import { useId, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Captions, Layers, PenLine, Presentation, ShieldCheck, Shapes, Sparkles, Type, Video } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { Button } from '../../../today/v5-peacock-app/kit';
import { messages } from '../i18n';

/**
 * What Hub sends to Hams (F:/tools/hams) for an explainer. It maps onto Hams' own wizard answers (`POST /api/projects`):
 * `style` picks the category and video type (whiteboard → category `whiteboard`; the rest → category `explainer` with that type),
 * `voice` is Hams' `voice.mode` (`google` | `voicetut` | `none`) and `googleVoice` its `voiceName`; aspect, dialect and captions
 * pass through. Google is the default voice (owner's choice, 2026-11-19).
 */
export const STYLES = ['whiteboard', 'slides', 'motion', 'kinetic', 'data', 'mixed'] as const;
export const GOOGLE_VOICES = ['Charon', 'Fenrir', 'Puck', 'Orus', 'Kore', 'Aoede', 'Leda', 'Zephyr'] as const;

export interface HamsRequest {
  style: (typeof STYLES)[number];
  voice: 'google' | 'hams' | 'none';
  googleVoice: (typeof GOOGLE_VOICES)[number];
  dialect: 'egyptian' | 'msa';
  aspect: 'landscape' | 'portrait' | 'square';
  length: 'chapters' | 'short';
  captions: boolean;
}

export const HAMS_DEFAULT: HamsRequest = {
  style: 'whiteboard',
  voice: 'google',
  googleVoice: 'Charon',
  dialect: 'egyptian',
  aspect: 'landscape',
  length: 'chapters',
  captions: true,
};

const STYLE_ICON = { whiteboard: PenLine, slides: Presentation, motion: Shapes, kinetic: Type, data: BarChart3, mixed: Layers } as const;

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

/** A choice card: a native radio (arrows move within the group), drawn as a card with an icon, a title and one line. */
function Card({ name, checked, onChange, icon, title, desc, badge }: { name: string; checked: boolean; onChange: () => void; icon: ReactNode; title: string; desc: string; badge?: string }) {
  return (
    <label
      className={cn(
        'ps-choice relative flex min-w-0 cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
        checked ? 'border-primary bg-primary/8' : 'border-border bg-card hover:bg-accent',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span aria-hidden className={cn('grid size-8 shrink-0 place-items-center rounded-lg', checked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5 text-body-sm font-semibold text-foreground">
          {title}
          {badge && <span className="rounded-full bg-success-soft px-1.5 text-caption font-medium text-success-soft-foreground">{badge}</span>}
        </span>
        <span className="text-caption text-muted-foreground">{desc}</span>
      </span>
    </label>
  );
}

/** A short choice as segments (native radios). */
function Segments<K extends string>({ name, value, options, onChange }: { name: string; value: K; options: [K, string][]; onChange: (v: K) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 self-start rounded-lg border border-border p-0.5">
      {options.map(([k, label]) => (
        <label
          key={k}
          className={cn(
            'cursor-pointer rounded-md px-3 py-1.5 text-body-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
            value === k ? 'bg-foreground font-semibold text-background' : 'text-muted-foreground hover:bg-accent',
          )}
        >
          <input type="radio" name={name} checked={value === k} onChange={() => onChange(k)} className="sr-only" />
          {label}
        </label>
      ))}
    </div>
  );
}

/**
 * Asking Hams for an explainer: style, voice (Google by default, with its eight voices), dialect, aspect, length and captions,
 * and a plain sentence on what leaves the machine. Opens in place under the video header.
 */
export function HamsRequestPanel({ value, onChange, onStart, onCancel }: { value: HamsRequest; onChange: (v: HamsRequest) => void; onStart: () => void; onCancel?: () => void }) {
  const t = useT(messages);
  const h = t.hams;
  const set = <K extends keyof HamsRequest>(k: K, v: HamsRequest[K]) => onChange({ ...value, [k]: v });
  const name = useId();

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      className="overflow-hidden"
    >
      <div className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-background/40 p-4">
        <p className="flex items-start gap-2 text-body-sm text-muted-foreground">
          <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
          {h.intro}
        </p>

        <Group label={h.style}>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {STYLES.map((id) => {
              const Icon = STYLE_ICON[id];
              const [title, desc] = h.styles[id];
              return (
                <Card
                  key={id}
                  name={`${name}-style`}
                  checked={value.style === id}
                  onChange={() => set('style', id)}
                  icon={<Icon className="size-4" strokeWidth={1.75} />}
                  title={title}
                  desc={desc}
                  badge={id === 'whiteboard' ? h.recommended : undefined}
                />
              );
            })}
          </div>
        </Group>

        <Group label={h.voice}>
          <div className="grid min-w-0 gap-2 sm:grid-cols-3">
            {(['google', 'hams', 'none'] as const).map((id) => {
              const [title, desc] = h.voices[id];
              return (
                <Card
                  key={id}
                  name={`${name}-voice`}
                  checked={value.voice === id}
                  onChange={() => set('voice', id)}
                  icon={id === 'none' ? <Video className="size-4" strokeWidth={1.75} /> : id === 'hams' ? <ShieldCheck className="size-4" strokeWidth={1.75} /> : <Sparkles className="size-4" strokeWidth={1.75} />}
                  title={title}
                  desc={desc}
                />
              );
            })}
          </div>
          {value.voice === 'google' && (
            <motion.label initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2 text-body-sm text-foreground">
              {h.googleVoice}
              <select
                value={value.googleVoice}
                onChange={(e) => set('googleVoice', e.target.value as HamsRequest['googleVoice'])}
                className="h-9 rounded-lg border border-input bg-card px-2 text-body-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {GOOGLE_VOICES.map((v) => (
                  <option key={v} value={v}>
                    {h.googleVoices[v]}
                  </option>
                ))}
              </select>
            </motion.label>
          )}
        </Group>

        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          <Group label={h.dialect}>
            <Segments name={`${name}-dialect`} value={value.dialect} onChange={(v) => set('dialect', v)} options={[['egyptian', h.dialects.egyptian], ['msa', h.dialects.msa]]} />
          </Group>
          <Group label={h.aspect}>
            <Segments name={`${name}-aspect`} value={value.aspect} onChange={(v) => set('aspect', v)} options={[['landscape', h.aspects.landscape], ['portrait', h.aspects.portrait], ['square', h.aspects.square]]} />
          </Group>
          <Group label={h.length}>
            <Segments name={`${name}-length`} value={value.length} onChange={(v) => set('length', v)} options={[['chapters', h.lengths.chapters], ['short', h.lengths.short]]} />
          </Group>
        </div>

        <label className="flex cursor-pointer items-center gap-2 self-start text-body-sm text-foreground">
          <input type="checkbox" checked={value.captions} onChange={(e) => set('captions', e.target.checked)} className="size-4 accent-(--primary)" />
          <Captions aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
          {h.captions}
        </label>

        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-caption text-muted-foreground">
          <ShieldCheck aria-hidden className="mt-px size-4 shrink-0" strokeWidth={1.75} />
          {h.privacy}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onStart}>
            <Video aria-hidden className="size-4" strokeWidth={2} />
            {h.start}
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              {h.cancel}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

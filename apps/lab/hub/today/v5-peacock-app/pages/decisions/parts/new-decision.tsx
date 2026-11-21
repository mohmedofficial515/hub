import { useEffect, useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { NOW, type DecisionCard, type DecisionOption, type HubCard, type L, type Role } from '@lab/mocks/hub-app';
import { addCard, Button, detectSecret, Field, fmt, IconButton, kitMessages, Modal, nextCardKey, num, openCard, PickField, SecretFilterError, Select, Textarea, TextInput, useSession } from '../../../kit';
import { matchKey } from '../../../kit/keys';
import { messages } from '../i18n';

type Kind = DecisionCard['decision']['kind'];

const KINDS: Kind[] = ['product', 'technical', 'financial', 'design'];
const ROLES: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];
/** 09 §7: financial → accountant, product → owner, technical → the role lead, then pm, design → owner. */
const DECIDER_BY_KIND: Record<Kind, Role> = { financial: 'accountant', product: 'owner', technical: 'pm', design: 'owner' };

/** `decisions.default_due_days` (03 §7). */
const DEFAULT_DUE = '2026-11-07T08:45';

interface Draft {
  title: string;
  pros: string;
  cons: string;
  cost: string;
  recommended: boolean;
}

const emptyOption = (): Draft => ({ title: '', pros: '', cons: '', cost: '', recommended: false });
const both = (text: string): L => ({ ar: text, en: text });
const lines = (text: string) => text.split('\n').map((s) => s.trim()).filter(Boolean).map(both);

/** 09 §7 "New decision": what the generic `+` dialog leaves out. Create and open, as the rest of the app does. */
export function NewDecisionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { me } = useSession();
  const id = useId();
  const n = t.new;

  const [question, setQuestion] = useState('');
  const [kind, setKind] = useState<Kind>('product');
  const [context, setContext] = useState('');
  const [decider, setDecider] = useState<Role>('owner');
  const [due, setDue] = useState(DEFAULT_DUE);
  const [options, setOptions] = useState<Draft[]>([emptyOption(), emptyOption()]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuestion('');
    setKind('product');
    setContext('');
    setDecider('owner');
    setDue(DEFAULT_DUE);
    setOptions([emptyOption(), emptyOption()]);
    setBlocks([]);
    setDocs([]);
    setTried(false);
  }, [open]);

  const named = options.filter((o) => o.title.trim());
  const noQuestion = !question.trim();
  const tooFew = named.length < 2;
  const secret = [question, context, ...options.flatMap((o) => [o.title, o.pros, o.cons, o.cost])].map(detectSecret).find(Boolean) ?? null;

  const update = (i: number, patch: Partial<Draft>) => setOptions((list) => list.map((o, at) => (at === i ? { ...o, ...patch } : patch.recommended ? { ...o, recommended: false } : o)));

  const create = () => {
    setTried(true);
    if (noQuestion || tooFew || secret) return;
    const key = nextCardKey();
    const title = both(question.trim());
    const built: DecisionOption[] = named.map((o, i) => ({ id: `o${i + 1}`, title: both(o.title.trim()), pros: lines(o.pros), cons: lines(o.cons), cost: o.cost.trim() ? both(o.cost.trim()) : undefined, recommended: o.recommended }));
    const card = {
      key,
      type: 'decision',
      status: 'open',
      title,
      priority: 'P2',
      ownerRole: decider,
      dueAt: due ? `${due}:00+03:00` : undefined,
      body: context.trim() ? both(context.trim()) : undefined,
      createdAt: NOW,
      lastEventAt: NOW,
      createdByKind: 'user',
      createdById: me.id,
      createdVia: 'web',
      tags: [],
      watchers: [me.id],
      links: [...blocks.map((k) => ({ kind: 'blocks' as const, key: k })), ...docs.map((k) => ({ kind: 'relates' as const, key: k }))],
      comments: [],
      attachments: [],
      events: [{ id: `new-${key}`, seq: 1, kind: 'created', actorKind: 'user', actorId: me.id, via: 'web', at: NOW, data: { title: question.trim(), priority: 'P2' } }],
      decision: { kind, question: title, options: built, deciderRole: decider, remindersSent: [], adrStatus: 'none' },
    } as HubCard;
    addCard(card);
    onOpenChange(false);
    window.setTimeout(() => openCard(key), 0);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={n.title}
      className="md:max-w-2xl"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{kit.cancel}</Button>
          <Button variant="primary" onClick={create}>
            {n.create}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
        onKeyDown={(e) => {
          if (matchKey(e, 'Enter') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            create();
          }
        }}
      >
        <Field id={`${id}-q`} label={n.question} hint={n.questionHint} required error={tried && noQuestion ? n.required : undefined}>
          <TextInput id={`${id}-q`} dir="auto" autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} aria-invalid={tried && noQuestion} />
        </Field>
        <Field id={`${id}-ctx`} label={n.context} hint={n.contextHint}>
          <Textarea id={`${id}-ctx`} dir="auto" rows={2} value={context} onChange={(e) => setContext(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id={`${id}-kind`} label={n.kind}>
            <Select
              id={`${id}-kind`}
              value={kind}
              onChange={(e) => {
                const next = e.target.value as Kind;
                setKind(next);
                setDecider(DECIDER_BY_KIND[next]);
              }}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.kinds[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-who`} label={n.decider}>
            <Select id={`${id}-who`} value={decider} onChange={(e) => setDecider(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {kit.roles[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-due`} label={n.due}>
            <TextInput id={`${id}-due`} type="datetime-local" dir="ltr" className="text-start" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        <p className="-mt-2 text-body-sm text-muted-foreground">{n.deciderHint}</p>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-body font-semibold text-foreground">{n.options}</legend>
          <p className="text-body-sm text-muted-foreground">{n.optionsHint}</p>
          {options.map((o, i) => {
            const label = fmt(n.option, { n: num(i + 1, locale) });
            return (
              <div key={i} role="group" aria-label={label} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
                <div className="flex items-end gap-2">
                  <Field id={`${id}-o${i}`} label={label} required className="min-w-0 flex-1">
                    <TextInput id={`${id}-o${i}`} dir="auto" placeholder={n.optionTitle} value={o.title} onChange={(e) => update(i, { title: e.target.value })} />
                  </Field>
                  {options.length > 2 && (
                    <IconButton label={fmt(n.removeOption, { n: num(i + 1, locale) })} onClick={() => setOptions((list) => list.filter((_, at) => at !== i))}>
                      <X aria-hidden className="size-4" strokeWidth={1.75} />
                    </IconButton>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id={`${id}-p${i}`} label={n.pros} hint={n.perLine}>
                    <Textarea id={`${id}-p${i}`} dir="auto" rows={2} value={o.pros} onChange={(e) => update(i, { pros: e.target.value })} />
                  </Field>
                  <Field id={`${id}-c${i}`} label={n.cons} hint={n.perLine}>
                    <Textarea id={`${id}-c${i}`} dir="auto" rows={2} value={o.cons} onChange={(e) => update(i, { cons: e.target.value })} />
                  </Field>
                </div>
                <Field id={`${id}-m${i}`} label={n.cost}>
                  <TextInput id={`${id}-m${i}`} dir="auto" value={o.cost} onChange={(e) => update(i, { cost: e.target.value })} />
                </Field>
                <label className="flex min-h-11 items-center gap-2 text-body-sm text-foreground md:min-h-0">
                  <input type="checkbox" checked={o.recommended} onChange={(e) => update(i, { recommended: e.target.checked })} className="size-4 shrink-0 accent-primary" />
                  {n.recommended}
                </label>
              </div>
            );
          })}
          {tried && tooFew && (
            <p role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
              {n.needTwo}
            </p>
          )}
          {options.length < 5 && (
            <Button size="sm" className="self-start" onClick={() => setOptions((list) => [...list, emptyOption()])}>
              <Plus aria-hidden className="size-3.5" strokeWidth={1.75} />
              {n.addOption}
            </Button>
          )}
        </fieldset>

        <PickField label={n.blocks} hint={n.blocksHint} keys={blocks} onChange={setBlocks} />
        <PickField label={n.docs} keys={docs} onChange={setDocs} picker="doc" />
        {secret && <SecretFilterError pattern={secret} />}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

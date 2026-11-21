import { useEffect, useId, useState } from 'react';
import { useT } from '@lab/i18n';
import { NOW, type HandoffDetail, type HubCard, type Role } from '@lab/mocks/hub-app';
import { addCard, Button, detectSecret, Field, kitMessages, Modal, nextCardKey, openCard, PickField, SecretFilterError, Select, Textarea, useSession } from '../../../kit';
import { matchKey } from '../../../kit/keys';
import { messages } from '../i18n';

const ROLES: Role[] = ['frontend', 'backend', 'designer', 'qa', 'pm', 'owner', 'accountant'];
const KINDS: HandoffDetail['kind'][] = ['contract', 'component', 'design', 'data', 'other'];
const SEVERITIES: HandoffDetail['severity'][] = ['info', 'notable', 'breaking'];

/** 09 §9 "Manual handoff": to role, kind, severity, summary, prompt, files or endpoints, link to a change card. */
export function NewHandoffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const { me, roles } = useSession();
  const id = useId();
  const n = t.new;
  const [to, setTo] = useState<Role>('frontend');
  const [kind, setKind] = useState<HandoffDetail['kind']>('component');
  const [severity, setSeverity] = useState<HandoffDetail['severity']>('notable');
  const [summary, setSummary] = useState('');
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState('');
  const [source, setSource] = useState<string[]>([]);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTo('frontend');
    setKind('component');
    setSeverity('notable');
    setSummary('');
    setPrompt('');
    setFiles('');
    setSource([]);
    setTried(false);
  }, [open]);

  const missing = !summary.trim();
  const secret = detectSecret(summary) ?? detectSecret(prompt) ?? detectSecret(files);

  const create = () => {
    setTried(true);
    if (missing || secret) return;
    const key = nextCardKey();
    const text = summary.trim();
    const first = text.split(/[.،\n]/)[0].slice(0, 80);
    const card = {
      key,
      type: 'handoff',
      status: 'pending',
      title: { ar: first, en: first },
      priority: severity === 'breaking' ? 'P0' : 'P2',
      ownerRole: to,
      severity,
      createdAt: NOW,
      lastEventAt: NOW,
      createdByKind: 'user',
      createdById: me.id,
      createdVia: 'web',
      tags: [],
      watchers: [me.id],
      links: source.map((k) => ({ kind: 'relates' as const, key: k })),
      comments: [],
      attachments: [],
      events: [{ id: `new-${key}`, seq: 1, kind: 'created', actorKind: 'user', actorId: me.id, via: 'web', at: NOW, data: { title: first, priority: severity === 'breaking' ? 'P0' : 'P2' } }],
      handoff: {
        fromRole: roles[0],
        toRole: to,
        kind,
        severity,
        summary: { ar: text, en: text },
        prompt: prompt.trim() || undefined,
        payload: { files: files.split('\n').map((s) => s.trim()).filter(Boolean) },
        sourceCardKey: source[0],
      },
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
        <Field id={`${id}-s`} label={n.summary} hint={n.summaryHint} required error={tried && missing ? n.required : undefined}>
          <Textarea id={`${id}-s`} dir="auto" rows={2} autoFocus value={summary} onChange={(e) => setSummary(e.target.value)} aria-invalid={tried && missing} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id={`${id}-t`} label={n.to}>
            <Select id={`${id}-t`} value={to} onChange={(e) => setTo(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {kit.roles[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-k`} label={n.kind}>
            <Select id={`${id}-k`} value={kind} onChange={(e) => setKind(e.target.value as HandoffDetail['kind'])}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {kit.sheet.handoff.kinds[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-v`} label={n.severity}>
            <Select id={`${id}-v`} value={severity} onChange={(e) => setSeverity(e.target.value as HandoffDetail['severity'])}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {kit.sheet.handoff.severities[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id={`${id}-p`} label={n.prompt} hint={n.promptHint}>
          <Textarea id={`${id}-p`} dir="ltr" rows={2} className="key text-start" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </Field>
        <Field id={`${id}-f`} label={n.files} hint={n.perLine}>
          <Textarea id={`${id}-f`} dir="ltr" rows={2} className="key text-start" value={files} onChange={(e) => setFiles(e.target.value)} />
        </Field>
        <PickField label={n.change} keys={source} onChange={setSource} types={['change']} multi={false} />
        {secret && <SecretFilterError pattern={secret} />}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

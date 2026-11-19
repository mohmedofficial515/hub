'use client';

/**
 * @file new-handoff.tsx
 * @description Ported from the approved design, pages/handoffs. Contract: apps/web/README.md.
 */
import { useEffect, useId, useState } from 'react';

import {
  Button,
  createCard,
  detectSecret,
  Field,
  type HandoffCard,
  kitMessages,
  matchKey,
  Modal,
  openCard,
  PickField,
  type Role,
  SecretFilterError,
  Select,
  showToast,
  Textarea,
  useSession,
  useT,
} from '@/components/kit';
import type { HandoffsMessages } from '@/features/handoffs/messages';
import { isHubError } from '@/lib/api/errors';

type HandoffDetail = HandoffCard['handoff'];

const ROLES: Role[] = ['frontend', 'backend', 'designer', 'qa', 'pm', 'owner', 'accountant'];
const KINDS: HandoffDetail['kind'][] = ['contract', 'component', 'design', 'data', 'other'];
const SEVERITIES: HandoffDetail['severity'][] = ['info', 'notable', 'breaking'];

/** 09 §9 "Manual handoff": to role, kind, severity, summary, prompt, files or endpoints, link to a change card. */
export function NewHandoffDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT<HandoffsMessages>('handoffs');
  const kit = useT(kitMessages);
  const { roles } = useSession();
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
  const [busy, setBusy] = useState(false);

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

  const create = async () => {
    setTried(true);
    const from = roles[0];
    if (missing || secret || busy || !from) return;
    setBusy(true);
    const text = summary.trim();
    // docs/09 §9 lists no title field, so the title is the summary's first clause.
    const first = (text.split(/[.،\n]/)[0] ?? text).slice(0, 80);
    const fileList = files
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    try {
      const { key } = await createCard({
        type: 'handoff',
        title: first,
        priority: severity === 'breaking' ? 'P0' : 'P2',
        ownerRole: to,
        detail: {
          kind,
          fromRole: from,
          toRole: to,
          severity,
          summary: text,
          ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
          ...(fileList.length ? { payload: { files: fileList } } : {}),
          ...(source[0] ? { sourceKey: source[0] } : {}),
        },
      });
      onOpenChange(false);
      window.setTimeout(() => openCard(key), 0);
    } catch (error) {
      showToast({ tone: 'error', message: isHubError(error) ? error.message : t.errorThing });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      dirty={Boolean(summary.trim() || prompt.trim() || files.trim())}
      title={n.title}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{kit.cancel}</Button>
          <Button variant="primary" busy={busy} onClick={() => void create()}>
            {n.create}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
        onKeyDown={(e) => {
          if (matchKey(e, 'Enter') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void create();
          }
        }}
      >
        <Field
          id={`${id}-s`}
          label={n.summary}
          hint={n.summaryHint}
          required
          error={tried && missing ? n.required : undefined}
        >
          <Textarea
            id={`${id}-s`}
            dir="auto"
            rows={2}
            autoFocus
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            aria-invalid={tried && missing}
          />
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
            <Select
              id={`${id}-k`}
              value={kind}
              onChange={(e) => setKind(e.target.value as HandoffDetail['kind'])}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {kit.sheet.handoff.kinds[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-v`} label={n.severity}>
            <Select
              id={`${id}-v`}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as HandoffDetail['severity'])}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {kit.sheet.handoff.severities[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id={`${id}-p`} label={n.prompt} hint={n.promptHint}>
          <Textarea
            id={`${id}-p`}
            dir="ltr"
            rows={2}
            className="key text-start"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </Field>
        <Field id={`${id}-f`} label={n.files} hint={n.perLine}>
          <Textarea
            id={`${id}-f`}
            dir="ltr"
            rows={2}
            className="key text-start"
            value={files}
            onChange={(e) => setFiles(e.target.value)}
          />
        </Field>
        <PickField label={n.change} keys={source} onChange={setSource} types={['change']} multi={false} />
        {secret && <SecretFilterError pattern={secret} />}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

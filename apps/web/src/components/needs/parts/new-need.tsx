'use client';

/**
 * @file new-need.tsx
 * @description Ported from the approved design, pages/needs. Contract: apps/web/README.md.
 */
import { useEffect, useId, useState } from 'react';

import { looksLikeRawValue } from '@/components/cards/sheet-sections/need';
import {
  Button,
  createCard,
  detectSecret,
  Field,
  kitMessages,
  matchKey,
  Modal,
  type NeedCard,
  openCard,
  PickField,
  type Role,
  SecretFilterError,
  Select,
  showToast,
  Textarea,
  TextInput,
  useT,
} from '@/components/kit';
import type { NeedsMessages } from '@/features/needs/messages';
import { isHubError } from '@/lib/api/errors';

type Kind = NeedCard['need']['kind'];

const KINDS: Kind[] = ['token', 'account', 'access', 'contract', 'value_check', 'file', 'other'];
const ROLES: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];
/** 09 §8: token, account, access, contract → owner; value check → accountant; file → pm. */
const RESPONSIBLE_BY_KIND: Record<Kind, Role> = {
  token: 'owner',
  account: 'owner',
  access: 'owner',
  contract: 'owner',
  value_check: 'accountant',
  file: 'pm',
  other: 'owner',
};

export function NewNeedDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT<NeedsMessages>('needs');
  const kit = useT(kitMessages);
  const id = useId();
  const n = t.new;
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Kind>('token');
  const [role, setRole] = useState<Role>('owner');
  const [body, setBody] = useState('');
  const [due, setDue] = useState('');
  const [blocks, setBlocks] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setKind('token');
    setRole('owner');
    setBody('');
    setDue('');
    setBlocks([]);
    setTried(false);
  }, [open]);

  const missing = !title.trim();
  const secret =
    detectSecret(title) ??
    detectSecret(body) ??
    (looksLikeRawValue(title) || looksLikeRawValue(body) ? kit.sheet.need.kinds.token : null);

  const create = async () => {
    setTried(true);
    if (missing || secret || busy) return;
    setBusy(true);
    try {
      const { key } = await createCard({
        type: 'need',
        title: title.trim(),
        ownerRole: role,
        ...(body.trim() ? { body: body.trim() } : {}),
        ...(due ? { dueAt: new Date(due).toISOString() } : {}),
        ...(blocks.length ? { links: blocks.map((k) => ({ kind: 'blocks' as const, key: k })) } : {}),
        detail: { kind, responsibleRole: role },
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
      dirty={Boolean(title.trim() || body.trim())}
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
          id={`${id}-t`}
          label={n.what}
          hint={n.whatHint}
          required
          error={tried && missing ? n.required : undefined}
        >
          <TextInput
            id={`${id}-t`}
            dir="auto"
            autoFocus
            autoComplete="off"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={tried && missing}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`${id}-k`} label={n.kind}>
            <Select
              id={`${id}-k`}
              value={kind}
              onChange={(e) => {
                const next = e.target.value as Kind;
                setKind(next);
                setRole(RESPONSIBLE_BY_KIND[next]);
              }}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {kit.sheet.need.kinds[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-r`} label={n.responsible} hint={n.responsibleHint}>
            <Select id={`${id}-r`} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {kit.roles[r]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id={`${id}-b`} label={n.body} hint={n.bodyHint}>
          <Textarea
            id={`${id}-b`}
            dir="auto"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
        <Field id={`${id}-d`} label={n.due}>
          <TextInput
            id={`${id}-d`}
            type="datetime-local"
            dir="ltr"
            className="text-start"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
        <PickField label={n.blocks} hint={n.blocksHint} keys={blocks} onChange={setBlocks} />
        {secret && <SecretFilterError pattern={secret} />}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

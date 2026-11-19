'use client';

/**
 * @file new-card-dialog.tsx
 * @description Ported from apps/lab/hub/today/v5-peacock-app/shell/new-card-dialog.tsx. Contract: apps/web/README.md.
 */
import { SPECIALTIES } from '@hub/contracts';
import { Tabs } from 'radix-ui';
import { useEffect, useId, useState } from 'react';

import {
  Button,
  createCard,
  detectSecret,
  Field,
  fill,
  kitMessages,
  Ltr,
  Modal,
  openCard,
  SecretFilterError,
  Select,
  showToast,
  tabTriggerClass,
  Textarea,
  TextInput,
  TypeIcon,
  useSession,
} from '@/components/kit';
import type { Priority, Role } from '@/features/cards/types';
import { isHubError } from '@/lib/api/errors';
import { useT } from '@/lib/i18n';
import { messages } from '@/lib/i18n';
import { matchKey } from '@/lib/keys';

export type NewCardType = 'task' | 'decision' | 'need' | 'handoff';

const TYPES: NewCardType[] = ['task', 'decision', 'need', 'handoff'];
const ROLES: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];
/** A role that has one specialty starts the task on it. Owner, pm and accountant do not, so they pick one (a task is never "backend" by accident). */
const SPECIALTY_OF: Partial<Record<Role, string>> = {
  backend: 'backend',
  frontend: 'frontend',
  designer: 'design',
  qa: 'qa',
};

/**
 * 09 §19 NewCardDialog: type tabs, title, role, priority. The per-type fields of §6–§9 (options, kind, payload)
 * belong to the later pages; "Create and open" lands in the sheet, where those fields are edited.
 */
export function NewCardDialog({
  open,
  onOpenChange,
  initialType = 'task',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: NewCardType | undefined;
}) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const { roles } = useSession();
  const id = useId();
  const [type, setType] = useState<NewCardType>(initialType);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [role, setRole] = useState<Role>(roles[0] ?? 'owner');
  const [priority, setPriority] = useState<Priority>('P2');
  const [specialty, setSpecialty] = useState('');
  // Once the member picks a specialty, changing the role no longer replaces it.
  const [specialtyPicked, setSpecialtyPicked] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    const first = roles[0] ?? 'owner';
    setType(initialType);
    setTitle('');
    setBody('');
    setPriority('P2');
    setTried(false);
    setRole(first);
    setSpecialty(SPECIALTY_OF[first] ?? '');
    setSpecialtyPicked(false);
  }, [open, initialType, roles]);

  const pickRole = (next: Role) => {
    setRole(next);
    if (!specialtyPicked) setSpecialty(SPECIALTY_OF[next] ?? '');
  };

  const missing = !title.trim();
  const noSpecialty = type === 'task' && !specialty;
  const secret = detectSecret(title) ?? detectSecret(body);

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /** The smallest valid detail per type. "Create and open" lands in the sheet, where the rest is edited (09 §19). */
  const detailFor = (text: string): Record<string, unknown> => {
    if (type === 'task') return { specialty };
    if (type === 'decision') return { kind: 'product', question: text, options: [], deciderRole: role };
    if (type === 'need') return { kind: 'other', responsibleRole: role };
    return { kind: 'other', fromRole: roles[0] ?? role, toRole: role, severity: 'info', summary: text };
  };

  const create = async (andOpen: boolean) => {
    setTried(true);
    setFailure(null);
    if (missing || noSpecialty || secret || busy) return;
    const text = title.trim();
    setBusy(true);
    try {
      const card = await createCard({
        type,
        title: text,
        ...(body.trim() ? { body: body.trim() } : {}),
        ownerRole: role,
        priority,
        detail: detailFor(text),
      });
      onOpenChange(false);
      if (andOpen) {
        // Wait for the dialog's own focus return, so the sheet records the right opener.
        window.setTimeout(() => openCard(card.key), 0);
      } else {
        showToast({
          message: fill(t.newCard.created, { key: <Ltr mono>{card.key}</Ltr> }),
          action: { label: t.newCard.open, onSelect: () => openCard(card.key) },
        });
      }
    } catch (error) {
      setFailure(isHubError(error) ? error.message : t.newCard.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.newCard.title}
      dirty={!!title.trim() || !!body.trim()}
      footer={
        <>
          <Button busy={busy} onClick={() => void create(false)}>
            {t.newCard.create}
          </Button>
          <Button variant="primary" busy={busy} onClick={() => void create(true)}>
            {t.newCard.createOpen}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create(true);
        }}
        onKeyDown={(e) => {
          if (matchKey(e, 'Enter') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void create(true);
          }
        }}
      >
        <Tabs.Root value={type} onValueChange={(v) => setType(v as NewCardType)}>
          <Tabs.List
            aria-label={t.newCard.types}
            className="flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]"
          >
            {TYPES.map((value) => (
              <Tabs.Trigger key={value} value={value} className={tabTriggerClass}>
                <TypeIcon type={value} />
                {kit.types[value]}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>
        <Field
          id={`${id}-title`}
          label={t.newCard.titleLabel}
          hint={t.newCard.titleHint}
          required
          error={tried && missing ? t.newCard.required : undefined}
        >
          <TextInput
            id={`${id}-title`}
            dir="auto"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={tried && missing}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${id}-role`} label={t.newCard.role}>
            <Select id={`${id}-role`} value={role} onChange={(e) => pickRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {kit.roles[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-prio`} label={t.newCard.priority}>
            <Select
              id={`${id}-prio`}
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          {type === 'task' && (
            <Field
              id={`${id}-specialty`}
              label={t.newCard.specialty}
              required
              error={tried && noSpecialty ? t.newCard.specialtyRequired : undefined}
              className="col-span-2"
            >
              <Select
                id={`${id}-specialty`}
                value={specialty}
                aria-invalid={tried && noSpecialty}
                onChange={(e) => {
                  setSpecialty(e.target.value);
                  setSpecialtyPicked(true);
                }}
              >
                {!specialty && (
                  <option value="" disabled>
                    {t.newCard.pickSpecialty}
                  </option>
                )}
                {SPECIALTIES.map((value) => (
                  <option key={value} value={value}>
                    {kit.sheet.task.specialties[value] ?? value}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <Field id={`${id}-body`} label={t.newCard.body}>
          <Textarea
            id={`${id}-body`}
            dir="auto"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
        {secret && <SecretFilterError pattern={secret} />}
        {failure && (
          <p role="alert" className="text-body-sm text-destructive-soft-foreground">
            {failure}
          </p>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

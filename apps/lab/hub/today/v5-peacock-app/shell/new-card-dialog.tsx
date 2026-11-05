import { useEffect, useId, useState } from 'react';
import { Tabs } from 'radix-ui';
import { useT } from '@lab/i18n';
import type { Priority, Role } from '@lab/mocks/hub-app';
import { Button, createCard, detectSecret, Field, fill, kitMessages, Ltr, Modal, openCard, SecretFilterError, Select, showToast, tabTriggerClass, Textarea, TextInput, TypeIcon, useSession } from '../kit';
import { matchKey } from '../kit/keys';
import { messages } from '../i18n';

export type NewCardType = 'task' | 'decision' | 'need' | 'handoff';

const TYPES: NewCardType[] = ['task', 'decision', 'need', 'handoff'];
const ROLES: Role[] = ['owner', 'pm', 'accountant', 'backend', 'frontend', 'designer', 'qa'];
const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];

/**
 * 09 §19 NewCardDialog: type tabs, title, role, priority. The per-type fields of §6–§9 (options, kind, payload)
 * belong to the later pages; "Create and open" lands in the sheet, where those fields are edited.
 */
export function NewCardDialog({ open, onOpenChange, initialType = 'task' }: { open: boolean; onOpenChange: (open: boolean) => void; initialType?: NewCardType }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const { me, roles } = useSession();
  const id = useId();
  const [type, setType] = useState<NewCardType>(initialType);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [role, setRole] = useState<Role>(roles[0]);
  const [priority, setPriority] = useState<Priority>('P2');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setTitle('');
    setBody('');
    setPriority('P2');
    setTried(false);
    setRole(roles[0]);
  }, [open, initialType, roles]);

  const missing = !title.trim();
  const secret = detectSecret(title) ?? detectSecret(body);

  const create = (andOpen: boolean) => {
    setTried(true);
    if (missing || secret) return;
    const card = createCard({ type, title: title.trim(), body: body.trim() || undefined, ownerRole: role, priority, memberId: me.id });
    onOpenChange(false);
    if (andOpen) {
      // Wait for the dialog's own focus return, so the sheet records the right opener.
      window.setTimeout(() => openCard(card.key), 0);
    } else {
      showToast({ message: fill(t.newCard.created, { key: <Ltr mono>{card.key}</Ltr> }) });
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.newCard.title}
      footer={
        <>
          <Button onClick={() => create(false)}>{t.newCard.create}</Button>
          <Button variant="primary" onClick={() => create(true)}>
            {t.newCard.createOpen}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          create(true);
        }}
        onKeyDown={(e) => {
          if (matchKey(e, 'Enter') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            create(true);
          }
        }}
      >
        <Tabs.Root value={type} onValueChange={(v) => setType(v as NewCardType)}>
          <Tabs.List aria-label={t.newCard.types} className="flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
            {TYPES.map((value) => (
              <Tabs.Trigger key={value} value={value} className={tabTriggerClass}>
                <TypeIcon type={value} />
                {kit.types[value]}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>
        <Field id={`${id}-title`} label={t.newCard.titleLabel} hint={t.newCard.titleHint} required error={tried && missing ? t.newCard.required : undefined}>
          <TextInput id={`${id}-title`} dir="auto" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={tried && missing} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${id}-role`} label={t.newCard.role}>
            <Select id={`${id}-role`} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {kit.roles[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`${id}-prio`} label={t.newCard.priority}>
            <Select id={`${id}-prio`} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id={`${id}-body`} label={t.newCard.body}>
          <Textarea id={`${id}-body`} dir="auto" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {secret && <SecretFilterError pattern={secret} />}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

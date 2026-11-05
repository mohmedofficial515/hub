import { useId, useMemo, useState } from 'react';
import { useLocale, useT } from '@lab/i18n';
import type { HubCard, ReleaseCard } from '@lab/mocks/hub-app';
import { eligibleForRelease, notesAuthors, notesSkeleton } from '@lab/mocks/hub-app/releases';
import { addCard, Bidi, Button, cn, detectSecret, Field, fill, focusRingInset, kitMessages, Ltr, Modal, nextCardKey, nowMs, Select, showToast, TextInput, TypeIcon, useCards, useSession } from '../../../kit';
import { messages } from '../i18n';

const ORDER: HubCard['type'][] = ['decision', 'task', 'handoff', 'redesign'];

/**
 * 09 §16. The include list is the picker's filter already applied: only what is finished and not yet in a release, so
 * there is nothing to search for. The kit's `CardPicker` filters by type and not by status.
 */
export function NewReleaseDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (key: string) => void }) {
  const t = useT(messages);
  const d = t.dialog;
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { me } = useSession();
  const cards = useCards();
  const id = useId();
  const eligible = useMemo(() => eligibleForRelease(cards), [cards]);
  const [version, setVersion] = useState('2026-11-17');
  const [name, setName] = useState('');
  const [repo, setRepo] = useState<'backend' | 'web' | 'dashboard' | 'hub'>('backend');
  const [tag, setTag] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [tried, setTried] = useState(false);

  const secret = detectSecret(`${name} ${tag}`);
  const missingVersion = !version.trim();
  const missingName = !name.trim();
  const toggle = (key: string) => setPicked((all) => (all.includes(key) ? all.filter((k) => k !== key) : [...all, key]));

  const create = () => {
    setTried(true);
    if (missingVersion || missingName || secret) return;
    const key = nextCardKey();
    const rows = picked.map((k) => cards.find((c) => c.key === k)).filter((c): c is HubCard => !!c);
    const at = new Date(nowMs()).toISOString();
    const title = name.trim();
    const card: ReleaseCard = {
      key,
      type: 'release',
      title: { ar: `إصدار ${version.trim()} · ${title}`, en: `Release ${version.trim()} · ${title}` },
      status: 'planned',
      priority: 'P2',
      ownerRole: 'owner',
      repo,
      createdAt: at,
      lastEventAt: at,
      createdByKind: 'user',
      createdById: me.id,
      createdVia: 'web',
      tags: [],
      watchers: [me.id],
      links: [],
      comments: [],
      attachments: [],
      events: [{ id: `${key}-1`, seq: 1, kind: 'created', actorKind: 'user', actorId: me.id, via: 'web', at, data: { title, status: 'planned', priority: 'P2' } }],
      release: { version: version.trim(), repo, tag: tag.trim() || undefined, includedKeys: picked, notes: notesSkeleton(rows.map((c) => ({ key: c.key, type: c.type, title: c.title }))) },
    };
    notesAuthors.set(key, { kind: 'system' });
    addCard(card);
    onOpenChange(false);
    setName('');
    setTag('');
    setPicked([]);
    setTried(false);
    onCreated(key);
    showToast({ message: fill(d.created, { key: <Ltr mono>{key}</Ltr> }) });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={d.title}
      description={d.description}
      className="md:max-w-xl"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{kit.cancel}</Button>
          <Button variant="primary" onClick={create}>
            {d.create}
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
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`${id}-version`} label={d.version} hint={<Bidi>{d.versionHint}</Bidi>} required error={tried && missingVersion ? d.needVersion : undefined}>
            <TextInput id={`${id}-version`} dir="ltr" className="key text-start" value={version} onChange={(e) => setVersion(e.target.value)} />
          </Field>
          <Field id={`${id}-repo`} label={d.repo}>
            <Select id={`${id}-repo`} dir="ltr" className="key text-start" value={repo} onChange={(e) => setRepo(e.target.value as typeof repo)}>
              {(['backend', 'web', 'dashboard', 'hub'] as const).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id={`${id}-name`} label={d.name} hint={d.nameHint} required error={tried && missingName ? d.needName : secret ? d.secret : undefined}>
          <TextInput id={`${id}-name`} dir="auto" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id={`${id}-tag`} label={d.tag} hint={d.tagHint}>
          <TextInput id={`${id}-tag`} dir="ltr" className="key text-start" placeholder="v2026.11.17" value={tag} onChange={(e) => setTag(e.target.value)} />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-sm font-medium text-foreground">{d.include}</legend>
          <p className="text-body-sm text-muted-foreground">{eligible.length ? d.includeHint : d.includeNone}</p>
          {ORDER.filter((type) => eligible.some((c) => c.type === type)).map((type) => (
            <div key={type} className="flex flex-col gap-1">
              <p className="mt-1 text-caption font-medium text-muted-foreground">{t.groups[type]}</p>
              <ul className="overflow-hidden rounded-lg border border-border">
                {eligible
                  .filter((c) => c.type === type)
                  .map((c) => {
                    const checked = picked.includes(c.key);
                    return (
                      <li key={c.key} className="border-b border-border last:border-b-0">
                        <label className={cn('flex min-h-11 cursor-pointer items-center gap-2.5 bg-card px-3 py-2 hover:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-inset', focusRingInset)}>
                          <input type="checkbox" checked={checked} onChange={() => toggle(c.key)} className="size-4 shrink-0 accent-primary" />
                          <TypeIcon type={c.type} />
                          <span className="min-w-0 flex-1 text-body-sm text-foreground">
                            <Bidi>{c.title[locale]}</Bidi>
                          </span>
                          <Ltr mono className="shrink-0 text-caption text-muted-foreground">
                            {c.key}
                          </Ltr>
                        </label>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

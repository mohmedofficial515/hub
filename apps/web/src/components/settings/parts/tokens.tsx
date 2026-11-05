'use client';

/**
 * @file tokens.tsx
 * @description Ported from the approved design, pages/settings/parts/tokens.tsx, on the real API. Contract: apps/web/README.md.
 */
import { Ban, Bot, KeyRound, Plus, Webhook } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  CommandBlock,
  ConfirmDialog,
  detectSecret,
  EmptyState,
  ErrorState,
  Field,
  fill,
  kitMessages,
  Ltr,
  Modal,
  Pill,
  RelativeTime,
  SecretFilterError,
  SectionHeader,
  shortDate,
  ShownOnce,
  showToast,
  SkeletonRows,
  TextInput,
  useKeyboardList,
  useLocale,
  useMedia,
  useRoute,
  useT,
} from '@/components/kit';
import type { SettingsMessages } from '@/features/settings/messages';
import { type TokenRow, useCreateToken, useRevokeToken, useTokens } from '@/features/settings/queries';
import { isHubError } from '@/lib/api/errors';

import { rowFocus, Segmented } from './shared';

type Kind = TokenRow['kind'];

/** Where Claude Code reaches this Hub. The API's own port on this host, unless the deployment says otherwise (docs/15 §1, D33). */
const hubApiUrl = () =>
  process.env.NEXT_PUBLIC_HUB_API_URL ?? `${window.location.protocol}//${window.location.hostname}:7310`;

function KindBadge({ kind }: { kind: Kind }) {
  const Icon = kind === 'mcp' ? Bot : Webhook;
  return (
    <span className="inline-flex items-center gap-1 text-body-sm text-foreground">
      <Icon aria-hidden className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
      <Ltr mono>{kind}</Ltr>
    </span>
  );
}

function Prefix({ token }: { token: TokenRow }) {
  return (
    <code dir="ltr" translate="no" title={token.prefix} className="key text-body-sm text-foreground">
      {token.prefix}…
    </code>
  );
}

function CreateTokenDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT<SettingsMessages>('settings');
  const kit = useT(kitMessages);
  const { ws } = useRoute();
  const createToken = useCreateToken();
  const s = t.tokens;
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('mcp');
  const [tried, setTried] = useState(false);
  // Only here, only until the dialog closes: nothing else in the app can read the full value.
  const [created, setCreated] = useState<{ token: string; prefix: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const nameError = !name.trim() ? s.nameRequired : undefined;
  const secret = detectSecret(name);

  const close = () => {
    setCreated(null);
    setName('');
    setKind('mcp');
    setTried(false);
    setServerError(null);
    onClose();
  };

  const create = () => {
    setTried(true);
    if (nameError || secret) return;
    setServerError(null);
    createToken.mutate(
      { name: name.trim(), kind },
      {
        onSuccess: ({ token, prefix }) => setCreated({ token, prefix }),
        onError: (error) => setServerError(isHubError(error) ? error.message : t.errorThing),
      },
    );
  };

  // docs/05 §3.3 and packages/team-pack/README.md.
  const mcpCommand = created
    ? `claude mcp add --transport http --scope user hub ${hubApiUrl()}/mcp --header "Authorization: Bearer ${created.token}"`
    : '';
  const linkCommand = `hub link ${ws}`;
  const packCommand = created ? `hub init --url ${hubApiUrl()} --token ${created.token}` : '';

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && close()}
      className="md:max-w-xl"
      title={created ? s.createdTitle : s.createTitle}
      footer={
        created ? (
          <Button variant="primary" onClick={close}>
            {s.savedIt}
          </Button>
        ) : (
          <>
            <Button onClick={close}>{kit.cancel}</Button>
            <Button variant="primary" busy={createToken.isPending} onClick={create}>
              {s.create}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <ShownOnce warning={s.onceWarning}>
          <CommandBlock label={s.tokenLabel} value={created.token} copyLabel={s.copyToken} />
          {kind === 'mcp' && (
            <>
              <CommandBlock label={s.mcpCommand} value={mcpCommand} copyLabel={s.copyCommand} />
              <div className="flex flex-col gap-1">
                <CommandBlock label={s.linkCommand} value={linkCommand} copyLabel={s.copyCommand} />
                <p className="text-body-sm text-muted-foreground">{s.linkHint}</p>
              </div>
            </>
          )}
          <CommandBlock label={s.packCommand} value={packCommand} copyLabel={s.copyCommand} />
        </ShownOnce>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Field
            id="token-name"
            label={s.name}
            hint={s.nameHint}
            error={tried ? nameError : undefined}
            required
          >
            <TextInput
              id="token-name"
              dir="auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={tried && !!nameError}
              autoFocus
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <p className="text-body-sm font-medium text-foreground">{s.kind}</p>
            <Segmented
              legend={s.kind}
              value={kind}
              onChange={setKind}
              options={[
                { value: 'mcp', label: s.kinds.mcp },
                { value: 'hook', label: s.kinds.hook },
              ]}
            />
          </div>
          <dl className="flex flex-col gap-2 rounded-md border border-border p-3 text-body-sm">
            <div>
              <dt className="font-medium text-foreground">{s.can}</dt>
              <dd className="text-muted-foreground">{s.canList[kind]}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">{s.cannot}</dt>
              <dd className="text-muted-foreground">{s.cannotList[kind]}</dd>
            </div>
          </dl>
          {secret && <SecretFilterError pattern={secret} />}
          {serverError && (
            <p role="alert" className="text-body-sm font-medium text-destructive-soft-foreground">
              {serverError}
            </p>
          )}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}

export function TokensTab() {
  const t = useT<SettingsMessages>('settings');
  const locale = useLocale();
  const query = useTokens();
  const revokeToken = useRevokeToken();
  const tokens = query.data ?? [];
  const s = t.tokens;
  const wide = useMedia('(min-width: 768px)');
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const active = tokens.filter((x) => !x.revokedAt);
  const revoked = tokens.filter((x) => x.revokedAt);
  // Enter on a row moves to its Revoke button rather than asking to revoke: a keyboard walk should not land on a destructive question.
  const list = useKeyboardList({
    ids: active.map((x) => x.id),
    onOpen: (id) => document.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"] button`)?.focus(),
  });
  const target = tokens.find((x) => x.id === revoking);

  const lastUsed = (x: TokenRow) =>
    x.lastUsedAt ? (
      <RelativeTime iso={x.lastUsedAt} />
    ) : (
      <span className="text-muted-foreground">{s.neverUsed}</span>
    );

  const revoke = (x: TokenRow) =>
    revokeToken.mutate(x.id, {
      onSuccess: () => showToast({ message: s.revoked }),
      onError: (error) =>
        showToast({ tone: 'error', message: isHubError(error) ? error.message : t.errorThing }),
    });

  if (query.isPending) return <SkeletonRows count={3} withAction />;
  if (query.isError) {
    const { error } = query;
    return (
      <ErrorState
        thing={t.errorThing}
        code={isHubError(error) ? error.code : undefined}
        requestId={isHubError(error) ? error.requestId : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <>
      <section aria-labelledby="tokens-title" className="flex flex-col gap-3">
        <SectionHeader
          id="tokens-title"
          icon={KeyRound}
          title={s.title}
          count={active.length || undefined}
          aside={
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden className="size-4" strokeWidth={1.75} />
              {s.create}
            </Button>
          }
        />
        <p className="max-w-prose text-body-sm text-muted-foreground">{s.intro}</p>
        {active.length === 0 ? (
          <EmptyState icon={KeyRound} title={s.emptyTitle}>
            {s.emptyBody}
          </EmptyState>
        ) : wide ? (
          <div data-hub-list className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-start text-body-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  {[s.name, s.kind, s.prefix, s.lastUsed, s.createdCol].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2 text-start font-medium">
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-2">
                    <span className="sr-only">{s.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {active.map((x) => (
                  <tr key={x.id} {...list.rowProps(x.id)} className={rowFocus}>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <span dir="auto">{x.name}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <KindBadge kind={x.kind} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Prefix token={x} />
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{lastUsed(x)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{shortDate(x.createdAt, locale)}</td>
                    <td className="px-4 py-1.5 text-end">
                      <Button
                        size="sm"
                        aria-label={`${s.revoke}: ${x.name}`}
                        onClick={() => setRevoking(x.id)}
                      >
                        {s.revoke}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul
            data-hub-list
            className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card"
          >
            {active.map((x) => (
              <li key={x.id} {...list.rowProps(x.id)} className={`flex flex-col gap-2 p-4 ${rowFocus}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span dir="auto" className="min-w-0 flex-1 basis-40 text-body font-medium text-foreground">
                    {x.name}
                  </span>
                  <KindBadge kind={x.kind} />
                </div>
                <Prefix token={x} />
                <div className="flex items-center gap-3">
                  <p className="min-w-0 flex-1 text-body-sm text-muted-foreground">
                    {s.lastUsed}: {lastUsed(x)}
                  </p>
                  <Button size="sm" aria-label={`${s.revoke}: ${x.name}`} onClick={() => setRevoking(x.id)}>
                    {s.revoke}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {revoked.length > 0 && (
        <section aria-labelledby="tokens-revoked" className="flex flex-col gap-2">
          <SectionHeader
            id="tokens-revoked"
            level={3}
            icon={Ban}
            title={s.revokedTitle}
            count={revoked.length}
          />
          <ul className="flex flex-col gap-1">
            {revoked.map((x) => (
              <li
                key={x.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground"
              >
                <span dir="auto">{x.name}</span>
                <code dir="ltr" translate="no" className="key">
                  {x.prefix}…
                </code>
                <Pill tone="muted">{fill(s.revokedOn, { date: shortDate(x.revokedAt!, locale) })}</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CreateTokenDialog open={creating} onClose={() => setCreating(false)} />
      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={target ? fill(s.revokeTitle, { name: <span dir="auto">{target.name}</span> }) : ''}
        description={s.revokeBody}
        confirmLabel={s.revoke}
        onConfirm={() => target && revoke(target)}
      />
    </>
  );
}

'use client';

/**
 * @file link-folder.tsx
 * @description The Link button on a project (docs/16 §5, D44). It registers the folder and, through the bridge on the device that holds it, accepts that folder's trust in Claude Code, so a chat there lands on
 * this project with no dialog and no token. It says what will happen before the press and what did after, and an unexpected config file is reported, not worked around.
 */
import { useState } from 'react';

import { AppLink, Button, Field, fill, Ltr, Select, showToast, TextInput, useT } from '@/components/kit';
import { useDevices, useLinkFolder } from '@/features/devices/queries';
import type { SettingsMessages } from '@/features/settings/messages';
import { isHubError } from '@/lib/api/errors';

const ABSOLUTE = /^([A-Za-z]:[\\/]|\/)/;

export function LinkFolder({ slug }: { slug: string }) {
  const t = useT<SettingsMessages>('settings');
  const s = t.general.link;
  const devices = useDevices();
  const link = useLinkFolder();
  const online = (devices.data ?? []).filter((device) => device.online);
  const [chosen, setChosen] = useState<string | null>(null);
  const [folder, setFolder] = useState('');
  const [tried, setTried] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'alert'; text: React.ReactNode } | null>(null);
  const deviceId = chosen ?? online[0]?.id ?? '';
  const trimmed = folder.trim();
  const folderError =
    tried && (!ABSOLUTE.test(trimmed) || /(^|[\\/])\.\.([\\/]|$)/.test(trimmed))
      ? s.folderInvalid
      : undefined;

  const press = () => {
    setTried(true);
    setResult(null);
    if (!ABSOLUTE.test(trimmed) || /(^|[\\/])\.\.([\\/]|$)/.test(trimmed) || !deviceId) return;
    link.mutate(
      { deviceId, folder: trimmed },
      {
        onSuccess: (answer) => {
          setFolder('');
          setTried(false);
          if (answer.outcome === 'shape_unexpected') {
            setResult({ tone: 'alert', text: s.shapeUnexpected });
          } else if (answer.outcome === 'mcp_failed') {
            setResult({ tone: 'alert', text: s.mcpFailed });
          } else {
            setResult({
              tone: 'ok',
              text: (
                <>
                  {fill(answer.outcome === 'linked' ? s.linked : s.alreadyLinked, {
                    folder: <Ltr mono>{answer.folder}</Ltr>,
                    project: <Ltr mono>{slug}</Ltr>,
                  })}
                  {answer.backup && <> {fill(s.backup, { path: <Ltr mono>{answer.backup}</Ltr> })}</>}
                </>
              ),
            });
            showToast({ message: s.done });
          }
        },
        onError: (error) =>
          setResult({ tone: 'alert', text: isHubError(error) ? error.message : t.errorThing }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div>
        <p className="text-body-sm font-medium text-foreground">{s.title}</p>
        <p className="mt-0.5 text-body-sm text-muted-foreground">{s.body}</p>
      </div>
      {!devices.isPending && online.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          {fill(s.noDevice, {
            link: (
              <AppLink view="settings" query={{ tab: 'devices' }} className="text-primary underline">
                {t.tabs.devices}
              </AppLink>
            ),
          })}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Field id="link-folder" label={s.folder} hint={s.folderHint} error={folderError}>
              <TextInput
                id="link-folder"
                dir="ltr"
                className="key text-start"
                spellCheck={false}
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                aria-invalid={!!folderError}
              />
            </Field>
            <Field id="link-device" label={s.device}>
              <Select id="link-device" value={deviceId} onChange={(e) => setChosen(e.target.value)}>
                {online.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <Button busy={link.isPending} disabled={!deviceId} onClick={press}>
              {s.action}
            </Button>
          </div>
        </>
      )}
      {result && (
        <p
          role={result.tone === 'alert' ? 'alert' : 'status'}
          className={
            result.tone === 'alert'
              ? 'text-body-sm font-medium text-destructive-soft-foreground'
              : 'text-body-sm wrap-anywhere text-foreground'
          }
        >
          {result.text}
        </p>
      )}
    </div>
  );
}

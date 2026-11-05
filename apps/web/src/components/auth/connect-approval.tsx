'use client';

/**
 * @file connect-approval.tsx
 * @description The browser side of pairing (docs/16 §5, D42): a device ran the one command and opened this page. The owner compares the code with their terminal and approves. Only a signed-in session can do this, and the
 * device collects its credentials itself, so none ever reaches this page.
 */
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button, fill, Ltr, showToast } from '@/components/kit';
import { useAnswerPairing, usePairing } from '@/features/devices/queries';
import { isHubError } from '@/lib/api/errors';
import { useT } from '@/lib/i18n';
import type { AuthDict } from '@/lib/i18n/page-dicts';

import { AuthFrame, FormError } from './auth-frame';

const PLATFORM_WORDS = ['win32', 'darwin', 'linux'] as const;

export function ConnectApproval() {
  const t = useT<AuthDict>('auth');
  const s = t.connect;
  const code = useSearchParams().get('code');
  const pairing = usePairing(code);
  const answer = useAnswerPairing(code);
  const [choice, setChoice] = useState<'approve' | 'deny' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const send = (next: 'approve' | 'deny') => {
    setChoice(next);
    setFailure(null);
    answer.mutate(next, {
      onSuccess: () => showToast({ message: next === 'approve' ? s.approvedToast : s.deniedToast }),
      onError: (error) => setFailure(isHubError(error) ? error.message : s.failed),
    });
  };

  if (!code || pairing.isError) {
    return (
      <AuthFrame title={s.invalidTitle}>
        <p className="text-body text-muted-foreground">
          {isHubError(pairing.error) && pairing.error.status !== 404 ? pairing.error.message : s.invalidBody}
        </p>
      </AuthFrame>
    );
  }
  if (pairing.isPending) {
    return (
      <AuthFrame title={s.title}>
        <p role="status" className="text-body text-muted-foreground">
          {s.loading}
        </p>
      </AuthFrame>
    );
  }

  const { status, name, platform, userCode } = pairing.data;
  if (status === 'approved' || status === 'claimed') {
    return (
      <AuthFrame title={s.approvedTitle}>
        <p role="status" className="text-body text-muted-foreground">
          {s.approvedBody}
        </p>
      </AuthFrame>
    );
  }
  if (status === 'denied') {
    return (
      <AuthFrame title={s.deniedTitle}>
        <p role="status" className="text-body text-muted-foreground">
          {s.deniedBody}
        </p>
      </AuthFrame>
    );
  }
  if (status === 'expired') {
    return (
      <AuthFrame title={s.invalidTitle}>
        <p className="text-body text-muted-foreground">{s.invalidBody}</p>
      </AuthFrame>
    );
  }

  const platformWord = (PLATFORM_WORDS as readonly string[]).includes(platform)
    ? s.platforms[platform as (typeof PLATFORM_WORDS)[number]]
    : platform;

  return (
    <AuthFrame title={s.title} subtitle={s.subtitle}>
      <dl className="flex flex-col gap-3 rounded-md border border-border p-3">
        <div>
          <dt className="text-body-sm text-muted-foreground">{s.device}</dt>
          <dd className="text-body font-medium text-foreground">
            <span dir="auto">{name}</span> · {platformWord}
          </dd>
        </div>
        <div>
          <dt className="text-body-sm text-muted-foreground">{s.code}</dt>
          <dd className="text-title font-semibold text-foreground">
            <Ltr mono>{userCode}</Ltr>
          </dd>
        </div>
      </dl>
      <p className="text-body-sm text-muted-foreground">
        {fill(s.warning, { code: <Ltr mono>{userCode}</Ltr> })}
      </p>
      <FormError>{failure}</FormError>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          busy={answer.isPending && choice === 'approve'}
          disabled={answer.isPending}
          onClick={() => send('approve')}
        >
          {s.approve}
        </Button>
        <Button
          busy={answer.isPending && choice === 'deny'}
          disabled={answer.isPending}
          onClick={() => send('deny')}
        >
          {s.deny}
        </Button>
      </div>
    </AuthFrame>
  );
}

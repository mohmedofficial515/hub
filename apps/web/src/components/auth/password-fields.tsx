'use client';

/**
 * @file password-fields.tsx
 * @description New password twice, used by invite and reset (docs/09 §1.3, §1.4). The length is the API's own rule, 12 characters
 * (docs/04 §1.9): the page once said 10, and a friend who followed it was refused as "weak". The API also refuses a common password.
 * The hint is always visible rather than a meter that pretends to measure.
 */
import { useId } from 'react';

import { Field, TextInput } from '@/components/kit';
import { useT } from '@/lib/i18n';
import type { AuthDict } from '@/lib/i18n/page-dicts';

export const MIN_PASSWORD = 12;

export const passwordProblem = (t: AuthDict, password: string, confirm: string) => ({
  password: password.length < MIN_PASSWORD ? t.errors.passwordShort : undefined,
  confirm: confirm !== password ? t.errors.passwordMismatch : undefined,
});

export function PasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  tried,
}: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  tried: boolean;
}) {
  const t = useT<AuthDict>('auth');
  const id = useId();
  const problem = passwordProblem(t, password, confirm);
  return (
    <>
      <Field
        id={`${id}-new`}
        label={t.password.new}
        hint={t.password.hint}
        required
        error={tried ? problem.password : undefined}
      >
        <TextInput
          name="new-password"
          id={`${id}-new`}
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          className="text-start"
        />
      </Field>
      <Field
        id={`${id}-confirm`}
        label={t.password.confirm}
        required
        error={tried ? problem.confirm : undefined}
      >
        <TextInput
          name="confirm-password"
          id={`${id}-confirm`}
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          className="text-start"
        />
      </Field>
    </>
  );
}

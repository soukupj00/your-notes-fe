import { type FormEvent, type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { ProblemError } from '@/data/http/hal.ts';
import { platformOf } from '@/lib/deviceName.ts';

export type AccountValues = { username: string; password: string; deviceName: string };

/**
 * A 401 means a wrong password when one was typed, and a spent or expired link when a
 * Pairing Link was followed: the server never says why (backend ADR 0001).
 */
export function accountErrorKey(error: unknown, via: 'password' | 'link'): string {
  if (error instanceof ProblemError) {
    if (error.status === 401) {
      return via === 'password' ? 'account.errors.wrongCredentials' : 'account.errors.linkUsed';
    }
    if (error.status === 409) return 'account.errors.usernameTaken';
    return 'account.errors.unknown';
  }
  // `fetch` rejects with a TypeError when nothing answered at all.
  return error instanceof TypeError ? 'account.errors.unreachable' : 'account.errors.unknown';
}

function useDefaultDeviceName(): string {
  const { t } = useTranslation();
  const { browser, system } = platformOf(navigator.userAgent);
  return system ? t('account.deviceName.default', { browser, system }) : browser;
}

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <Input
        id={id}
        className="touch-target"
        aria-describedby={hint ? `${id}-hint` : undefined}
        required
        {...input}
      />
      {hint && (
        <span id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </span>
      )}
    </div>
  );
}

/**
 * The one form behind sign-in, creating the Owner, joining by Invite and pairing.
 * `onSubmit` throws to show an error; `via` says what a 401 means.
 */
export function AccountForm({
  credentials,
  submitLabel,
  via,
  onSubmit,
  secondary,
}: {
  /** `current` signs in with a password; `new` chooses one; absent asks for none. */
  credentials?: 'current' | 'new';
  submitLabel: string;
  via: 'password' | 'link';
  onSubmit: (values: AccountValues) => Promise<void>;
  /** A second action beside submit, such as Cancel in a dialog. */
  secondary?: ReactNode;
}) {
  const { t } = useTranslation();
  const defaultName = useDefaultDeviceName();
  const [values, setValues] = useState<AccountValues>({
    username: '',
    password: '',
    deviceName: defaultName,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const set = (key: keyof AccountValues) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...values, username: values.username.trim() });
    } catch (caught) {
      setError(accountErrorKey(caught, via));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => void submit(event)}
      aria-describedby={error ? errorId : undefined}
    >
      {credentials && (
        <>
          <Field
            label={t('account.username')}
            value={values.username}
            onChange={set('username')}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            pattern="\S+"
            maxLength={64}
          />
          <Field
            label={t('account.password')}
            type="password"
            value={values.password}
            onChange={set('password')}
            autoComplete={credentials === 'new' ? 'new-password' : 'current-password'}
            minLength={8}
            maxLength={256}
            hint={credentials === 'new' ? t('account.passwordHint') : undefined}
          />
        </>
      )}
      <Field
        label={t('account.deviceName.label')}
        hint={t('account.deviceName.hint')}
        value={values.deviceName}
        onChange={set('deviceName')}
        maxLength={64}
      />
      {error && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {t(error)}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {secondary}
        <Button type="submit" disabled={busy} className="gap-1">
          {busy && <Spinner />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

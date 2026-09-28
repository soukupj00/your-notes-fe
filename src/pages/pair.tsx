import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountForm, type AccountValues } from '@/components/account/AccountForm.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { ProblemError } from '@/data/http/hal.ts';
import type { Session } from '@/data/Remote.ts';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';

/**
 * Which of the three links this is. The server never says what kind a code is,
 * so the page asks what it can: a server without an Owner can only have printed
 * a setup code; otherwise a device code is tried first, and a refusal means an
 * Invite (a refused code is not spent, so trying costs nothing).
 */
type Mode = 'checking' | 'owner' | 'device' | 'invite' | 'unreachable' | 'missing';

/**
 * `/pair#<code>`: where every Pairing Link lands (backend `docs/setup.md`
 * sections 5 to 7). The code rides in the fragment so it never reaches a server
 * log. The person lands on the right form without choosing one.
 */
export default function PairPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { service, setSession } = useAccount();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const [code] = useState(() => decodeURIComponent(window.location.hash.slice(1)));
  const [mode, setMode] = useState<Mode>(!code ? 'missing' : service ? 'checking' : 'unreachable');

  useEffect(() => {
    if (!code || !service) return;
    let current = true;
    service
      .setupNeeded()
      .then((needed) => current && setMode(needed ? 'owner' : 'device'))
      .catch(() => current && setMode('unreachable'));
    return () => {
      current = false;
    };
  }, [code, service]);

  const done = (session: Session) => {
    setSession(session);
    void navigate({ to: '/' });
  };

  const submit = async ({ username, password, deviceName }: AccountValues) => {
    if (!service) return;
    if (mode === 'owner') return done(await service.setup(code, username, password, deviceName));
    if (mode === 'invite') return done(await service.join(code, username, password, deviceName));
    try {
      done(await service.pair(code, deviceName));
    } catch (error) {
      if (error instanceof ProblemError && error.status === 401) setMode('invite');
      else throw error;
    }
  };

  const copy = {
    owner: ['ownerTitle', 'ownerDescription', 'ownerAction'],
    device: ['deviceTitle', 'deviceDescription', 'deviceAction'],
    invite: ['inviteTitle', 'inviteDescription', 'inviteAction'],
  } as const;
  const form = mode === 'owner' || mode === 'device' || mode === 'invite' ? copy[mode] : null;

  return (
    <div className="mx-auto max-w-sm">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-2 font-semibold text-2xl focus-visible:outline-none"
      >
        {form ? t(`account.pair.${form[0]}`) : t('account.section.title')}
      </h1>
      {form && (
        <>
          <p className="mb-6 text-muted-foreground text-sm">{t(`account.pair.${form[1]}`)}</p>
          <div className="rounded-lg border bg-card p-4">
            {/* Keyed by mode so a switch to the Invite form starts clean, keeping nothing typed for another form. */}
            <AccountForm
              key={mode}
              credentials={mode === 'device' ? undefined : 'new'}
              via="link"
              submitLabel={t(`account.pair.${form[2]}`)}
              onSubmit={submit}
            />
          </div>
        </>
      )}
      {mode === 'checking' && (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <Spinner />
          {t('account.pair.checking')}
        </p>
      )}
      {(mode === 'missing' || mode === 'unreachable') && (
        <div className="flex flex-col items-start gap-4">
          <p role="alert" className="text-sm">
            {t(mode === 'missing' ? 'account.pair.missingCode' : 'account.errors.unreachable')}
          </p>
          <Link to="/" className="text-sm underline underline-offset-4">
            {t('account.pair.home')}
          </Link>
        </div>
      )}
    </div>
  );
}

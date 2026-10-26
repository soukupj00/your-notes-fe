import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Session } from '@/data/Remote.ts';

/** The initial, the username and the role, as both account cards show them. */
export function AccountIdentity({ session }: { session: Session }) {
  const { t } = useTranslation();

  return (
    <>
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-bold font-display text-primary-foreground text-xl"
      >
        {session.username.charAt(0).toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold text-sm">{session.username}</span>
        <span className="text-muted-foreground text-xs">
          {t(`account.section.${session.role}`)}
        </span>
      </span>
    </>
  );
}

export function HomeAccountCard({ session }: { session: Session }) {
  return (
    <section className="mb-4 rounded-card border bg-card">
      <Link
        to="/settings/account"
        className="flex min-h-18 items-center gap-3.5 rounded-card px-4 py-3 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <AccountIdentity session={session} />
        <ChevronRight aria-hidden className="size-4.5 shrink-0 text-muted-foreground" />
      </Link>
    </section>
  );
}

import { SignOutButton } from '@/components/account/SignOutButton.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { AccountIdentity } from './HomeAccountCard.tsx';

/**
 * Signed in only: a Device with no account gets `LocalOnlyCard` on the Settings home instead.
 * Signing out erases this Device and is refused while anything is owed (`SignOutButton`).
 */
export function AccountSection() {
  const { session } = useAccount();

  if (!session) return null;

  return (
    <section className="mb-8 flex min-h-18 items-center gap-3.5 rounded-card border bg-card px-4 py-3">
      <AccountIdentity session={session} />
      <SignOutButton />
    </section>
  );
}

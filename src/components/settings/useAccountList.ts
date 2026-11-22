import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAccount } from '@/context/AccountProvider.tsx';
import type { AccountService } from '@/data/Remote.ts';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';
import { useLatest } from '@/hooks/useLatest.ts';

const ALWAYS = () => true;

/**
 * A list the server keeps for this Account, read once per signed-in session, so another Device's
 * change shows up on the next visit. `null` reads nothing; a failed read toasts and keeps the list.
 */
export function useAccountList<T>(read: ((service: AccountService) => Promise<T[]>) | null) {
  const { t } = useTranslation();
  const { session, service } = useAccount();
  const [items, setItems] = useState<T[]>([]);
  const latestRead = useLatest(read);

  const load = useCallback(
    async (alive: () => boolean) => {
      const current = latestRead();
      if (!service || !current) return;
      try {
        const found = await current(service);
        if (alive()) setItems(found);
      } catch {
        if (alive()) toast.error(t('account.errors.unknown'));
      }
    },
    [latestRead, service, t]
  );

  const accountId = session?.accountId;
  const reads = read !== null;
  useAsyncEffect(
    (alive) => {
      if (accountId && reads) return load(alive);
    },
    [accountId, reads, load]
  );

  return { items, setItems, reload: () => load(ALWAYS) };
}

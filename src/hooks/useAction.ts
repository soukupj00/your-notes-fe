import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// `false` backs out quietly; a plain `async () => {}` or a `Promise<void>` call answers void.
type Act = () => Promise<boolean | undefined> | Promise<void>;

type Keys = {
  /** Toasted when `act` resolves, unless it answered `false` to say it backed out. */
  success?: string;
  /** Toasted when `act` throws; a function picks the key from the error. */
  failure?: string | ((error: unknown) => string);
};

/**
 * One thing the user asked for that takes a while: `busy` while it runs, a toast when it ends.
 * `run` answers whether `act` finished, so a caller can undo what it set up before the call.
 */
export function useAction(): {
  busy: boolean;
  run: (act: Act, keys?: Keys) => Promise<boolean>;
} {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (act: Act, keys: Keys = {}) => {
      setBusy(true);
      try {
        const outcome = await act();
        if (keys.success && outcome !== false) toast.success(t(keys.success));
        return true;
      } catch (error) {
        const failure = keys.failure ?? 'account.errors.unknown';
        toast.error(t(typeof failure === 'function' ? failure(error) : failure));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [t]
  );

  return { busy, run };
}

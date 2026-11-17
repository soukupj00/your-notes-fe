import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { appUpdate } from '@/lib/appUpdate.ts';
import { registerAppServiceWorker } from '@/lib/registerServiceWorker.ts';

/** Registers the service worker and turns a waiting update into a user decision. */
export function PwaUpdatePrompt() {
  const { t } = useTranslation();
  const translateRef = useRef(t);
  const registeredRef = useRef(false);

  useEffect(() => {
    translateRef.current = t;
  }, [t]);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    registerAppServiceWorker({
      // `appUpdate` reloads instead: the plugin skips the visit that first installed the worker,
      // which then stayed on the old code under the new worker.
      onNeedReload: () => undefined,
      onNeedRefresh: () => {
        appUpdate.reloadOnTakeover();
        const translate = translateRef.current;
        toast(translate('pwa.update.available'), {
          id: 'pwa-update-available',
          duration: Number.POSITIVE_INFINITY,
          action: {
            label: translate('pwa.update.reload'),
            onClick: () => void appUpdate.reloadIntoLatest(),
          },
          cancel: {
            label: translate('pwa.update.later'),
            onClick: () => undefined,
          },
        });
      },
    });
  }, []);

  return null;
}

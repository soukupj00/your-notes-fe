import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { registerAppServiceWorker } from '@/lib/registerServiceWorker.ts';

/** Registers the service worker and turns a waiting update into a user decision. */
export function PwaUpdatePrompt() {
  const { t } = useTranslation();
  const translateRef = useRef(t);
  const updateRef = useRef<ReturnType<typeof registerAppServiceWorker> | null>(null);
  const registeredRef = useRef(false);

  useEffect(() => {
    translateRef.current = t;
  }, [t]);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    updateRef.current = registerAppServiceWorker({
      onNeedRefresh: () => {
        const translate = translateRef.current;
        toast(translate('pwa.update.available'), {
          id: 'pwa-update-available',
          duration: Number.POSITIVE_INFINITY,
          action: {
            label: translate('pwa.update.reload'),
            onClick: () => void updateRef.current?.(true),
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

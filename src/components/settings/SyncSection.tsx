import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { useSync } from '@/context/SyncProvider.tsx';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';
import { formatBytes, formatDate, MEDIUM_DATE_TIME, SHORT_TIME } from '@/lib/format.ts';
import { PreferenceSwitch, SettingsRow, SettingsSection } from './SettingsSection.tsx';

type Storage = { persisted: boolean; usage?: number };

/** What the browser says about keeping this Device's data; `null` where it cannot say. */
function useStorage(): Storage | null {
  const [storage, setStorage] = useState<Storage | null>(null);
  useAsyncEffect(async (alive) => {
    const manager = navigator.storage;
    if (!manager?.persisted) return;
    const [persisted, estimate] = await Promise.all([manager.persisted(), manager.estimate?.()]);
    if (alive()) setStorage({ persisted, usage: estimate?.usage });
  }, []);
  return storage;
}

/** Signed in only: how far Sync has got, and how much of each Attachment comes down. */
export function SyncSection() {
  const { t, i18n } = useTranslation();
  const { active, status, lastSyncedAt, pending, syncNow } = useSync();
  if (!active) return null;

  // A time alone reads as today's, and the full date wraps on a phone in Czech.
  const lastSynced = (at: string) =>
    new Date(at).toDateString() === new Date().toDateString()
      ? t('sync.syncedAt', { time: formatDate(at, i18n.language, SHORT_TIME) })
      : t('sync.idle', { time: formatDate(at, i18n.language, MEDIUM_DATE_TIME) });

  const statusText =
    status === 'syncing'
      ? t('sync.syncing')
      : status === 'offline'
        ? t('sync.offline')
        : status === 'error'
          ? t('sync.error')
          : lastSyncedAt
            ? lastSynced(lastSyncedAt)
            : t('sync.never');

  return (
    <SettingsSection title={t('sync.label')}>
      <SettingsRow
        label={statusText}
        description={pending > 0 ? t('sync.pending', { count: pending }) : undefined}
      >
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 gap-1"
          disabled={status === 'syncing'}
          onClick={() => void syncNow()}
        >
          {status === 'syncing' && <Spinner />}
          {t('sync.syncNow')}
        </Button>
      </SettingsRow>
      <PreferenceSwitch pref="keepEverything" keys="sync.keepEverything" />
    </SettingsSection>
  );
}

/** "Is my data safe here?" (PLAN.md M5), where the browser can say. */
export function StorageSection() {
  const { t, i18n } = useTranslation();
  const storage = useStorage();
  if (!storage) return null;

  // A fresh library is tens of kilobytes; "0 B" would read as "nothing is stored".
  const used =
    storage.usage === undefined ? null : formatBytes(Math.max(storage.usage, 1000), i18n.language);

  return (
    <SettingsSection title={t('sync.storage.title')}>
      <SettingsRow
        label={used ? t('sync.storage.storedHere', { size: used }) : t('sync.storage.label')}
        description={
          storage.persisted ? t('sync.storage.persisted') : t('sync.storage.notPersisted')
        }
      >
        {null}
      </SettingsRow>
    </SettingsSection>
  );
}

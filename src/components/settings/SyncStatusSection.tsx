import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { useSync } from '@/context/SyncProvider.tsx';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';
import { formatBytes, formatDate, MEDIUM_DATE_TIME } from '@/lib/format.ts';
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

/** "Is my data safe here?" answered in one block (PLAN.md M5). */
export function SyncStatusSection() {
  const { t, i18n } = useTranslation();
  const storage = useStorage();
  const { active, status, lastSyncedAt, pending, syncNow } = useSync();
  if (!storage && !active) return null;

  const statusText =
    status === 'syncing'
      ? t('sync.syncing')
      : status === 'offline'
        ? t('sync.offline')
        : status === 'error'
          ? t('sync.error')
          : lastSyncedAt
            ? t('sync.idle', { time: formatDate(lastSyncedAt, i18n.language, MEDIUM_DATE_TIME) })
            : t('sync.never');
  const waiting = pending > 0 ? ` · ${t('sync.pending', { count: pending })}` : '';
  // A fresh library is tens of kilobytes; "0 B used" would read as "nothing is stored".
  const used =
    storage?.usage === undefined ? null : formatBytes(Math.max(storage.usage, 1000), i18n.language);

  return (
    <SettingsSection title={t('sync.title')}>
      {storage && (
        <SettingsRow
          label={t('sync.storage.label')}
          description={
            (storage.persisted ? t('sync.storage.persisted') : t('sync.storage.notPersisted')) +
            (used ? ` ${t('sync.storage.used', { size: used })}` : '')
          }
        >
          {null}
        </SettingsRow>
      )}
      {active && (
        <SettingsRow label={t('sync.label')} description={statusText + waiting}>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={status === 'syncing'}
            onClick={() => void syncNow()}
          >
            {status === 'syncing' && <Spinner />}
            {t('sync.syncNow')}
          </Button>
        </SettingsRow>
      )}
      {active && <PreferenceSwitch pref="keepEverything" keys="sync.keepEverything" />}
    </SettingsSection>
  );
}

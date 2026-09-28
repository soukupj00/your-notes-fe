import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { useSync } from '@/context/SyncProvider.tsx';
import { SettingsRow, SettingsSection, SwitchSetting } from './SettingsSection.tsx';

const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const unit = (name: 'kilobyte' | 'megabyte') =>
  new Intl.NumberFormat(undefined, { style: 'unit', unit: name, maximumFractionDigits: 1 });
const kilobytes = unit('kilobyte');
const megabytes = unit('megabyte');
/** A fresh library is tens of kilobytes; "0 MB used" would read as "nothing is stored". */
const size = (bytes: number) =>
  bytes < 1_000_000
    ? kilobytes.format(Math.max(1, Math.round(bytes / 1000)))
    : megabytes.format(bytes / 1_000_000);

type Storage = { persisted: boolean; usage?: number };

/** What the browser says about keeping this Device's data; `null` where it cannot say. */
function useStorage(): Storage | null {
  const [storage, setStorage] = useState<Storage | null>(null);
  useEffect(() => {
    const manager = navigator.storage;
    if (!manager?.persisted) return;
    let current = true;
    void Promise.all([manager.persisted(), manager.estimate?.()]).then(([persisted, estimate]) => {
      if (current) setStorage({ persisted, usage: estimate?.usage });
    });
    return () => {
      current = false;
    };
  }, []);
  return storage;
}

/**
 * "Is my data safe here?" answered in one block (PLAN.md M5): whether the
 * browser keeps this Device's copy, and - while signed in - how Sync is doing,
 * how many changes still wait for the server, and whether this Device keeps
 * every Attachment's bytes or only their Previews.
 */
export function SyncStatusSection() {
  const { t } = useTranslation();
  const storage = useStorage();
  const { active, status, lastSyncedAt, pending, syncNow } = useSync();
  const { preferences, setPreference } = usePreferences();
  if (!storage && !active) return null;

  const statusText =
    status === 'syncing'
      ? t('sync.syncing')
      : status === 'offline'
        ? t('sync.offline')
        : status === 'error'
          ? t('sync.error')
          : lastSyncedAt
            ? t('sync.idle', { time: when.format(new Date(lastSyncedAt)) })
            : t('sync.never');
  const waiting = pending > 0 ? ` · ${t('sync.pending', { count: pending })}` : '';

  return (
    <SettingsSection title={t('sync.title')}>
      {storage && (
        <SettingsRow
          label={t('sync.storage.label')}
          description={
            (storage.persisted ? t('sync.storage.persisted') : t('sync.storage.notPersisted')) +
            (storage.usage === undefined
              ? ''
              : ` ${t('sync.storage.used', { size: size(storage.usage) })}`)
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
      {active && (
        <SwitchSetting
          label={t('sync.keepEverything.label')}
          description={t('sync.keepEverything.description')}
          checked={preferences.keepEverything}
          onChange={(next) => void setPreference('keepEverything', next)}
        />
      )}
    </SettingsSection>
  );
}

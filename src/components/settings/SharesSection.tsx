import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import type { Share } from '@/data/Remote.ts';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

type Row = Share & { header: string | undefined };

/**
 * Every Share Link the Account has open, so none is forgotten (backend
 * `docs/setup.md` section 11: one opens for anyone who can reach the server).
 * Headers come from this Device's own copy of each Note.
 */
export function SharesSection() {
  const { t } = useTranslation();
  const { session, service } = useAccount();
  const store = useLocalStore();
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    if (!service) return;
    const shares = await service.shares();
    const notes = await Promise.all(shares.map((s) => store.notes.get(s.noteId)));
    return shares.map((s, i) => ({ ...s, header: notes[i]?.header?.trim() || undefined }));
  }, [service, store]);

  const accountId = session?.accountId;
  useEffect(() => {
    if (!accountId) return;
    let current = true;
    load()
      .then((found) => current && found && setRows(found))
      .catch(() => current && toast.error(t('account.errors.unknown')));
    return () => {
      current = false;
    };
  }, [accountId, load, t]);

  if (!session || !service) return null;

  const stop = async (share: Share) => {
    try {
      await service.revokeShare(share.id);
      setRows((all) => all.filter((r) => r.id !== share.id));
      toast.success(t('share.stopped'));
    } catch {
      toast.error(t('account.errors.unknown'));
    }
  };

  return (
    <SettingsSection title={t('share.section.title')}>
      {rows.length === 0 && <SettingsRow label={t('share.section.none')}>{null}</SettingsRow>}
      {rows.map((row) => (
        <SettingsRow key={row.id} label={row.header ?? t('share.untitled')}>
          <Button variant="outline" size="sm" onClick={() => void stop(row)}>
            {t('share.stop')}
          </Button>
        </SettingsRow>
      ))}
    </SettingsSection>
  );
}

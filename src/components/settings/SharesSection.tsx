import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import type { Share } from '@/data/Remote.ts';
import { useAction } from '@/hooks/useAction.ts';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

type Row = Share & { header: string | undefined };

/**
 * Every open Share Link, so none is forgotten: one opens for anyone who can reach the
 * server (backend `docs/setup.md` section 11). Headers come from this Device's copy.
 */
export function SharesSection() {
  const { t } = useTranslation();
  const { session, service } = useAccount();
  const store = useLocalStore();
  const [rows, setRows] = useState<Row[]>([]);
  const { busy, run } = useAction();

  const load = useCallback(async () => {
    if (!service) return;
    const shares = await service.shares();
    const notes = await Promise.all(shares.map((s) => store.notes.get(s.noteId)));
    return shares.map((s, i) => ({ ...s, header: notes[i]?.header?.trim() || undefined }));
  }, [service, store]);

  const accountId = session?.accountId;
  useAsyncEffect(
    async (alive) => {
      if (!accountId) return;
      try {
        const found = await load();
        if (alive() && found) setRows(found);
      } catch {
        if (alive()) toast.error(t('account.errors.unknown'));
      }
    },
    [accountId, load, t]
  );

  if (!session || !service) return null;

  const stop = (share: Share) =>
    run(
      async () => {
        await service.revokeShare(share.id);
        setRows((all) => all.filter((r) => r.id !== share.id));
      },
      { success: 'share.stopped' }
    );

  return (
    <SettingsSection title={t('share.section.title')}>
      {rows.length === 0 && <SettingsRow label={t('share.section.none')}>{null}</SettingsRow>}
      {rows.map((row) => (
        <SettingsRow key={row.id} label={row.header ?? t('share.untitled')}>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void stop(row)}>
            {t('share.stop')}
          </Button>
        </SettingsRow>
      ))}
    </SettingsSection>
  );
}

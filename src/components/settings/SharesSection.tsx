import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { useAccount } from '@/context/AccountProvider.tsx';
import type { Share } from '@/data/Remote.ts';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { useAction } from '@/hooks/useAction.ts';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';
import { useAccountList } from './useAccountList.ts';

type Row = Share & { header: string | undefined };

/**
 * Every open Share Link, so none is forgotten: one opens for anyone who can reach the
 * server (backend `docs/setup.md` section 11). Headers come from this Device's copy.
 */
export function SharesSection() {
  const { t } = useTranslation();
  const { session, service } = useAccount();
  const { getNote } = useNoteActions();
  const { items: rows, setItems: setRows } = useAccountList<Row>(async (account) => {
    const shares = await account.shares();
    const notes = await Promise.all(shares.map((s) => getNote(s.noteId)));
    return shares.map((s, i) => ({ ...s, header: notes[i]?.header?.trim() || undefined }));
  });
  const { busy, run } = useAction();

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
      {rows.length === 0 && (
        <p className="px-4 py-3 text-muted-foreground text-sm">{t('share.section.none')}</p>
      )}
      {rows.map((row) => {
        const name = row.header ?? t('share.untitled');
        return (
          <SettingsRow key={row.id} label={name}>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={busy}
              onClick={() => void stop(row)}
              aria-label={t('share.stopNamed', { name })}
            >
              {t('share.stop')}
            </Button>
          </SettingsRow>
        );
      })}
    </SettingsSection>
  );
}

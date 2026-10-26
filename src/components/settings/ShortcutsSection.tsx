import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx';
import { useShortcuts } from '@/hooks/useShortcuts.ts';
import { SHORTCUTS, type ShortcutScope } from '@/lib/shortcuts.ts';
import { SettingsSection } from './SettingsSection.tsx';
import { ShortcutRow } from './ShortcutRow.tsx';

const GROUPS: readonly ShortcutScope[] = ['app', 'editor'];

/**
 * Not a column in the Layout editor: a shortcut answers how to act without the bar. Untitled: its
 * page is named Keyboard shortcuts, and only a fine pointer reaches it.
 */
export function ShortcutsSection() {
  const { t } = useTranslation();
  const { resetAll } = useShortcuts();
  const [confirming, setConfirming] = useState(false);

  return (
    <SettingsSection>
      <p className="px-4 py-3 text-muted-foreground text-sm">
        {t('settings.shortcuts.description')}
      </p>
      {GROUPS.map((scope) => (
        <fieldset key={scope}>
          <legend className="px-4 pt-3 pb-1 font-medium text-muted-foreground text-xs">
            {t(`settings.shortcuts.group.${scope}`)}
          </legend>
          <ul className="divide-y">
            {SHORTCUTS.filter((def) => def.scope === scope).map((def) => (
              <ShortcutRow key={def.id} def={def} />
            ))}
          </ul>
        </fieldset>
      ))}
      <div className="px-4 py-3">
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t('settings.shortcuts.resetAllTitle')}
          description={t('settings.shortcuts.resetAllBody')}
          confirmLabel={t('settings.shortcuts.resetAllConfirm')}
          cancelLabel={t('settings.shortcuts.cancel')}
          onConfirm={resetAll}
        >
          <Button type="button" variant="outline" size="sm" className="min-h-11">
            {t('settings.shortcuts.resetAll')}
          </Button>
        </ConfirmDialog>
      </div>
    </SettingsSection>
  );
}

export default ShortcutsSection;

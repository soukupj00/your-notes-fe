import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { useShortcuts } from '@/hooks/useShortcuts.ts';
import { SHORTCUTS, type ShortcutScope } from '@/lib/shortcuts.ts';
import { SettingsSection } from './SettingsSection.tsx';
import { ShortcutRow } from './ShortcutRow.tsx';

const GROUPS: readonly ShortcutScope[] = ['app', 'editor'];

/**
 * Not a column in the Layout editor: a shortcut answers how to act without the bar.
 * Hidden on a coarse pointer, as in `ActionButton`: a phone has no modifier keys.
 */
export function ShortcutsSection() {
  const { t } = useTranslation();
  const finePointer = useFinePointer();
  const { resetAll } = useShortcuts();
  const [confirming, setConfirming] = useState(false);

  if (!finePointer) return null;

  return (
    <SettingsSection title={t('settings.shortcuts.title')}>
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
          <Button type="button" variant="outline" size="sm">
            {t('settings.shortcuts.resetAll')}
          </Button>
        </ConfirmDialog>
      </div>
    </SettingsSection>
  );
}

export default ShortcutsSection;

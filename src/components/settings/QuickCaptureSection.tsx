import { useTranslation } from 'react-i18next';
import { QUICK_CAPTURE_ACTIONS } from '@/components/notes/quickCaptureActions.ts';
import {
  type QuickCapturePref,
  reconcileQuickCapture,
} from '@/components/notes/quickCaptureLayout.ts';
import { SettingsRow, SettingsSection } from '@/components/settings/SettingsSection.tsx';
import { SortableList, SortableRow } from '@/components/ui/SortableList.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';

const ALIGNMENTS = ['left', 'right'] as const;

/**
 * The quick-capture starts: which ways of starting a note the `＋` offers, in
 * what order, and which thumb it sits under.
 *
 * The same sortable rows as the toolbar over a deliberately plainer model - one
 * flat ordered list, no families and no Width Classes (ADR 0011, decision 14).
 */
export function QuickCaptureSection() {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();
  const actions = reconcileQuickCapture(preferences.quickCapture);
  const write = (next: QuickCapturePref[]) => setPreference('quickCapture', next);

  const nameOf = (id: string) =>
    t(QUICK_CAPTURE_ACTIONS.find((action) => action.key === id)?.labelKey ?? id);
  // On a phone the dial is the only way to start a note, so the last start on it
  // may not be switched off. Refusing at the switch says so where the user is,
  // rather than leaving them a `＋` that opens an empty menu.
  const onCount = actions.filter((entry) => entry.on).length;

  return (
    <SettingsSection title={t('settings.quickCapture.title')}>
      <SettingsRow
        label={t('settings.quickCapture.alignment.label')}
        description={t('settings.quickCapture.alignment.description')}
      >
        <ToggleGroup
          type="single"
          value={preferences.noteButtonAlignment}
          onValueChange={(next) =>
            setPreference('noteButtonAlignment', (next as 'left' | 'right') || 'right')
          }
          variant="outline"
          size="sm"
          aria-label={t('settings.quickCapture.alignment.label')}
        >
          {ALIGNMENTS.map((option) => (
            <ToggleGroupItem key={option} value={option}>
              {t(`settings.quickCapture.alignment.${option}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </SettingsRow>

      <SortableList
        ids={actions.map((entry) => entry.id)}
        nameOf={nameOf}
        onReorder={(activeId, overId) => {
          const from = actions.findIndex((entry) => entry.id === activeId);
          const to = actions.findIndex((entry) => entry.id === overId);
          if (from === -1 || to === -1) return;
          const next = [...actions];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          void write(next);
        }}
      >
        <ul className="divide-y py-1">
          {actions.map((entry) => {
            const action = QUICK_CAPTURE_ACTIONS.find((candidate) => candidate.key === entry.id);
            const Icon = action?.Icon;
            const last = entry.on && onCount === 1;
            const name = nameOf(entry.id);
            return (
              <li key={entry.id}>
                <SortableRow id={entry.id} handleLabel={t('dnd.handle', { name })}>
                  <span className="flex min-h-11 flex-1 items-center gap-2 px-1">
                    {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{name}</span>
                      {last && (
                        <span className="text-muted-foreground text-xs">
                          {t('settings.quickCapture.lastOne')}
                        </span>
                      )}
                    </span>
                  </span>
                  <Switch
                    className="touch-target mx-2"
                    checked={entry.on}
                    disabled={last}
                    onCheckedChange={(on) =>
                      write(actions.map((row) => (row.id === entry.id ? { ...row, on } : row)))
                    }
                    aria-label={t('settings.quickCapture.show', { name })}
                  />
                </SortableRow>
              </li>
            );
          })}
        </ul>
      </SortableList>
    </SettingsSection>
  );
}

export default QuickCaptureSection;

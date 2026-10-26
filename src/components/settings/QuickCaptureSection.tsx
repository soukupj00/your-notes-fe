import { useTranslation } from 'react-i18next';
import { QUICK_CAPTURE_ACTIONS } from '@/components/notes/quickCaptureActions.ts';
import {
  type QuickCapturePref,
  reconcileQuickCapture,
} from '@/components/notes/quickCaptureLayout.ts';
import { PickerTiles } from '@/components/settings/PickerTiles.tsx';
import { SettingsSection } from '@/components/settings/SettingsSection.tsx';
import { SortableList, SortableRow } from '@/components/ui/SortableList.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { NOTE_BUTTON_ALIGNMENT_OPTIONS, usePreferences } from '@/context/PreferencesProvider.tsx';
import { moveById } from '@/lib/move-by-id.ts';
import { cn } from '@/lib/utils.ts';

/** A phone outline with the ＋ in the corner it will sit in. */
function PhonePicture({ side }: { side: 'left' | 'right' }) {
  return (
    <span className="relative block h-16 w-full rounded-t-control border-(--rule-control) border-2 border-b-0 bg-muted">
      <span
        className={cn(
          'absolute bottom-2 flex size-5.5 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground leading-none',
          side === 'left' ? 'left-2' : 'right-2'
        )}
      >
        +
      </span>
    </span>
  );
}

/** The ＋ is phone-only (`QuickCaptureBar`), so its side means nothing from `sm:` up. */
function PlacementSection() {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();
  const label = t('settings.quickCapture.placement');

  return (
    <section className="mb-8 sm:hidden">
      <h2 className="mb-2 font-medium text-muted-foreground text-sm">{label}</h2>
      <PickerTiles
        label={label}
        value={preferences.noteButtonAlignment}
        onChange={(next) => void setPreference('noteButtonAlignment', next)}
        options={NOTE_BUTTON_ALIGNMENT_OPTIONS.map((side) => ({
          value: side,
          label: t(`settings.quickCapture.alignment.${side}`),
          picture: <PhonePicture side={side} />,
        }))}
      />
    </section>
  );
}

/**
 * The toolbar's sortable rows over a deliberately plainer model: one flat ordered list,
 * no families and no Width Classes (ADR 0011, decision 14).
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
    <>
      <PlacementSection />
      <SettingsSection title={t('settings.quickCapture.menuItems')}>
        <SortableList
          ids={actions.map((entry) => entry.id)}
          nameOf={nameOf}
          onReorder={(activeId, overId) => write(moveById(actions, activeId, overId))}
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
                      {Icon && (
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
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
                      className="touch-reach mx-2"
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
    </>
  );
}

export default QuickCaptureSection;

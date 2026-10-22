import { Fragment, type KeyboardEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TOOLBAR_ITEMS } from '@/components/editor/toolbar/registry.ts';
import { Button } from '@/components/ui/button.tsx';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { useShortcuts } from '@/hooks/useShortcuts.ts';
import { comboFromEvent, comboLabel, MODIFIER_KEYS } from '@/lib/key-combo.ts';
import { getShortcutKeys } from '@/lib/shortcut-keys.ts';
import { refusalOf } from '@/lib/shortcuts.ts';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

/**
 * In registry order, so it reads like the Layout editor and the bar. Static, as Settings
 * has no live editor; `shortcuts.test.ts` pins each entry to the real button.
 */
const SHORTCUT_ROWS = TOOLBAR_ITEMS.flatMap(({ id, labelKey, shortcut }) =>
  shortcut?.length ? [{ id, labelKey, shortcut }] : []
);

/**
 * Not a column in the Layout editor: a shortcut answers how to act without the bar.
 * Hidden on a coarse pointer, as in `ActionButton`: a phone has no modifier keys.
 */
export function ShortcutsSection() {
  const { t } = useTranslation();
  const finePointer = useFinePointer();

  if (!finePointer) return null;

  return (
    <SettingsSection title={t('settings.shortcuts.title')}>
      <p className="px-4 py-3 text-muted-foreground text-sm">
        {t('settings.shortcuts.description')}
      </p>
      <NewNoteKeyRow />
      {SHORTCUT_ROWS.map((row) => (
        <SettingsRow key={row.id} label={t(row.labelKey)}>
          <ShortcutKeys keys={row.shortcut} />
        </SettingsRow>
      ))}
    </SettingsSection>
  );
}

/**
 * `tracking-normal`: the label token's spacing shifts a cap's glyph off centre.
 * `font-sans`: most monospace faces lack the modifier symbols.
 */
const KEYCAP =
  'inline-flex min-w-7 items-center justify-center rounded-control border bg-muted px-1.5 py-1 font-sans text-label text-muted-foreground tracking-normal';

type Recording = 'idle' | 'listening' | 'refused';

/**
 * Change listens on its own button, so focus never moves and leaving it cancels. Turn off and
 * Reset unmount themselves, so they hand focus back to Change.
 */
function NewNoteKeyRow() {
  const { t } = useTranslation();
  const { bindings, stored, assign, reset } = useShortcuts();
  const [recording, setRecording] = useState<Recording>('idle');
  const changeRef = useRef<HTMLButtonElement>(null);
  const key = bindings['new-note'];

  const store = (next: string | null | 'default') => {
    if (next === 'default') reset('new-note');
    else assign('new-note', next);
    changeRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (recording === 'idle' || MODIFIER_KEYS.has(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') {
      setRecording('idle');
      return;
    }
    const combo = comboFromEvent(event.nativeEvent);
    if (combo && !refusalOf(combo, 'app')) {
      setRecording('idle');
      store(combo);
    } else {
      setRecording('refused');
    }
  };

  const status = {
    idle: 'settings.shortcuts.newNote.description',
    listening: 'settings.shortcuts.newNote.recording',
    refused: 'settings.shortcuts.newNote.refused',
  }[recording];

  return (
    <SettingsRow
      label={t('settings.shortcuts.newNote.label')}
      description={
        // A fixed width, so a longer message never moves the controls onto their own line.
        <span role="status" className="block w-64 max-w-full">
          {t(status)}
        </span>
      }
    >
      <fieldset
        aria-label={t('settings.shortcuts.newNote.label')}
        className="flex flex-wrap items-center gap-2"
      >
        {key === null ? (
          <span className="text-muted-foreground text-sm">
            {t('settings.shortcuts.newNote.off')}
          </span>
        ) : (
          <kbd className={KEYCAP}>{comboLabel(key)}</kbd>
        )}
        <Button
          ref={changeRef}
          type="button"
          variant="outline"
          size="sm"
          className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
          aria-pressed={recording !== 'idle'}
          // Space and Enter are refused keys while listening, not a second press. Focused by hand,
          // as Safari and Firefox on macOS do not focus a clicked button.
          onClick={(event) => {
            if (recording !== 'idle') return;
            event.currentTarget.focus();
            setRecording('listening');
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setRecording('idle')}
        >
          {t('settings.shortcuts.newNote.change')}
        </Button>
        {key !== null && (
          <Button type="button" variant="outline" size="sm" onClick={() => store(null)}>
            {t('settings.shortcuts.newNote.turnOff')}
          </Button>
        )}
        {'new-note' in stored && (
          <Button type="button" variant="outline" size="sm" onClick={() => store('default')}>
            {t('settings.shortcuts.newNote.reset')}
          </Button>
        )}
      </fieldset>
    </SettingsRow>
  );
}

function ShortcutKeys({ keys }: { keys: string[] }) {
  const parts = getShortcutKeys(keys);

  return (
    <>
      {/* `⌘` and `⇧` are glyphs, not words - a screen reader gets punctuation or
          silence from them. It reads the names the same map already carries. */}
      <span className="sr-only">{parts.map((part) => part.readable).join(' + ')}</span>
      <span aria-hidden className="flex items-center gap-1">
        {parts.map((part, index) => (
          <Fragment key={part.readable}>
            {index > 0 && <span className="text-muted-foreground text-xs">+</span>}
            <kbd className={KEYCAP}>{part.symbol}</kbd>
          </Fragment>
        ))}
      </span>
    </>
  );
}

export default ShortcutsSection;

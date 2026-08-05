import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { TOOLBAR_ITEMS } from '@/components/editor/toolbar/registry.ts';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { getShortcutKeys } from '@/utils/platform.ts';
import { SettingsRow, SettingsSection } from './SettingsSection.tsx';

/**
 * Every action that answers to a key combination, in registry order - so the
 * list reads in the same order as the Layout editor above it and the bar itself.
 *
 * Static, because the registry is: this screen has no live editor to resolve
 * button views against, which is the same reason `ToolbarPreviewStrip` draws a
 * picture instead of mounting TipTap. `shortcuts.test.ts` pins each entry to the
 * real button, so the list cannot advertise a key the editor does not bind.
 */
const SHORTCUT_ROWS = TOOLBAR_ITEMS.flatMap(({ id, labelKey, shortcut }) =>
  shortcut?.length ? [{ id, labelKey, shortcut }] : []
);

/**
 * The keyboard shortcuts, as a read-only list.
 *
 * Deliberately not a column in the Layout editor: that editor answers "what is
 * on my bar, and in what order", and a shortcut answers "how do I do this
 * *without* the bar" - the opposite question, and the one piece of text in those
 * rows that would not be about the row's own state.
 *
 * Hidden entirely on a coarse pointer, on the same signal `ActionButton` uses to
 * drop the hint from its tooltip: a phone has no modifier keys, so every row
 * here would be a promise it cannot keep.
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
      {SHORTCUT_ROWS.map((row) => (
        <SettingsRow key={row.id} label={t(row.labelKey)}>
          <ShortcutKeys keys={row.shortcut} />
        </SettingsRow>
      ))}
    </SettingsSection>
  );
}

/** One combination, drawn as key caps. */
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
            {/* `text-label` for the size (the 11px floor), but `tracking-normal`
                over it: the token's 0.1em is for reading a word of metadata,
                and on a cap it is a trailing space that shifts the glyph off
                centre. `font-sans` because the modifier symbols are missing
                from most monospace faces, which `kbd` defaults to. */}
            <kbd className="inline-flex min-w-7 items-center justify-center rounded-control border bg-muted px-1.5 py-1 font-sans text-label text-muted-foreground tracking-normal">
              {part.symbol}
            </kbd>
          </Fragment>
        ))}
      </span>
    </>
  );
}

export default ShortcutsSection;

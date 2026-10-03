import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { TOOLBAR_ITEMS } from '@/components/editor/toolbar/registry.ts';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { getShortcutKeys } from '@/lib/shortcut-keys.ts';
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
      {SHORTCUT_ROWS.map((row) => (
        <SettingsRow key={row.id} label={t(row.labelKey)}>
          <ShortcutKeys keys={row.shortcut} />
        </SettingsRow>
      ))}
    </SettingsSection>
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
            {/* `tracking-normal`: the label token's spacing shifts a cap's glyph off centre.
                `font-sans`: most monospace faces lack the modifier symbols. */}
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

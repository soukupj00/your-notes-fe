import { Search } from 'lucide-react';
import type * as React from 'react';
import { useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { SortMenu } from '@/components/notes/SortMenu.tsx';
import { ViewModeToggle } from '@/components/notes/ViewModeToggle.tsx';
import { Input } from '@/components/ui/input.tsx';
import { useTourActive } from '@/context/TourProvider.tsx';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { useNoteSearchState } from '@/hooks/useNoteSearchState.ts';
import { getShortcutKey } from '@/lib/shortcut-keys.ts';
import { cn } from '@/lib/utils.ts';

type SearchInputProps = React.ComponentProps<'div'> & {
  /**
   * Binds `mod+K`. Opt-in because the Navbar renders a desktop and a mobile bar, and two bindings
   * would race to focus the hidden one. Whether the hint chip shows is Pointer Class's question
   * (ADR 0016), not this prop's.
   */
  enableShortcut?: boolean;
};

function SearchInput({ className, enableShortcut = false, ...props }: SearchInputProps) {
  const { search, setSearch } = useNoteSearchState();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const tourActive = useTourActive();
  // Binding without a hint is fine (a Coarse phone may have a Bluetooth keyboard); a hint
  // without a key is the promise ADR 0016 forbids.
  const finePointer = useFinePointer();
  const showShortcut = enableShortcut && finePointer;

  // `enableOnFormTags` so search works from inside the note title too. Stood down during the
  // Tour: the document-level binding fires through the scrim at a field the Tour made inert.
  useHotkeys(
    'mod+k',
    () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
    {
      enabled: enableShortcut && !tourActive,
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    }
  );

  const modSymbol = getShortcutKey('mod').symbol;

  return (
    <div
      className={cn(
        'relative w-full rounded-full border border-input bg-card shadow-rest transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30',
        className
      )}
      {...props}
    >
      <Search
        size={18}
        className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        placeholder={t('notes.searchPlaceholder')}
        className={cn(
          'h-11 w-full rounded-full border-0 bg-transparent py-2 pl-9 text-body text-foreground shadow-none placeholder:text-muted-foreground focus:outline-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent',
          showShortcut ? 'pr-32' : 'pr-24'
        )}
        value={search.q}
        // Typing is not navigation: replace the history entry so the back
        // button leaves the search rather than un-typing it letter by letter.
        onChange={(e) => setSearch({ q: e.target.value }, { replace: true })}
      />
      <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
        {/* Not hidden on focus, so the controls beside it never shift. `aria-hidden`: a key
            combination is noise to a screen reader on the field itself. */}
        {showShortcut && (
          <kbd
            aria-hidden
            className="mr-1 inline-block select-none rounded border bg-muted px-1.5 py-0.5 font-medium font-sans text-[10px] text-muted-foreground"
          >
            {modSymbol} K
          </kbd>
        )}
        <SortMenu />
        <ViewModeToggle className="touch-target size-8" />
      </div>
    </div>
  );
}

export { SearchInput };

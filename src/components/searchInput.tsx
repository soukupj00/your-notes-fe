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
import { getShortcutKey, IS_MAC } from '@/lib/shortcut-keys.ts';
import { cn } from '@/lib/utils.ts';

function SearchInput({ className, ...props }: React.ComponentProps<'div'>) {
  const { search, setSearch } = useNoteSearchState();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const tourActive = useTourActive();
  // Every box binds the key (a Coarse phone may have a Bluetooth keyboard); only a Fine pointer
  // is shown it (ADR 0016).
  const showShortcut = useFinePointer();

  // Our own IS_MAC, as the editor and the chip use: the library's `mod` reads an old iPad as no Mac.
  // Works from any field but never out of an open note, whose dialog keeps focus (in its body the key
  // is Link). Stands down during the Tour and in whichever of the Navbar's two boxes CSS hides.
  useHotkeys(
    IS_MAC ? 'meta+k' : 'ctrl+k',
    () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
    {
      enabled: !tourActive,
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
      ignoreEventWhen: (e) => e.defaultPrevented || !inputRef.current?.getClientRects().length,
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
        className="absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-muted-foreground"
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

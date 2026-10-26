import { Search } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SortMenu } from '@/components/notes/SortMenu.tsx';
import { ViewModeToggle } from '@/components/notes/ViewModeToggle.tsx';
import { Input } from '@/components/ui/input.tsx';
import { useTourActive } from '@/context/TourProvider.tsx';
import { useKeyboardAffordances } from '@/hooks/useKeyboardAffordances.ts';
import { useNoteSearchState } from '@/hooks/useNoteSearchState.ts';
import { useShortcuts } from '@/hooks/useShortcuts.ts';
import { isAppShortcut } from '@/lib/app-shortcut.ts';
import { comboLabel } from '@/lib/key-combo.ts';
import { cn } from '@/lib/utils.ts';

function SearchInput({ className, ...props }: React.ComponentProps<'div'>) {
  const { search, setSearch } = useNoteSearchState();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const tourActive = useTourActive();
  // Every box binds the key; the chip waits for a keyboard to press it on (ADR 0028).
  const showShortcut = useKeyboardAffordances();

  const searchKey = useShortcuts().bindings.search;

  // Stands down during the Tour and in whichever of the Navbar's two boxes CSS hides;
  // `isAppShortcut` keeps it out of an open note, where Ctrl+K is Link.
  useEffect(() => {
    if (tourActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const input = inputRef.current;
      if (!input?.getClientRects().length || !isAppShortcut(event, searchKey)) return;
      event.preventDefault();
      input.focus();
      input.select();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [tourActive, searchKey]);

  return (
    <div
      className={cn(
        'relative flex w-full items-center rounded-full border border-input bg-card shadow-rest transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30',
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
        className="h-11 min-w-0 flex-1 rounded-full border-0 bg-transparent py-2 pr-2 pl-9 text-body text-foreground shadow-none placeholder:text-muted-foreground focus:outline-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
        value={search.q}
        // Typing is not navigation: replace the history entry so the back
        // button leaves the search rather than un-typing it letter by letter.
        onChange={(e) => setSearch({ q: e.target.value }, { replace: true })}
      />
      {/* A sibling, not an overlay: a long search key takes width from the field, not its text. */}
      <div className="flex shrink-0 items-center pr-1">
        {/* Not hidden on focus, so the controls beside it never shift. `aria-hidden`: a key
            combination is noise to a screen reader on the field itself. */}
        {showShortcut && searchKey && (
          <kbd
            aria-hidden
            className="mr-1 inline-block select-none rounded border bg-muted px-1.5 py-0.5 font-medium font-sans text-[10px] text-muted-foreground"
          >
            {comboLabel(searchKey)}
          </kbd>
        )}
        <SortMenu />
        <ViewModeToggle className="touch-target size-8" />
      </div>
    </div>
  );
}

export { SearchInput };

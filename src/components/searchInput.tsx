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
import { cn } from '@/lib/utils.ts';
import { getShortcutKey } from '@/utils/platform.ts';

type SearchInputProps = React.ComponentProps<'div'> & {
  /**
   * Bind `mod+K` to this box. Opt-in because the Navbar renders a desktop and a
   * mobile variant: if both bound it, the shortcut would race and could focus
   * the one CSS has hidden. Only the desktop bar takes it.
   *
   * It does *not* decide whether the hint chip shows - that is Pointer Class's
   * question (ADR 0016), and this prop answers a width one. A phone in landscape
   * is 844px wide, so it renders the desktop bar and used to be shown a `⌘K`
   * chip for keys it does not have.
   */
  enableShortcut?: boolean;
};

function SearchInput({ className, enableShortcut = false, ...props }: SearchInputProps) {
  const { search, setSearch } = useNoteSearchState();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const tourActive = useTourActive();
  // The chip is Fine-pointer only; the *binding* stays on the prop alone. The
  // two are allowed to disagree, and only in this direction: a phone with a
  // Bluetooth keyboard is Coarse and can still press the combination, so a
  // working shortcut with no hint costs nothing, while a hint with no key is
  // the promise ADR 0016 exists to stop making.
  const finePointer = useFinePointer();
  const showShortcut = enableShortcut && finePointer;

  // `enableOnFormTags`: search is a global escape hatch, so it has to work from
  // inside the note title field too, not only from a "neutral" focus.
  //
  // Stood down while the Tour runs. The binding is on the document with
  // `preventDefault`, so it fires straight through the scrim - and the one thing
  // it does, focusing a field the Tour has marked inert, is the one thing that
  // cannot work while the Tour is up.
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
          // Room for sort + layout, plus the hint chip where it is shown.
          showShortcut ? 'pr-32' : 'pr-24'
        )}
        value={search.q}
        // Typing is not navigation: replace the history entry so the back
        // button leaves the search rather than un-typing it letter by letter.
        onChange={(e) => setSearch({ q: e.target.value }, { replace: true })}
      />
      {/* Both feed controls sit in the bar's right corner: sort, layout toggle. */}
      <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
        {/* The shortcut hint is always rendered rather than hidden on focus, so
            the controls beside it never shift. `aria-hidden`: it names a key
            combination, which is noise to a screen reader on the field itself.
            No breakpoint on it any more - `showShortcut` already asked the only
            question that matters, which is whether there are keys to press. */}
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

import { Search } from 'lucide-react';
import type * as React from 'react';
import { useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { SortMenu } from '@/components/notes/SortMenu.tsx';
import { ViewModeToggle } from '@/components/notes/ViewModeToggle.tsx';
import { Input } from '@/components/ui/input.tsx';
import { useNoteSearchState } from '@/hooks/useNoteSearchState.ts';
import { cn } from '@/lib/utils.ts';
import { getShortcutKey } from '@/utils/platform.ts';

type SearchInputProps = React.ComponentProps<'div'> & {
  /**
   * Bind `mod+K` to this box. Opt-in because the Navbar renders a desktop and a
   * mobile variant: if both bound it, the shortcut would race and could focus
   * the one CSS has hidden. Only the desktop bar takes it - which is also the
   * only place the hint chip shows, so hint and behaviour cannot disagree.
   */
  enableShortcut?: boolean;
};

function SearchInput({ className, enableShortcut = false, ...props }: SearchInputProps) {
  const { search, setSearch } = useNoteSearchState();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  // `enableOnFormTags`: search is a global escape hatch, so it has to work from
  // inside the note title field too, not only from a "neutral" focus.
  useHotkeys(
    'mod+k',
    () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
    {
      enabled: enableShortcut,
      preventDefault: true,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    }
  );

  const modSymbol = getShortcutKey('mod').symbol;

  return (
    <div className={`relative w-full rounded-full ${className}`.trim()} {...props}>
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
          'w-full rounded-full border-0 bg-transparent py-2 pl-9 text-foreground placeholder-muted-foreground focus:outline-none',
          // Room for sort + layout, plus the hint chip where it is shown.
          enableShortcut ? 'pr-18 sm:pr-30' : 'pr-18'
        )}
        value={search.q}
        // Typing is not navigation: replace the history entry so the back
        // button leaves the search rather than un-typing it letter by letter.
        onChange={(e) => setSearch({ q: e.target.value }, { replace: true })}
      />
      {/* Both feed controls sit in the bar's right corner: sort, layout toggle. */}
      <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
        {/* The shortcut hint is always rendered rather than hidden on focus, so
            the controls beside it never shift. Pointer-only: it names a key
            combination, which is noise to a screen reader on the field itself,
            and there is no keyboard to press on a phone. */}
        {enableShortcut && (
          <kbd
            aria-hidden
            className="mr-1 hidden select-none rounded border bg-muted px-1.5 py-0.5 font-medium font-sans text-[10px] text-muted-foreground sm:inline-block"
          >
            {modSymbol} K
          </kbd>
        )}
        <SortMenu />
        <ViewModeToggle className="size-8" />
      </div>
    </div>
  );
}

export { SearchInput };

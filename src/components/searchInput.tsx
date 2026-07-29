import { Search } from 'lucide-react';
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SortMenu } from '@/components/notes/SortMenu.tsx';
import { ViewModeToggle } from '@/components/notes/ViewModeToggle.tsx';
import { Input } from '@/components/ui/input.tsx';
import { useNoteSearchState } from '@/hooks/useNoteSearchState.ts';

function SearchInput({ className, ...props }: React.ComponentProps<'div'>) {
  const { search, setSearch } = useNoteSearchState();
  const { t } = useTranslation();

  return (
    <div className={`relative w-full rounded-full ${className}`.trim()} {...props}>
      <Search
        size={18}
        className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        placeholder={t('notes.searchPlaceholder')}
        className="w-full rounded-full border-0 bg-transparent py-2 pr-18 pl-9 text-foreground placeholder-muted-foreground focus:outline-none"
        value={search.q}
        // Typing is not navigation: replace the history entry so the back
        // button leaves the search rather than un-typing it letter by letter.
        onChange={(e) => setSearch({ q: e.target.value }, { replace: true })}
      />
      {/* Both feed controls sit in the bar's right corner: sort, layout toggle. */}
      <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
        <SortMenu />
        <ViewModeToggle className="size-8" />
      </div>
    </div>
  );
}

export { SearchInput };

import { Search } from 'lucide-react';
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input.tsx';
import { useNotes } from '@/context/NotesProvider.tsx';

function SearchInput({ className, ...props }: React.ComponentProps<'div'>) {
  const { query, setQuery } = useNotes();
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
        className="w-full rounded-full border-0 bg-transparent py-2 pr-4 pl-9 text-foreground placeholder-muted-foreground focus:outline-none"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );
}

export { SearchInput };

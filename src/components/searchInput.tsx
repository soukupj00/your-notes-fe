import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogContent } from '@/components/ui/dialog.tsx';
import { Input } from '@/components/ui/input.tsx';
import { useNotes } from '@/context/NotesProvider.tsx';
import { Search } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';

function SearchInput({ className, ...props }: React.ComponentProps<'div'>) {
  const [open, setOpen] = useState(false);
  const { query, setQuery } = useNotes();

  const searchInput = (
    <div className="relative w-full">
      <Button
        type="button"
        variant="transparent"
        size="icon"
        className="text-muted-foreground absolute top-1/2 left-1 -translate-y-1/2"
        tabIndex={-1}
      >
        <Search size={18} className="hover:bg-red-500" />
      </Button>
      <Input
        type="search"
        placeholder="Search notes..."
        className="text-foreground placeholder-muted-foreground w-full pl-9"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
    </div>
  );

  return (
    <div className={className} {...props}>
      {/* Desktop: input visible */}
      <div className="hidden sm:block">{searchInput}</div>

      {/* Mobile: shadcn Button instead of raw button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground sm:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open search"
      >
        <Search size={20} />
      </Button>

      {/* Mobile Dialog with input */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>{searchInput}</DialogContent>
      </Dialog>
    </div>
  );
}

export { SearchInput };

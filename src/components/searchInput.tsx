import { Dialog, DialogContent } from '@/components/ui/dialog.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Search } from 'lucide-react';
import * as React from 'react';

/**
 * TODO Use Command from shadcn instead of this component for a better search experience.
 * @param className
 * @param props
 * @constructor
 */
function SearchInput({ className, ...props }: React.ComponentProps<'div'>) {
  const [value, setValue] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const searchInput = (
    <div className="relative w-full">
      <button
        type="button"
        className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2"
        onClick={() => {
          /* handle search logic here */
        }}
        tabIndex={-1}
      >
        <Search size={18} />
      </button>
      <Input
        type="search"
        placeholder="Search..."
        className="w-full pl-8"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
    </div>
  );

  return (
    <div className={className} {...props}>
      {/* Desktop: show input */}
      <div className="hidden sm:block">{searchInput}</div>
      {/* Mobile: show icon button */}
      <button
        type="button"
        className="text-muted-foreground rounded-full p-2 sm:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open search"
      >
        <Search size={20} />
      </button>
      {/* Mobile: Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>{searchInput}</DialogContent>
      </Dialog>
    </div>
  );
}

export { SearchInput };

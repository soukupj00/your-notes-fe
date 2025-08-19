import { SearchInput } from '@/components/searchInput.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Globe, Menu, Moon, Settings } from 'lucide-react';
import * as React from 'react';

function Navbar({ className, children, ...props }: React.ComponentProps<'header'>) {
  return (
    <header className="bg-background border-b">
      {/* Web Navbar */}
      <div className="hidden items-center justify-between px-4 py-2 sm:flex">
        {/* Left: Logo */}
        <div className="text-xl font-bold">Logo</div>

        {/* Center: Search */}
        <div className="max-w-md flex-1 px-4">
          <SearchInput />
        </div>

        {/* Right: Icons */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon">
            <Globe />
          </Button>
          <Button variant="ghost" size="icon">
            <Moon />
          </Button>
          <Button variant="ghost" size="icon">
            <Settings />
          </Button>
        </div>
      </div>

      {/* Mobile Navbar */}
      <div className="flex items-center justify-between px-4 py-2 sm:hidden">
        <Button variant="ghost" size="icon">
          <Menu />
        </Button>
        <div className="text-lg font-bold">Logo</div>
        <Button variant="ghost" size="icon">
          <Settings />
        </Button>
      </div>
    </header>
  );
}

export { Navbar };

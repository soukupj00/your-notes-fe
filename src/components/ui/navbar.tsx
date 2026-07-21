import { Globe, Menu, Settings } from 'lucide-react';
import type * as React from 'react';
import { SearchInput } from '@/components/searchInput.tsx';
import { ThemeModeToggleButton } from '@/components/themeModeToggleButton.tsx';
import { Button } from '@/components/ui/button.tsx';

function Navbar(_props: React.ComponentProps<'header'>) {
  return (
    <header className="border-b bg-background">
      {/* Web Navbar */}
      <div className="hidden items-center justify-between px-4 py-2 sm:flex">
        {/* Left: Logo */}
        <div className="font-bold text-xl">Logo</div>

        {/* Center: Search */}
        <div className="max-w-md flex-1 px-4">
          <SearchInput />
        </div>

        {/* Right: Icons */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon">
            <Globe />
          </Button>
          <ThemeModeToggleButton />
          <Button variant="ghost" size="icon">
            <Settings />
          </Button>
        </div>
      </div>

      {/* Mobile Navbar - search lives up here (capture moved to the bottom bar). */}
      <div className="flex items-center justify-between px-4 py-2 sm:hidden">
        <Button variant="ghost" size="icon">
          <Menu />
        </Button>
        <div className="font-bold text-lg">Logo</div>
        <div className="flex items-center">
          <SearchInput />
          <Button variant="ghost" size="icon">
            <Settings />
          </Button>
        </div>
      </div>
    </header>
  );
}

export { Navbar };

import { Home, User } from 'lucide-react';
import { SearchInput } from '@/components/searchInput.tsx';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/ui/navbar.tsx';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      {/* ===== CONTENT ===== */}
      {/* Extra bottom padding on mobile so the fixed bottom bar never covers content. */}
      <main className="flex-1 px-4 pt-6 pb-24 sm:pb-6">{children}</main>

      {/* ===== MOBILE BOTTOM BAR ===== */}
      <nav className="fixed bottom-0 w-full border-t shadow sm:hidden">
        <div className="flex justify-around py-2">
          <Button variant="ghost" size="icon">
            <Home />
          </Button>
          <SearchInput />
          <Button variant="ghost" size="icon">
            <User />
          </Button>
        </div>
      </nav>
    </div>
  );
}

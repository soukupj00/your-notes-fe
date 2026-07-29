import { Menu } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SideNav } from '@/components/nav/SideNav.tsx';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog.tsx';
import { Navbar } from '@/components/ui/navbar.tsx';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar
        // The hamburger only exists on mobile, where the sidebar is collapsed
        // into a drawer; on desktop the nav is always on screen.
        leading={
          <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label={t('nav.open')}>
                <Menu className="size-5" />
              </Button>
            </DialogTrigger>
            {/* Anchored to the left edge and full height: a drawer, not the
                centred modal the base DialogContent styles for. */}
            <DialogContent className="top-0 left-0 flex h-full max-w-72 translate-x-0 translate-y-0 flex-col items-stretch rounded-none p-4 sm:max-w-72">
              <DialogHeader>
                <DialogTitle>{t('navbar.logo')}</DialogTitle>
              </DialogHeader>
              <SideNav onNavigate={() => setDrawerOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-1">
        {/* Persistent desktop sidebar (Keep pattern). Hidden on mobile, where
            the same SideNav is reached through the drawer above. */}
        <aside className="hidden w-64 shrink-0 border-r px-2 py-4 sm:block">
          <SideNav />
        </aside>

        {/* Extra bottom padding on mobile so the fixed quick-capture bar
            (rendered by the notes feed) never covers content. */}
        <main className="min-w-0 flex-1 px-4 pt-6 pb-24 sm:pb-6">{children}</main>
      </div>
    </div>
  );
}

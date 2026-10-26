import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SideNav } from '@/components/nav/SideNav.tsx';
import { Navbar } from '@/components/ui/navbar.tsx';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar.tsx';
import { useSidebarOpen } from '@/hooks/useSidebarOpen.ts';

function SkipToContentLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      href="#main-content"
      className="sr-only fixed top-2 left-2 z-50 -translate-y-full rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm shadow-lg transition-transform focus:not-sr-only focus:translate-y-0"
    >
      {children}
    </a>
  );
}

/** Closes the drawer like every `SideNav` link, since nothing else closes it on navigation. */
function BrandLink() {
  const { t } = useTranslation();
  const { setOpenMobile } = useSidebar();

  return (
    <Link
      to="/"
      aria-label={t('navbar.logo')}
      onClick={() => setOpenMobile(false)}
      className="flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-control outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <span
        aria-hidden="true"
        className="size-9 shrink-0 bg-primary [mask-image:url('/note-128.png')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] group-data-[collapsible=icon]:size-8"
      />
      <span
        aria-hidden="true"
        className="truncate font-display text-primary text-title group-data-[collapsible=icon]:hidden"
      >
        {t('navbar.logo')}
      </span>
    </Link>
  );
}

/** The nav shell (ADR 0010; CLAUDE.md, Nav shell). */
export default function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useSidebarOpen();

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      {/* The sidebar lists every destination and label, so without this a keyboard user tabs
          through the whole nav on every page. */}
      <SkipToContentLink>{t('nav.skipToContent')}</SkipToContentLink>

      <Sidebar collapsible="icon">
        <SidebarHeader>
          <BrandLink />
        </SidebarHeader>
        <SidebarContent>
          <SideNav />
        </SidebarContent>
      </Sidebar>

      {/* SidebarInset renders the `<main>` itself; do not nest a second one. */}
      <SidebarInset className="min-w-0">
        <Navbar />
        {/* `tabIndex={-1}` so the skip link can move focus here. A view with a floating bar adds
            its own clearance (`floatingBottomBar.ts`). */}
        <div
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 pt-6 pr-[calc(1rem+var(--safe-right))] pb-[calc(1.5rem+var(--safe-bottom))] pl-[calc(1rem+var(--safe-left))] outline-none sm:pb-6"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { useTranslation } from 'react-i18next';
import { SideNav } from '@/components/nav/SideNav.tsx';
import { Navbar } from '@/components/ui/navbar.tsx';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar.tsx';
import { useSidebarOpen } from '@/hooks/useSidebarOpen.ts';

/**
 * The nav shell (ADR 0010): the vendored shadcn `Sidebar` owns the full-height
 * left column - an icon-collapsible rail from `sm:` up, a `Sheet` drawer below
 * it - and `Navbar` is the header row inside `SidebarInset`.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useSidebarOpen();

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {/* Keep the wordmark in the collapsed rail until the planned logo
              mark replaces it, so the header retains its height and identity. */}
          <span className="flex h-7 items-center truncate px-2 font-bold text-xl group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:text-sm">
            {t('navbar.logo')}
          </span>
        </SidebarHeader>
        <SidebarContent>
          <SideNav />
        </SidebarContent>
      </Sidebar>

      {/* SidebarInset renders the `<main>` itself - we must not nest a second
          one. The old <main> padding moves to the content wrapper rather than
          here, so the sticky Navbar still spans the full width and sits flush
          against the top. */}
      <SidebarInset className="min-w-0">
        <Navbar />
        {/* Extra bottom padding on mobile so the fixed quick-capture bar
            (rendered by the notes feed) never covers content. */}
        <div className="min-w-0 flex-1 px-4 pt-6 pb-24 sm:pb-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

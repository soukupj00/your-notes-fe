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
      {/* First thing in the tab order, visible only once focused: the sidebar
          lists every destination plus every label, so a keyboard user would
          otherwise tab through the whole nav on every page. */}
      <a
        href="#main-content"
        className="sr-only fixed top-2 left-2 z-50 -translate-y-full rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm shadow-lg transition-transform focus:not-sr-only focus:translate-y-0"
      >
        {t('nav.skipToContent')}
      </a>

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
        {/* `tabIndex={-1}` so the skip link can actually move focus here -
            a plain anchor target is not focusable on its own. */}
        <div
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pt-6 pb-24 outline-none sm:pb-6"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

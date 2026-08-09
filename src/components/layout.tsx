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
      <SkipToContentLink>{t('nav.skipToContent')}</SkipToContentLink>

      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex h-10 w-full items-center justify-center gap-2 overflow-hidden">
            <span
              role="img"
              aria-label={t('navbar.logo')}
              className="size-9 shrink-0 bg-primary [mask-image:url('/note-128.png')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] group-data-[collapsible=icon]:size-8"
            />
            <span
              aria-hidden="true"
              className="truncate font-display text-primary text-title group-data-[collapsible=icon]:hidden"
            >
              {t('navbar.logo')}
            </span>
          </div>
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
        {/* The gutters carry the horizontal insets so text never runs under a
            landscape notch, and the mobile bottom padding carries the vertical
            one: it exists to clear the fixed quick-capture bar, which now floats
            a home-indicator's height higher than it used to. */}
        <div
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 pt-6 pr-[calc(1rem+var(--safe-right))] pb-[calc(6rem+var(--safe-bottom))] pl-[calc(1rem+var(--safe-left))] outline-none sm:pb-6"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

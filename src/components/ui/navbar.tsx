import { Link } from '@tanstack/react-router';
import { Check, Globe, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LocaleFlag } from '@/components/LocaleFlag.tsx';
import { BackButton } from '@/components/nav/BackButton.tsx';
import { useTopbar } from '@/components/nav/useTopbar.ts';
import { SearchInput } from '@/components/searchInput.tsx';
import { ThemeModeToggleButton } from '@/components/themeModeToggleButton';
import { AppBar } from '@/components/ui/AppBar.tsx';
import { Button } from '@/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar.tsx';
import { useIsFeedRoute } from '@/hooks/useNoteSearchState.ts';
import i18n from '@/i18n';
import { CHROME_ICON_BUTTON } from '@/lib/chrome-controls.ts';
import { listLocales } from '@/lib/locales.ts';

function Navbar() {
  const { t } = useTranslation();
  // Settings has no feed, so it gets no search box: a control that silently
  // does nothing is worse than an absent one.
  const searchable = useIsFeedRoute();
  // Shared with Settings → Language, so the topbar and the settings page can
  // never end up offering different sets of languages.
  const locales = listLocales();
  // Mobile only. Desktop needs none of it: the rail is permanently visible, so
  // it already says where you are and reaches everywhere in one click.
  const topbar = useTopbar();

  return (
    // Sticky so the search box, sort menu and label filters stay reachable in a
    // long feed - the feed's visible title row was dropped in favour of them.
    // z-10 matches the sidebar panel and stays under QuickCaptureBar's z-40.
    <header className="nav-scroll-shadow sticky top-0 z-10 bg-chrome sm:border-b">
      {/* Web Navbar */}
      <div className="hidden items-center justify-between px-4 py-2 sm:flex">
        {/* Left: the sidebar toggle. The brand lives in SidebarHeader now. */}
        <SidebarTrigger />

        {/* Center: Search */}
        <div className="max-w-md flex-1 px-4">{searchable && <SearchInput enableShortcut />}</div>

        {/* Right: Icons */}
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={CHROME_ICON_BUTTON}
                aria-label={t('settings.locale.label')}
              >
                <Globe />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {locales.map((locale) => {
                  const isActive = i18n.resolvedLanguage === locale.code;
                  return (
                    <DropdownMenuItem
                      key={locale.code}
                      onClick={() => {
                        void i18n.changeLanguage(locale.code);
                      }}
                    >
                      <Check className={isActive ? 'opacity-100' : 'opacity-0'} />
                      <LocaleFlag locale={locale} />
                      {locale.name}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeModeToggleButton />
          <Button variant="ghost" size="icon" className={CHROME_ICON_BUTTON} asChild>
            <Link to="/settings" aria-label={t('nav.settings')}>
              <Settings />
            </Link>
          </Button>
        </div>
      </div>

      {/* Mobile Navbar. One rule shapes it: the drawer trigger belongs to feed
          routes, and every other surface gets back (`topbar.ts`). No logo here
          either - it clutters the bar and lives in SidebarHeader, so it still
          shows inside the drawer the trigger opens. */}
      <div className="sm:hidden">
        <AppBar
          left={topbar.kind === 'feed' ? <SidebarTrigger /> : <BackButton parent={topbar.parent} />}
          // The search box takes the middle only when there is no title to put
          // there; with a title it drops to its own row below, so it stays
          // full-bleed instead of being squeezed between two 44px controls.
          center={
            topbar.title ? (
              <span className="truncate font-medium text-title">{topbar.title}</span>
            ) : (
              searchable && <SearchInput />
            )
          }
          // The gear goes straight to Settings, the same as it does on desktop.
          // It used to open a mini-dialog holding a copy of the language and
          // theme controls, which existed because Settings was a one-way trip
          // on a phone - there was no back button to come home with. Now there
          // is, so the copy is just a second place for a setting to live.
          right={
            topbar.kind === 'feed' && (
              <Button variant="ghost" size="icon" className={CHROME_ICON_BUTTON} asChild>
                <Link to="/settings" aria-label={t('nav.settings')}>
                  <Settings />
                </Link>
              </Button>
            )
          }
        />
        {topbar.title && searchable && (
          <div className="px-4 pb-2">
            <SearchInput />
          </div>
        )}
      </div>
    </header>
  );
}

export { Navbar };

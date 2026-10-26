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
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import { useIsFeedRoute } from '@/hooks/useNoteSearchState.ts';
import i18n from '@/i18n';
import { CHROME_ICON_BUTTON } from '@/lib/chrome-controls.ts';
import { listLocales } from '@/lib/locales.ts';

function Navbar() {
  const { t } = useTranslation();
  // Settings has no feed, so it gets no search box: a control that silently
  // does nothing is worse than an absent one.
  const searchable = useIsFeedRoute();
  // Shared with Settings → Language, so the two never offer different languages.
  const locales = listLocales();
  // Mobile only. Desktop needs none of it: the rail is permanently visible, so
  // it already says where you are and reaches everywhere in one click.
  const topbar = useTopbar();

  return (
    // z-10 matches the sidebar panel and stays under QuickCaptureBar's z-40. The safe
    // insets pad the header itself, so `bg-chrome` paints under the status bar.
    <header className="nav-scroll-shadow @container sticky top-0 z-10 bg-chrome pt-[var(--safe-top)] pr-[var(--safe-right)] pl-[var(--safe-left)] sm:border-b">
      {/* Search sits over the capture bar at its width (`max-w-lg`), so it needs 32rem between two
          10rem sides, the right group's width on a coarse pointer. The open sidebar decides whether
          the header has that, so it is a container query; narrower, search takes a row of its own. */}
      <div className="hidden @min-[56rem]:grid-cols-[minmax(10rem,1fr)_32rem_minmax(10rem,1fr)] grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-2 sm:grid">
        <SidebarTrigger className="justify-self-start" />

        {searchable && (
          <div className="@min-[56rem]:col-2 col-span-3 @min-[56rem]:row-start-1 row-start-2 mx-auto w-full max-w-lg">
            <SearchInput />
          </div>
        )}

        <div className="col-start-3 flex items-center gap-3 justify-self-end">
          <DropdownMenu>
            <IconTooltip label={t('settings.locale.label')}>
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
            </IconTooltip>
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
          <IconTooltip label={t('nav.settings')}>
            <Button variant="ghost" size="icon" className={CHROME_ICON_BUTTON} asChild>
              <Link to="/settings" aria-label={t('nav.settings')} data-tour="settings-gear">
                <Settings />
              </Link>
            </Button>
          </IconTooltip>
        </div>
      </div>

      {/* A Destination gets the drawer trigger, a page with a parent gets back
          (`topbar.ts`). */}
      <div className="sm:hidden">
        <AppBar
          left={
            topbar.kind === 'destination' ? (
              <SidebarTrigger />
            ) : (
              <BackButton fallback={topbar.parent} />
            )
          }
          // With a title, search drops to its own row rather than squeeze between
          // two 44px controls.
          center={
            topbar.title ? (
              <span className="truncate font-medium text-title">{topbar.title}</span>
            ) : (
              searchable && <SearchInput />
            )
          }
          right={
            topbar.kind === 'destination' && (
              <Button variant="ghost" size="icon" className={CHROME_ICON_BUTTON} asChild>
                <Link to="/settings" aria-label={t('nav.settings')} data-tour="settings-gear">
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

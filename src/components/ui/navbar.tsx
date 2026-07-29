import { Link } from '@tanstack/react-router';
import { CZ, GB } from 'country-flag-icons/react/3x2';
import { Check, Globe, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SearchInput } from '@/components/searchInput.tsx';
import { ThemeModeToggleButton } from '@/components/themeModeToggleButton';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SidebarTrigger } from '@/components/ui/sidebar.tsx';
import { useIsFeedRoute } from '@/hooks/useNoteSearchState.ts';
import i18n from '@/i18n';

// Flags are keyed by ISO 3166-1 country code, not language code, so locales
// map to named imports. Keeping this static also lets the bundler omit the
// package's hundreds of unused flag components.
const LOCALE_FLAGS: Record<string, typeof GB> = {
  en: GB,
  cs: CZ,
};

function LocaleFlag({ locale }: { locale: string }) {
  const FlagIcon = LOCALE_FLAGS[locale];
  if (!FlagIcon) return null;
  return <FlagIcon className="h-3.5 w-5 rounded-xs object-cover" />;
}

function Navbar() {
  const { t } = useTranslation();
  // Settings has no feed, so it gets no search box: a control that silently
  // does nothing is worse than an absent one.
  const searchable = useIsFeedRoute();
  // supportedLngs is the source of truth for which locales ship; 'cimode' is
  // i18next's debug pseudo-locale and isn't a real one to offer users.
  const locales = (i18n.options.supportedLngs || []).filter((locale) => locale !== 'cimode');

  return (
    // Sticky so the search box, sort menu and label filters stay reachable in a
    // long feed - the feed's visible title row was dropped in favour of them.
    // z-10 matches the sidebar panel and stays under QuickCaptureBar's z-40.
    <header className="nav-scroll-shadow sticky top-0 z-10 border-b bg-background">
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
              <Button variant="ghost" size="icon" aria-label={t('settings.locale.label')}>
                <Globe />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {locales.map((locale) => {
                  const isActive = i18n.resolvedLanguage === locale;
                  return (
                    <DropdownMenuItem
                      key={locale}
                      onClick={() => {
                        void i18n.changeLanguage(locale);
                      }}
                    >
                      <Check className={isActive ? 'opacity-100' : 'opacity-0'} />
                      <LocaleFlag locale={locale} />
                      {locale}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeModeToggleButton />
          <Button variant="ghost" size="icon" asChild>
            <Link to="/settings" aria-label={t('nav.settings')}>
              <Settings />
            </Link>
          </Button>
        </div>
      </div>

      {/* Mobile Navbar */}
      <div className="flex items-center gap-4 px-4 py-2 sm:hidden">
        {/* No logo here: it clutters the top bar and now lives in SidebarHeader,
            so it still shows inside the drawer this trigger opens. */}
        <SidebarTrigger />
        {searchable && <SearchInput />}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('nav.settings')}>
              <Settings />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('settings.title')}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-sm">{t('settings.locale.label')}</span>
                <Select
                  value={i18n.resolvedLanguage}
                  onValueChange={(code) => {
                    void i18n.changeLanguage(code);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locales.map((locale) => (
                      <SelectItem key={locale} value={locale}>
                        <LocaleFlag locale={locale} />
                        {locale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-sm">{t('settings.theme.label')}</span>
                <ThemeModeToggleButton />
              </div>
              <DialogClose asChild>
                <Button asChild>
                  <Link to="/settings">{t('nav.allSettings')}</Link>
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}

export { Navbar };

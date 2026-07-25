import { Link } from '@tanstack/react-router';
import * as FlagIcons from 'country-flag-icons/react/3x2';
import { Check, Globe, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SearchInput } from '@/components/searchInput.tsx';
import { ThemeModeToggleButton } from '@/components/themeModeToggleButton';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
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
import i18n from '@/i18n';

// Flag icons are keyed by ISO 3166-1 country code, not language code, so a
// locale still needs a mapping to the country whose flag represents it.
const LOCALE_FLAG_COUNTRY: Record<string, keyof typeof FlagIcons> = {
  en: 'GB',
  cs: 'CZ',
};

function LocaleFlag({ locale }: { locale: string }) {
  const FlagIcon = LOCALE_FLAG_COUNTRY[locale] && FlagIcons[LOCALE_FLAG_COUNTRY[locale]];
  if (!FlagIcon) return null;
  return <FlagIcon className="h-3.5 w-5 rounded-xs object-cover" />;
}

/** `leading` is the slot the layout uses for the mobile drawer trigger. */
function Navbar({ leading }: { leading?: React.ReactNode }) {
  const { t } = useTranslation();
  // supportedLngs is the source of truth for which locales ship; 'cimode' is
  // i18next's debug pseudo-locale and isn't a real one to offer users.
  const locales = (i18n.options.supportedLngs || []).filter((locale) => locale !== 'cimode');

  return (
    <header className="border-b bg-background">
      {/* Web Navbar */}
      <div className="hidden items-center justify-between px-4 py-2 sm:flex">
        {/* Left: Logo */}
        <div className="font-bold text-xl">{t('navbar.logo')}</div>

        {/* Center: Search */}
        <div className="max-w-md flex-1 px-4">
          <SearchInput />
        </div>

        {/* Right: Icons */}
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
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
                        i18n.changeLanguage(locale);
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
      <div className="flex items-center justify-between gap-2 px-4 py-2 sm:hidden">
        {leading}
        <div className="font-bold text-lg">{t('navbar.logo')}</div>
        <SearchInput className="max-w-1/2" />
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
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
                    i18n.changeLanguage(code);
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
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}

export { Navbar };

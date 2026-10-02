import type { Locale } from '@/lib/locales.ts';

/**
 * Decorative: every caller renders the locale's name beside it, and a flag names a country,
 * not a language.
 */
export function LocaleFlag({ locale }: { locale: Locale }) {
  if (!locale.Flag) return null;
  return <locale.Flag aria-hidden className="h-3.5 w-5 rounded-xs object-cover" />;
}

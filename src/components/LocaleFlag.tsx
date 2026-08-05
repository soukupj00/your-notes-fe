import type { Locale } from '@/lib/locales.ts';

/**
 * A locale's flag at one size, wherever it is offered.
 *
 * Decorative by construction: every caller renders the locale's name beside it,
 * so the flag is a second cue rather than the label. A flag is a poor label for
 * a language in any case - it names a country, and languages do not map onto
 * countries.
 */
export function LocaleFlag({ locale }: { locale: Locale }) {
  if (!locale.Flag) return null;
  return <locale.Flag aria-hidden className="h-3.5 w-5 rounded-xs object-cover" />;
}

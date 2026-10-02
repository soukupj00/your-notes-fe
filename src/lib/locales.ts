import { CZ, GB } from 'country-flag-icons/react/3x2';
import i18n from '@/i18n';

type FlagComponent = typeof GB;

/**
 * Written out because `country-flag-icons` keys on country codes, not language codes, and a static
 * map lets the bundler drop unused flags. Names are endonyms, as this control is reached for when
 * the UI is in a language the user cannot read.
 */
const LOCALE_DETAILS: Record<string, { Flag: FlagComponent; name: string }> = {
  en: { Flag: GB, name: 'English' },
  cs: { Flag: CZ, name: 'Čeština' },
};

export type Locale = {
  code: string;
  name: string;
  Flag: FlagComponent | null;
};

/**
 * `supportedLngs` in `i18n.ts` stays the source of truth for which locales exist. A code missing
 * above is listed by its code with no flag, so it looks unfinished rather than absent.
 */
export function listLocales(): Locale[] {
  return (
    (i18n.options.supportedLngs || [])
      // i18next's debug pseudo-locale, not a language anyone can be offered.
      .filter((code) => code !== 'cimode')
      .map((code) => ({
        code,
        name: LOCALE_DETAILS[code]?.name ?? code,
        Flag: LOCALE_DETAILS[code]?.Flag ?? null,
      }))
  );
}

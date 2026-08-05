import { CZ, GB } from 'country-flag-icons/react/3x2';
import i18n from '@/i18n';

type FlagComponent = typeof GB;

/**
 * What a shipped locale needs beyond its code, keyed by the code.
 *
 * Flags come from `country-flag-icons`, which keys on ISO 3166-1 *country*
 * codes rather than language codes, so the mapping has to be written out. Doing
 * it statically also lets the bundler drop the package's several hundred unused
 * flag components.
 *
 * The name is the endonym - each language written in itself - because this is
 * the one control a user reaches for precisely when the current UI language is
 * one they cannot read. "Čeština" is findable from an English UI; "Czech" is
 * not findable from a Czech one.
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
 * Every locale the app ships, for the switchers in the topbar and in Settings.
 *
 * `supportedLngs` stays the single source of truth for which locales exist -
 * it is what i18next itself will actually load - so adding one is still a
 * change to `i18n.ts` plus an entry above. A code with no entry is listed under
 * its own code with no flag rather than being hidden: a translation that
 * shipped but was never described here should look unfinished, not absent.
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

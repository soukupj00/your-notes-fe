import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOUR_STEPS } from '@/lib/tour/steps.ts';

/**
 * That the two bundles say the same things.
 *
 * `en` is the fallback, so a key missing from `cs` is invisible in English and
 * shows up in Czech as an English sentence in the middle of a Czech screen -
 * which is the failure nobody testing in their own language will ever see. A key
 * missing from `en` is worse: the fallback of the fallback is the raw key.
 *
 * The Tour gets its own check on top, because its keys are *built* rather than
 * written: `onboarding.steps.<step.key>.title` is composed at render time from
 * the step list, so renaming a step is a rename in two files and nothing else
 * would notice.
 */

const LOCALES = ['en', 'cs'] as const;

const bundles = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(`public/locales/${locale}/translation.json`, 'utf8')),
  ])
) as Record<(typeof LOCALES)[number], Record<string, unknown>>;

/**
 * i18next's plural suffixes, which are *not* the same set in every language and
 * so cannot be compared literally: English needs `_one`/`_other` and Czech also
 * needs `_few` (2-4 is its own form). What both bundles must carry is the same
 * base key, which is what the lookup actually asks for.
 */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Every leaf, as a dotted path, so a diff names the key rather than a subtree. */
function leafKeys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return [prefix.replace(PLURAL_SUFFIX, '')];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    leafKeys(value, prefix ? `${prefix}.${key}` : key)
  );
}

function resolves(bundle: Record<string, unknown>, key: string): boolean {
  return leafKeys(bundle).includes(key);
}

describe('translation bundles', () => {
  it('carry the same keys in every locale', () => {
    const [reference, ...rest] = LOCALES;
    const expected = [...new Set(leafKeys(bundles[reference]))].sort();

    for (const locale of rest) {
      const keys = [...new Set(leafKeys(bundles[locale]))].sort();
      expect({ locale, keys }).toEqual({ locale, keys: expected });
    }
  });

  describe.each(LOCALES)('%s', (locale) => {
    const bundle = bundles[locale];

    it('names every Tour step', () => {
      const missing = TOUR_STEPS.flatMap((step) =>
        [`onboarding.steps.${step.key}.title`, `onboarding.steps.${step.key}.body`].filter(
          (key) => !resolves(bundle, key)
        )
      );

      expect(missing).toEqual([]);
    });

    it('names the Tour’s own controls', () => {
      const missing = [
        'onboarding.progress',
        'onboarding.buttons.back',
        'onboarding.buttons.next',
        'onboarding.buttons.skip',
        'onboarding.buttons.done',
        'settings.help.replay.action',
      ].filter((key) => !resolves(bundle, key));

      expect(missing).toEqual([]);
    });
  });
});

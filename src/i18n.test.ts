import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOUR_STEPS } from '@/lib/tour/steps.ts';

/**
 * A key missing from `cs` shows as English mid-Czech-screen, and one missing from `en` (the
 * fallback) as the raw key. The Tour's keys are composed from the step list at render time, so
 * they get their own check: renaming a step is a rename in two files that nothing else notices.
 */

const LOCALES = ['en', 'cs'] as const;

const bundles = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(`public/locales/${locale}/translation.json`, 'utf8')),
  ])
) as Record<(typeof LOCALES)[number], Record<string, unknown>>;

/**
 * Plural suffixes differ by language (Czech adds `_few`), so keys are compared by their base,
 * which is what a lookup asks for.
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

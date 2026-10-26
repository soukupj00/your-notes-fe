import { readFileSync } from 'node:fs';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { TOUR_STEPS } from '@/lib/tour/steps.ts';
import { WELCOME_MARKS } from '@/lib/tour/welcome.ts';
import { DATA_ROW } from '@/pages/settings/index.tsx';

/**
 * A key missing from `cs` shows as English mid-Czech-screen, and one missing from `en` (the
 * fallback) as the raw key. Keys composed at render time (the Tour's, the Settings home's data row)
 * get their own check: renaming one is a rename in two files that nothing else notices.
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

    it('names every Welcome mark', () => {
      const missing = WELCOME_MARKS.map(({ key }) => `welcome.marks.${key}`).filter(
        (key) => !resolves(bundle, key)
      );

      expect(missing).toEqual([]);
    });

    it('names the Settings home’s data row for either account', () => {
      const missing = Object.values(DATA_ROW)
        .flatMap((row) => [`settings.pages.${row}`, `settings.home.${row}.summary`])
        .filter((key) => !resolves(bundle, key));

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

  // Counted by the group's size: "0 of 1 button on", and Czech's genitive after "z".
  it.each([
    ['en', 1, '0 of 1 button on'],
    ['en', 6, '0 of 6 buttons on'],
    ['cs', 1, 'Zapnuto 0 z 1 tlačítka'],
    ['cs', 3, 'Zapnuto 0 z 3 tlačítek'],
    ['cs', 6, 'Zapnuto 0 z 6 tlačítek'],
  ] as const)('%s counts a toolbar group of %i', async (locale, count, expected) => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: locale, resources: { [locale]: { translation: bundles[locale] } } });

    expect(i18n.t('settings.toolbar.family.summary', { on: 0, count })).toBe(expected);
  });
});

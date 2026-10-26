import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '@/test/renderRoute.tsx';
import { clearStore } from '@/test/store.tsx';
import { TOUR_TARGETS, type TourTargetName } from './targets.ts';

// Vitest hoists `vi.mock`, so these cannot come from a shared helper.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
  default: {},
}));

vi.mock('@/i18n', () => ({
  default: { options: { supportedLngs: ['en'] }, resolvedLanguage: 'en', changeLanguage: vi.fn() },
}));

/**
 * The drift guard: each named target is on something, spelled as `targets.ts` spells it. Which
 * of a pair is visible cannot be asked here, as jsdom applies no CSS; the e2e suite checks that.
 */
afterEach(async () => {
  await clearStore();
});

function found(name: TourTargetName) {
  return document.querySelectorAll(TOUR_TARGETS[name]);
}

describe('every named tour target is mounted somewhere', () => {
  it('marks both capture bars and both gears on the feed, since one of each is on screen', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1 });

    // Two, deliberately. `QuickCaptureBar` and `DesktopCaptureBar` are both
    // always in the document and CSS hides one; this is the duplication that
    // makes `resolveTourTarget`'s rect check load-bearing rather than tidy.
    expect(found('capture')).toHaveLength(2);
    // The same for the gear: one in the desktop topbar, one in the phone's app bar.
    expect(found('settingsGear')).toHaveLength(2);
  });

  it('marks the toolbar, quick-capture and data rows on the Settings home', async () => {
    renderRoute('/settings');
    await screen.findByRole('heading', { level: 1 });

    expect(found('settingsToolbar')).toHaveLength(1);
    expect(found('settingsToolbar')[0]).toHaveAttribute('href', '/settings/toolbar');
    expect(found('settingsQuickCapture')[0]).toHaveAttribute('href', '/settings/quick-capture');
    expect(found('settingsSync')[0]).toHaveAttribute('href', '/settings/data');
  });

  it('covers every target the registry declares', () => {
    // The one that fails when a target is added and nothing above is updated.
    expect(Object.keys(TOUR_TARGETS).sort()).toEqual(
      ['capture', 'settingsGear', 'settingsToolbar', 'settingsQuickCapture', 'settingsSync'].sort()
    );
  });
});

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
  it('marks both capture bars on the feed, since exactly one of them is on screen', async () => {
    renderRoute('/');
    await screen.findByRole('heading', { level: 1 });

    // Two, deliberately. `QuickCaptureBar` and `DesktopCaptureBar` are both
    // always in the document and CSS hides one; this is the duplication that
    // makes `resolveTourTarget`'s rect check load-bearing rather than tidy.
    expect(found('capture')).toHaveLength(2);
  });

  // Three anchors, not one shared block: that block was 1296px on an 839px phone, which the inert
  // Tour cannot scroll. The toolbar anchor is on `ToolbarPreviewStrip`, inside its section,
  // because the section alone is still 880px.
  it('marks the toolbar, quick-capture and sync blocks in Settings', async () => {
    renderRoute('/settings');
    await screen.findByRole('heading', { level: 1 });

    expect(found('settingsToolbar')).toHaveLength(1);
    expect(found('settingsQuickCapture')).toHaveLength(1);
    expect(found('settingsSync')).toHaveLength(1);
  });

  it('covers every target the registry declares', () => {
    // The one that fails when a target is added and nothing above is updated.
    expect(Object.keys(TOUR_TARGETS).sort()).toEqual(
      ['capture', 'settingsToolbar', 'settingsQuickCapture', 'settingsSync'].sort()
    );
  });
});

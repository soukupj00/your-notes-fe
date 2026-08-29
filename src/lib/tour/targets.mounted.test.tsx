import { render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bold } from '@/components/editor/extensions/Bold';
import EditorToolbar from '@/components/editor/toolbar/EditorToolbar.tsx';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { renderRoute } from '@/test/renderRoute.tsx';
import { clearStore } from '@/test/store.tsx';
import { TOUR_TARGETS, type TourTargetName } from './targets.ts';

// Vitest hoists `vi.mock`, so these cannot come from a shared helper.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  default: {},
}));

vi.mock('@/i18n', () => ({
  default: { options: { supportedLngs: ['en'] }, resolvedLanguage: 'en', changeLanguage: vi.fn() },
}));

/**
 * That each named target is actually *on* something, and spelled the way
 * `targets.ts` spells it.
 *
 * This is the drift guard and nothing more. Whether the right one of a pair is
 * *visible* at a given width cannot be asked here at all: jsdom applies no CSS
 * and measures every element as 0x0, so `hidden sm:flex` and `sm:hidden` are
 * indistinguishable and `resolveTourTarget` would return `null` for both. That
 * half is the acceptance suite's, which runs at two real viewports in a real
 * browser.
 */
const editors: Editor[] = [];

afterEach(async () => {
  for (const editor of editors.splice(0)) editor.destroy();
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
    // Exactly one, and that is the point: `captureToggle` marks the control
    // that *opens* a dial, and only the narrow layout has one. Its absence is
    // how a step knows the wide layout has nothing to open.
    expect(found('captureToggle')).toHaveLength(1);
    // The dial's own contents exist only while it is open, which below `sm:` is
    // step 1's own doing - so there is nothing to count here, and that absence
    // is exactly how `steps.ts` reads "the dial is closed".
    expect(found('captureDial')).toHaveLength(0);
  });

  // Three anchors, not two. The toolbar and quick-capture steps used to share
  // one `settings-customisation` block wrapping both sections, which measured
  // 1296px on an 839px phone - unspotlightable, and unscrollable because the
  // Tour holds the app `inert`. The toolbar anchor is deliberately *inside*
  // `EditorToolbarSection` (on `ToolbarPreviewStrip`) rather than around it,
  // since the section alone is still 880px.
  it('marks the toolbar, quick-capture and local-data blocks in Settings', async () => {
    renderRoute('/settings');
    await screen.findByRole('heading', { level: 1 });

    expect(found('settingsToolbar')).toHaveLength(1);
    expect(found('settingsQuickCapture')).toHaveLength(1);
    expect(found('settingsLocal')).toHaveLength(1);
  });

  it('marks the editor toolbar', () => {
    const editor = new Editor({
      extensions: [Document, Paragraph, Text, Bold],
      content: '<p>x</p>',
    });
    editors.push(editor);

    render(
      <PreferencesProvider>
        <TooltipProvider>
          <EditorToolbar editor={editor} />
        </TooltipProvider>
      </PreferencesProvider>
    );

    expect(found('editorToolbar')).toHaveLength(1);
  });

  it('covers every target the registry declares', () => {
    // The one that fails when a target is added and nothing above is updated.
    expect(Object.keys(TOUR_TARGETS).sort()).toEqual(
      [
        'capture',
        'captureDial',
        'captureToggle',
        'editorToolbar',
        'settingsToolbar',
        'settingsQuickCapture',
        'settingsLocal',
      ].sort()
    );
  });
});

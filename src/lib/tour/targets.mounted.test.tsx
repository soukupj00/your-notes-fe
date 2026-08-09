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
import { clearNotesDb } from '@/test/db.ts';
import { renderRoute } from '@/test/renderRoute.tsx';
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
  await clearNotesDb();
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

  it('marks the customisation and local-data blocks in Settings', async () => {
    renderRoute('/settings');
    await screen.findByRole('heading', { level: 1 });

    expect(found('settingsCustomisation')).toHaveLength(1);
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
      ['capture', 'editorToolbar', 'settingsCustomisation', 'settingsLocal'].sort()
    );
  });
});

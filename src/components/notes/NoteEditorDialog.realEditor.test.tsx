import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { db } from '@/db/db.ts';
import { clearNotesDb } from '@/test/db.ts';
import { setViewport } from '@/test/viewport.ts';
import { NoteEditorDialog } from './NoteEditorDialog.tsx';

/**
 * Opening a note card, with the *real* TipTap editor.
 *
 * `NoteEditorDialog.test.tsx` swaps the editor for a textarea, which is right
 * for testing autosave but means nothing there ever mounts the toolbar, the
 * bubble menu, or the ProseMirror plugins. A render loop shipped through that
 * gap: `BubbleMenu`'s update effect dispatches a transaction whenever its
 * `shouldShow`/`options` props change identity, and the editor runs with
 * `shouldRerenderOnTransaction: true`, so passing fresh literals became
 * render -> effect -> dispatch -> render and every note click died with
 * "Maximum update depth exceeded".
 *
 * It needs the dialog rather than a bare editor: the async note load setting
 * `header`/`body` state is what pumps the cycle hard enough to trip React's
 * limit.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The note bar's controls pair a scale with a material change; the hook behind
// that reads the preferences context, which this suite renders without.
vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => false,
}));

// The real canvas lib crashes under jsdom (no canvas.getContext()).
vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));

// Once the bubble menu is actually visible (the linked-note case) TipTap
// measures the caret through `posToDOMRect`, which walks down to
// `getClientRects` - unimplemented in jsdom, and it throws from inside a
// ProseMirror plugin view where nothing can catch it. A layout shim, not a
// behaviour stub: jsdom does no layout, so every rect would be zero anyway.
beforeAll(() => {
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

afterEach(async () => {
  await clearNotesDb();
});

async function seedNote(body: string) {
  const now = new Date().toISOString();
  await db.notes.put({
    id: 'n1',
    header: 'Hello',
    description: '',
    body,
    state: 'active',
    createdAt: now,
    updatedAt: now,
  });
}

function openNote() {
  // The editor toolbar reads the stored Toolbar Layouts, so the real editor
  // needs the preferences provider the app always gives it.
  return render(
    <PreferencesProvider>
      <TooltipProvider>
        <NoteEditorDialog noteId="n1" onClose={vi.fn()} />
      </TooltipProvider>
    </PreferencesProvider>
  );
}

describe('opening a note with the real editor', () => {
  it('loads an existing note without looping renders', async () => {
    await seedNote('<p>some body text</p>');
    openNote();

    await waitFor(() => expect(screen.getByDisplayValue('Hello')).toBeInTheDocument());
    // Let every effect settle: a loop throws during this window, not at mount.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
  });

  // The bubble menu only shows on a link, but it mounts (and registers its
  // plugin) regardless - which is exactly why a link-free note crashed too.
  it('loads a note that contains a link without looping renders', async () => {
    await seedNote('<p><a href="https://example.com">a link</a></p>');
    openNote();

    await waitFor(() => expect(screen.getByDisplayValue('Hello')).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
  });
});

describe('the toolbar customisation sheet, over an unsaved draft', () => {
  // The `⚙` that opens this sheet is on the bar in the Wide default and off in
  // the Compact one, and which Layout is in effect is a pointer question as well
  // as a width one (ADR 0016) - jsdom answers coarse to both unless told.
  beforeEach(() => setViewport(1024));

  function renderDraft() {
    render(
      <PreferencesProvider>
        <TooltipProvider>
          <NoteEditorDialog noteId={null} onClose={vi.fn()} />
        </TooltipProvider>
      </PreferencesProvider>
    );
    return userEvent.setup();
  }

  /**
   * Opens the sheet, changes something in it, and closes it again.
   *
   * Two dialogs are open while it runs: the note, and the sheet layered over it.
   * The sheet is the one that must not navigate - routing to Settings would
   * either destroy this draft or force the `ensureNoteId` race Task 4 refused.
   */
  async function roundTripTheSheet(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByTestId('toolbar-customize'));
    const sheet = await screen.findByRole('dialog', { name: 'settings.toolbar.title' });
    await user.click(within(sheet).getByRole('radio', { name: 'settings.toolbar.width.wide' }));
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'settings.toolbar.title' })
      ).not.toBeInTheDocument()
    );
  }

  // These were one test, which asserted an empty notes table on a draft that had
  // just been typed into - so it was really asserting that the whole sheet
  // round-trip finished inside the 600ms autosave debounce, and it failed on a
  // loaded machine when it did not. Autosaving a dirty draft is correct
  // behaviour; what the sheet must not do is create the note *itself*, which is
  // only answerable on a draft that has nothing to save.
  it('opens and closes without creating the draft', async () => {
    const user = renderDraft();
    await screen.findByPlaceholderText('notes.titlePlaceholder');

    await roundTripTheSheet(user);

    expect(await db.notes.count()).toBe(0);
  });

  it('leaves the draft open, with what was typed still in it', async () => {
    const user = renderDraft();
    const title = await screen.findByPlaceholderText('notes.titlePlaceholder');
    await user.type(title, 'Half a thought');

    await roundTripTheSheet(user);

    expect(screen.getByDisplayValue('Half a thought')).toBeInTheDocument();
  });

  it('changes the bar behind it while it is still open', async () => {
    const user = userEvent.setup();
    render(
      <PreferencesProvider>
        <TooltipProvider>
          <NoteEditorDialog noteId={null} onClose={vi.fn()} />
        </TooltipProvider>
      </PreferencesProvider>
    );

    const bar = await screen.findByTestId('editor-toolbar');
    expect(within(bar).getByLabelText('editor.bold.tooltip')).toBeInTheDocument();

    await user.click(await screen.findByTestId('toolbar-customize'));
    const sheet = await screen.findByRole('dialog', { name: 'settings.toolbar.title' });
    // This suite's `t` returns the bare key, so every family switch shares a
    // label; the row is what identifies which family is being switched off.
    const formatRow = within(sheet).getByRole('button', { name: /editor\.toolbar\.family\.format/ })
      .parentElement as HTMLElement;
    await user.click(within(formatRow).getByRole('switch'));

    // No save, no reopen: the bar is the preview.
    await waitFor(() =>
      expect(within(bar).queryByLabelText('editor.bold.tooltip')).not.toBeInTheDocument()
    );
  });
});

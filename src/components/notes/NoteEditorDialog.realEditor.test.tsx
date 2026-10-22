import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { clearStore, testStore, withStore } from '@/test/store.tsx';
import { setViewport } from '@/test/viewport.ts';
import { NoteEditorDialog } from './NoteEditorDialog.tsx';

/**
 * The real TipTap editor, which the textarea mock never mounts: a "Maximum update depth" loop
 * (`BubbleMenu` props changing identity) once shipped through that gap. The dialog's async note
 * load is what drives such a loop hard enough to trip React's limit, so it renders the dialog.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

// The note bar's controls pair a scale with a material change; the hook behind
// that reads the preferences context, which this suite renders without.
vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => false,
}));

// The real canvas lib crashes under jsdom (no canvas.getContext()).
vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));

// A visible bubble menu measures the caret via `getClientRects`, which jsdom lacks and which
// throws uncatchably inside a plugin view. A layout shim: jsdom's rects would be zero anyway.
beforeAll(() => {
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

afterEach(async () => {
  await clearStore();
});

async function seedNote(body: string) {
  const now = new Date().toISOString();
  await testStore.notes.put({
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
    withStore(
      <PreferencesProvider>
        <TooltipProvider>
          <NoteEditorDialog noteId="n1" onClose={vi.fn()} />
        </TooltipProvider>
      </PreferencesProvider>
    )
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

describe('the toolbar customisation sheet, over a new Draft', () => {
  // The `⚙` that opens this sheet is on the bar in the Wide default and off in
  // the Compact one, and which Layout is in effect is a pointer question as well
  // as a width one (ADR 0016) - jsdom answers coarse to both unless told.
  beforeEach(() => setViewport(1024));

  function renderDraft() {
    render(
      withStore(
        <PreferencesProvider>
          <TooltipProvider>
            <NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />
          </TooltipProvider>
        </PreferencesProvider>
      )
    );
    return userEvent.setup();
  }

  /**
   * The sheet layered over the note must not navigate: routing to Settings would destroy the
   * Draft or make it earn its row early.
   */
  async function roundTripTheSheet(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByTestId('toolbar-customize'));
    const sheet = await screen.findByRole('dialog', { name: 'settings.toolbar.title' });
    expect(within(sheet).getByText('settings.toolbar.width.current.wide')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'settings.toolbar.title' })
      ).not.toBeInTheDocument()
    );
  }

  // Only a draft with nothing to save can show the sheet does not create the note itself; a
  // typed-into draft would race the 600ms autosave and flake on a loaded machine.
  it('opens and closes without creating the draft', async () => {
    const user = renderDraft();
    await screen.findByPlaceholderText('notes.titlePlaceholder');

    await roundTripTheSheet(user);

    expect(await testStore.notes.list()).toHaveLength(0);
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
      withStore(
        <PreferencesProvider>
          <TooltipProvider>
            <NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />
          </TooltipProvider>
        </PreferencesProvider>
      )
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

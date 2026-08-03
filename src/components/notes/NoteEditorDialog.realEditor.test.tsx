import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { db } from '@/db/db.ts';
import { clearNotesDb } from '@/test/db.ts';
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
  return render(
    <TooltipProvider>
      <NoteEditorDialog noteId="n1" onClose={vi.fn()} />
    </TooltipProvider>
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

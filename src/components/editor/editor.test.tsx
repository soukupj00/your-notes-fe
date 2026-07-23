import 'fake-indexeddb/auto';
import { render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Editor, type EditorHandle } from './editor.tsx';

// Keys pass through untranslated so assertions are stable.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('Editor autoplay-on-open', () => {
  it('scans the doc after a later setContent applies the loaded body, not just at mount', async () => {
    // Mirrors NoteEditorDialog opening an existing note: it renders with an
    // empty seeded body, then re-renders once the async db.notes.get() load
    // resolves and feeds the real content in via the `content` prop.
    const ref = createRef<EditorHandle>();
    // No `editable` (skips the toolbar, which needs a TooltipProvider ancestor
    // this headless render doesn't set up) - the autoplay scan doesn't depend
    // on it either way.
    const { rerender } = render(
      <Editor ref={ref} content="" autoplayFirstAudio getNoteId={vi.fn()} />
    );

    rerender(
      <Editor
        ref={ref}
        content='<p>hi</p><audio data-attachment-id="au1"></audio>'
        autoplayFirstAudio
        getNoteId={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(ref.current?.getEditor()?.storage.autoplayFirstAudioId).toBe('au1');
    });
  });

  it('still autoplays a seeded draft populated at creation (already-working case)', async () => {
    const ref = createRef<EditorHandle>();
    render(
      <Editor
        ref={ref}
        content='<audio data-attachment-id="au2"></audio>'
        autoplayFirstAudio
        getNoteId={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(ref.current?.getEditor()?.storage.autoplayFirstAudioId).toBe('au2');
    });
  });
});

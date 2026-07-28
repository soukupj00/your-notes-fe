import { render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Editor, type EditorHandle } from './editor.tsx';

// Keys pass through untranslated so assertions are stable.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// editor.tsx registers createExcalidraw, which statically imports the real
// canvas lib - unmocked, it crashes under jsdom (no canvas.getContext()).
vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));

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

    const play = vi.fn();
    const editor = ref.current?.getEditor();
    if (!editor) throw new Error('editor not initialised');
    editor.storage.audioAttachment.autoplay.registerReadyAudio('au1', play);

    rerender(
      <Editor
        ref={ref}
        content='<p>hi</p><audio data-attachment-id="au1"></audio>'
        autoplayFirstAudio
        getNoteId={vi.fn()}
      />
    );

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
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

    const play = vi.fn();
    const editor = ref.current?.getEditor();
    if (!editor) throw new Error('editor not initialised');
    editor.storage.audioAttachment.autoplay.registerReadyAudio('au2', play);

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
  });

  it('plays immediately via a registered trigger when the attachment is already ready before the scan runs', async () => {
    // Mirrors the OTHER race direction from the first test: the attachment's
    // blob load (and its AudioNodeView becoming ready) can finish before the
    // note body's own async load feeds the real content in - the two loads
    // are independent. Simulate that by pre-registering a ready trigger.
    const ref = createRef<EditorHandle>();
    const { rerender } = render(
      <Editor ref={ref} content="" autoplayFirstAudio getNoteId={vi.fn()} />
    );

    const trigger = vi.fn();
    const editor = ref.current?.getEditor();
    if (!editor) throw new Error('editor not initialised');
    editor.storage.audioAttachment.autoplay.registerReadyAudio('au1', trigger);

    rerender(
      <Editor
        ref={ref}
        content='<p>hi</p><audio data-attachment-id="au1"></audio>'
        autoplayFirstAudio
        getNoteId={vi.fn()}
      />
    );

    await waitFor(() => expect(trigger).toHaveBeenCalledTimes(1));
  });
});

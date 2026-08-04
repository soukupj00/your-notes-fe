import { render as rtlRender, waitFor } from '@testing-library/react';
import { createRef, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { Editor, type EditorHandle } from './editor.tsx';

// The toolbar reads the stored Toolbar Layouts, so every render needs the
// provider; with nothing written it hydrates to defaults, which is the state
// these tests are asserting against anyway.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: PreferencesProvider });

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

describe('Editor auto-capture', () => {
  it('asks the audio recorder to start when opened for a voice note', async () => {
    const ref = createRef<EditorHandle>();
    render(<Editor ref={ref} content="" initialCapture="audio" getNoteId={vi.fn()} />);

    const editor = ref.current?.getEditor();
    if (!editor) throw new Error('editor not initialised');
    // The mic button (toolbar) mounts separately, so the request is held for it.
    const start = vi.fn();
    editor.storage.audioAttachment.capture.registerRecorder(start);

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  });

  it('opens the drawing canvas when opened for a drawing', async () => {
    const { findByRole } = render(
      <Editor content="" initialCapture="drawing" getNoteId={vi.fn()} />
    );

    // The shared Excalidraw dialog is the editor's own, so it can be asserted
    // without a toolbar click.
    expect(await findByRole('dialog')).toBeInTheDocument();
  });

  it('opens a camera-and-gallery picker when opened for a photo', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    const { findByTestId } = render(
      <Editor content="" initialCapture="picture" getNoteId={vi.fn()} />
    );

    const input = await findByTestId('auto-capture-picture-input');
    // `image/*` (not a narrow MIME list) so the mobile sheet offers the camera
    // and Linux Chrome does not grey out the selection; no `capture` attribute,
    // which would force the camera and hide the gallery.
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).not.toHaveAttribute('capture');
    // Best-effort, but it must at least be attempted without a toolbar click.
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });

  it('does not start a capture that was never asked for', async () => {
    const ref = createRef<EditorHandle>();
    const { queryByRole } = render(<Editor ref={ref} content="" getNoteId={vi.fn()} />);

    await waitFor(() => expect(ref.current?.getEditor()).toBeTruthy());
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });
});

/**
 * The suites above deliberately render without `editable`, so they never mount
 * the toolbar. See `NoteEditorDialog.realEditor.test.tsx` for the render-loop
 * regression - that needs the dialog's own state updates to reproduce.
 */
describe('Editor in editable mode', () => {
  it('renders the toolbar buttons the Wide default puts on the bar', async () => {
    const { findByRole } = render(
      <TooltipProvider>
        <Editor editable content="<p>hi</p>" getNoteId={vi.fn()} />
      </TooltipProvider>
    );

    for (const name of [
      'editor.code.tooltip',
      'editor.link.tooltip',
      'editor.codeBlock.tooltip',
      'editor.horizontalRule.tooltip',
      // Undo/redo reach the bar for the first time with the registry.
      'editor.undo',
    ]) {
      expect(await findByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('puts the alignment buttons behind their family trigger, not on the bar', async () => {
    const { findByTestId, queryByRole } = render(
      <TooltipProvider>
        <Editor editable content="<p>hi</p>" getNoteId={vi.fn()} />
      </TooltipProvider>
    );

    // `align` is collapsed in the Wide default, so its three leaves are one tap
    // away rather than three slots of bar.
    expect(await findByTestId('toolbar-family-align')).toBeInTheDocument();
    expect(queryByRole('button', { name: 'editor.textAlign.left' })).not.toBeInTheDocument();
  });
});

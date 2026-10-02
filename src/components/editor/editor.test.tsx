import { render as rtlRender, waitFor } from '@testing-library/react';
import { createRef, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { withStore } from '@/test/store.tsx';
import { setViewport } from '@/test/viewport.ts';
import { Editor, type EditorHandle } from './editor.tsx';
import { insertFiles } from './extensions/attachments/insert';

// The toolbar reads the stored Layouts (empty, so the defaults) and attachments go
// through the Local Store, so every render needs both providers.
const render = (ui: ReactElement) =>
  rtlRender(ui, {
    wrapper: ({ children }) => withStore(<PreferencesProvider>{children}</PreferencesProvider>),
  });

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// editor.tsx registers createExcalidraw, which statically imports the real
// canvas lib - unmocked, it crashes under jsdom (no canvas.getContext()).
vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));

// The insert path is its own suite; here only that the editor hands it the
// files it was opened with.
vi.mock('./extensions/attachments/insert', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./extensions/attachments/insert')>()),
  insertFiles: vi.fn(async () => {}),
}));

describe('Editor content syncing', () => {
  // `content` is read once, at creation, so every later body must arrive through
  // the setContent effect, or opening an existing note shows a blank editor.
  it('applies a body that arrives after mount, not just the one seeded at creation', async () => {
    const { container, rerender } = render(<Editor content="" getNoteId={vi.fn()} />);

    rerender(<Editor content="<p>loaded later</p>" getNoteId={vi.fn()} />);

    await waitFor(() =>
      expect(container.querySelector('.tiptap')?.textContent).toContain('loaded later')
    );
  });

  it('keeps applying later changes, so an external edit is not a one-shot', async () => {
    const { container, rerender } = render(<Editor content="" getNoteId={vi.fn()} />);

    rerender(<Editor content="<p>first</p>" getNoteId={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('.tiptap')?.textContent).toContain('first'));

    rerender(<Editor content="<p>second</p>" getNoteId={vi.fn()} />);
    await waitFor(() =>
      expect(container.querySelector('.tiptap')?.textContent).toContain('second')
    );
  });
});

describe('Editor autoplay-on-open', () => {
  it('scans the doc after a later setContent applies the loaded body, not just at mount', async () => {
    // Mirrors NoteEditorDialog opening an existing note: an empty seeded body,
    // then the loaded one through the `content` prop.
    const ref = createRef<EditorHandle>();
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
    // The other race direction: the blob (and its ready AudioNodeView) can land
    // before the note body does.
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

  it('inserts the files a picker Start chose, once, when the editor is ready', async () => {
    // The picker itself opened inside the tap on the feed (`useStartPicker`);
    // what reaches the editor is the outcome.
    const files = [new File(['x'], 'a.png', { type: 'image/png' })];
    const { rerender } = render(<Editor content="" initialFiles={files} getNoteId={vi.fn()} />);

    await waitFor(() => expect(insertFiles).toHaveBeenCalledTimes(1));
    expect(vi.mocked(insertFiles).mock.calls[0][0]).toBe('image');
    expect(vi.mocked(insertFiles).mock.calls[0][2]).toBe(files);

    rerender(<Editor content="<p>typed</p>" initialFiles={files} getNoteId={vi.fn()} />);
    expect(insertFiles).toHaveBeenCalledTimes(1);
  });

  it('does not start a capture that was never asked for', async () => {
    const ref = createRef<EditorHandle>();
    const { queryByRole } = render(<Editor ref={ref} content="" getNoteId={vi.fn()} />);

    await waitFor(() => expect(ref.current?.getEditor()).toBeTruthy());
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// The suites above render without `editable`, so they never mount the toolbar.
// The render-loop regression needs the dialog: `NoteEditorDialog.realEditor.test.tsx`.
describe('Editor in editable mode', () => {
  // Which Layout is in effect depends on the pointer as well as the width (ADR 0016),
  // and jsdom answers coarse unless told otherwise.
  beforeEach(() => setViewport(1024));

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

    expect(await findByTestId('toolbar-family-align')).toBeInTheDocument();
    expect(queryByRole('button', { name: 'editor.textAlign.left' })).not.toBeInTheDocument();
  });
});

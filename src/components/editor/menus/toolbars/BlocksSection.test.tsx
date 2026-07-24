import { render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudio } from '@/components/editor/extensions/Audio';
import type { AttachmentDeps } from '@/components/editor/extensions/attachments/deps';
import { createExcalidraw } from '@/components/editor/extensions/Excalidraw';
import { createFile } from '@/components/editor/extensions/File';
import { createImage } from '@/components/editor/extensions/Image';
import { createVideo } from '@/components/editor/extensions/Video';
import { TooltipProvider } from '@/components/ui/tooltip';
import BlocksSection, { BLOCK_EXTENSION_NAMES } from './BlocksSection';

vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));

// Stub deps: the toolbar buttons only need getDeps to be callable; tooltips are
// resolved via ExtensionButtonBar's t (which returns the key in tests).
const deps = { getAttachment: vi.fn(), t: (k: string) => k } as unknown as AttachmentDeps;
const getDeps = () => deps;

function createEditor() {
  return new Editor({
    extensions: [
      Document,
      Paragraph,
      Text,
      createImage(getDeps),
      createAudio(getDeps),
      createVideo(getDeps),
      createFile(getDeps),
      createExcalidraw(getDeps),
    ],
    content: '<p>hi</p>',
  });
}

describe('BlocksSection', () => {
  let editor: Editor;
  afterEach(() => editor.destroy());

  // Regression: `videoAttachment` was missing from BLOCK_EXTENSION_NAMES, so the
  // video toolbar button never surfaced even though the extension was registered.
  it('surfaces the image, audio, video, and drawing insert buttons', () => {
    editor = createEditor();
    render(
      <TooltipProvider>
        <BlocksSection editor={editor} />
      </TooltipProvider>
    );
    expect(screen.getByRole('button', { name: 'editor.image.tooltip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'editor.audio.tooltip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'editor.video.tooltip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'editor.file.tooltip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'editor.excalidraw.tooltip' })).toBeInTheDocument();
  });

  it('includes the file attachment node so its toolbar button renders', () => {
    expect(BLOCK_EXTENSION_NAMES).toContain('fileAttachment');
  });
});

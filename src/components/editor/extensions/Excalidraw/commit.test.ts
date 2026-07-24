import { describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '../attachments/deps';
import { commitExcalidrawScene } from './commit';
import type { ExcalidrawScene } from './scene';

// Mock the heavy exporter: sceneToSvgString resolves to a snapshot string.
vi.mock('@excalidraw/excalidraw', () => ({
  exportToSvg: vi.fn(async () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('id', 'snap');
    return el;
  }),
}));

const scene: ExcalidrawScene = { elements: [{ id: 'e1' }], appState: {}, files: {} };

function deps(overrides: Partial<AttachmentDeps> = {}) {
  return {
    getNoteId: vi.fn(async () => 'note-1'),
    createAttachment: vi.fn(async () => ({ id: 'att-1' })),
    updateAttachment: vi.fn(async () => {}),
    ...overrides,
  } as unknown as AttachmentDeps;
}

describe('commitExcalidrawScene', () => {
  it('new drawing: creates the attachment, sets the preview, and inserts the node', async () => {
    const d = deps();
    const insertNode = vi.fn();
    await commitExcalidrawScene(d, null, scene, insertNode);

    expect(d.getNoteId).toHaveBeenCalled();
    expect(d.createAttachment).toHaveBeenCalledWith('note-1', expect.any(File), 'excalidraw');
    expect(d.updateAttachment).toHaveBeenCalledWith(
      'att-1',
      expect.objectContaining({ preview: expect.stringContaining('snap') })
    );
    expect(insertNode).toHaveBeenCalledWith('att-1');
  });

  it('edit drawing: updates the same row with blob + preview, never creates or inserts', async () => {
    const d = deps();
    const insertNode = vi.fn();
    await commitExcalidrawScene(d, 'att-9', scene, insertNode);

    expect(d.createAttachment).not.toHaveBeenCalled();
    expect(insertNode).not.toHaveBeenCalled();
    expect(d.updateAttachment).toHaveBeenCalledWith(
      'att-9',
      expect.objectContaining({ blob: expect.any(File), preview: expect.stringContaining('snap') })
    );
  });

  it('still saves the scene blob when the SVG snapshot fails (preview omitted)', async () => {
    const excalidraw = await import('@excalidraw/excalidraw');
    (excalidraw.exportToSvg as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    const d = deps();
    await commitExcalidrawScene(d, 'att-9', scene, vi.fn());

    const changes = (d.updateAttachment as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(changes.blob).toBeInstanceOf(File);
    expect(changes.preview).toBeUndefined();
  });
});

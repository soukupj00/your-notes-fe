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
    getAttachment: vi.fn(async () => ({ id: 'att-9', preview: '<svg id="old"/>' })),
    updateAttachment: vi.fn(async () => {}),
    ...overrides,
  } as unknown as AttachmentDeps;
}

describe('commitExcalidrawScene', () => {
  it('new drawing: creates the attachment, sets the preview, and places the node', async () => {
    const d = deps();
    const place = vi.fn();
    await commitExcalidrawScene(d, null, scene, place);

    expect(d.getNoteId).toHaveBeenCalled();
    expect(d.createAttachment).toHaveBeenCalledWith('note-1', expect.any(File), 'excalidraw');
    expect(d.updateAttachment).toHaveBeenCalledWith(
      'att-1',
      expect.objectContaining({ preview: expect.stringContaining('snap') })
    );
    expect(place).toHaveBeenCalledWith('att-1');
  });

  it('edit drawing: mints a new row and repoints, never rewriting the old bytes', async () => {
    const d = deps();
    const place = vi.fn();
    await commitExcalidrawScene(d, 'att-9', scene, place);

    expect(d.createAttachment).toHaveBeenCalledWith('note-1', expect.any(File), 'excalidraw');
    expect(d.updateAttachment).not.toHaveBeenCalledWith('att-9', expect.anything());
    expect(d.updateAttachment).toHaveBeenCalledWith(
      'att-1',
      expect.objectContaining({ preview: expect.stringContaining('snap') })
    );
    expect(place).toHaveBeenCalledWith('att-1');
  });

  it('an edit whose snapshot fails still saves and keeps the previous preview', async () => {
    const excalidraw = await import('@excalidraw/excalidraw');
    (excalidraw.exportToSvg as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    const d = deps();
    const place = vi.fn();
    await commitExcalidrawScene(d, 'att-9', scene, place);

    expect(d.createAttachment).toHaveBeenCalled();
    expect(d.updateAttachment).toHaveBeenCalledWith('att-1', { preview: '<svg id="old"/>' });
    expect(place).toHaveBeenCalledWith('att-1');
  });

  it('a new drawing whose snapshot fails is saved without a preview', async () => {
    const excalidraw = await import('@excalidraw/excalidraw');
    (excalidraw.exportToSvg as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    const d = deps();
    await commitExcalidrawScene(d, null, scene, vi.fn());

    expect(d.createAttachment).toHaveBeenCalled();
    expect(d.updateAttachment).not.toHaveBeenCalled();
  });
});

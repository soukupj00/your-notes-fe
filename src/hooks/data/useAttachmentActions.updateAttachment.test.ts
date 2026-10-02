// @vitest-environment node
// Node, because fake-indexeddb under jsdom reads a Blob back as an empty object. Without jsdom
// there is no `renderHook`, so the stateless hook is read through one `renderToStaticMarkup`.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearStore, testStore, withStore } from '@/test/store.tsx';
import { useAttachmentActions } from './useAttachmentActions.ts';

function renderAttachmentActions() {
  let captured: ReturnType<typeof useAttachmentActions>;
  function Probe() {
    captured = useAttachmentActions();
    return null;
  }
  renderToStaticMarkup(withStore(createElement(Probe)));
  return captured!;
}

beforeEach(clearStore);

describe('useAttachmentActions - updateAttachment', () => {
  it('sets preview + updatedAt and leaves the bytes as they were', async () => {
    const a = renderAttachmentActions();
    const created = await a.createAttachment(
      'note-1',
      new File(['{"elements":[]}'], 'd.json', { type: 'application/json' }),
      'excalidraw'
    );
    await a.updateAttachment(created.id, { preview: '<svg id="snap"/>' });
    const row = await a.getAttachment(created.id);
    expect(await row?.blob?.text()).toBe('{"elements":[]}');
    expect(row?.preview).toBe('<svg id="snap"/>');
    expect(row?.updatedAt).not.toBe(created.updatedAt);
  });

  it('cannot give an existing id new bytes (checked by the typecheck)', () => {
    const a = renderAttachmentActions();
    const writeOnce = () =>
      // @ts-expect-error bytes are write-once by id (ADR 0017): new bytes are a new row
      a.updateAttachment('any', { blob: new Blob(['x']) });
    const noNewThumbnailId = () =>
      // @ts-expect-error a new thumbnail needs a new thumbnailId
      testStore.attachments.update('any', { thumbnail: new Blob(['t']) });
    expect([writeOnce, noNewThumbnailId]).toHaveLength(2);
  });

  it('a thumbnail gets its own blob id, and new thumbnail bytes a new one', async () => {
    const a = renderAttachmentActions();
    const created = await a.createAttachment(
      'note-1',
      new File(['v'], 'clip.mp4', { type: 'video/mp4' }),
      'video',
      { thumbnail: new Blob(['p']) }
    );
    expect(created.thumbnailId).toEqual(expect.any(String));
    await a.updateAttachment(created.id, { thumbnail: new Blob(['q']) });
    const row = await a.getAttachment(created.id);
    expect(row?.thumbnailId).toEqual(expect.any(String));
    expect(row?.thumbnailId).not.toBe(created.thumbnailId);
    await a.updateAttachment(created.id, { preview: '<svg/>' });
    expect((await a.getAttachment(created.id))?.thumbnailId).toBe(row?.thumbnailId);
  });
});

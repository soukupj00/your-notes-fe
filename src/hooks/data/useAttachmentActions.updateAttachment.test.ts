// @vitest-environment node
//
// Separate node-env file: fake-indexeddb loses Blob content on read-back under
// jsdom (round-tripped blob comes back as an empty plain object, not a real
// Blob), so the `.text()` assertion below needs Node's Blob. @testing-library/
// react's renderHook requires `document` (jsdom), so hooks are invoked here via
// a one-shot `renderToStaticMarkup` capture instead - these hooks only wrap
// stable useCallback closures with no state/effects, so a single synchronous
// render is enough to read their return value.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearNotesDb } from '@/test/db.ts';
import { useAttachmentActions } from './useAttachmentActions.ts';

function renderAttachmentActions() {
  let captured: ReturnType<typeof useAttachmentActions>;
  function Probe() {
    captured = useAttachmentActions();
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return captured!;
}

beforeEach(clearNotesDb);

describe('useAttachmentActions - updateAttachment', () => {
  it('replaces the blob and sets preview + updatedAt', async () => {
    const a = renderAttachmentActions();
    const created = await a.createAttachment(
      'note-1',
      new File(['{"elements":[]}'], 'd.json', { type: 'application/json' }),
      'excalidraw'
    );
    await a.updateAttachment(created.id, {
      blob: new Blob(['{"elements":[1]}'], { type: 'application/json' }),
      preview: '<svg id="snap"/>',
    });
    const row = await a.getAttachment(created.id);
    expect(await row?.blob.text()).toBe('{"elements":[1]}');
    expect(row?.preview).toBe('<svg id="snap"/>');
    expect(row?.updatedAt).not.toBe(created.updatedAt);
  });
});

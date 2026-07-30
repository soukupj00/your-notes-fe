import { describe, expect, it } from 'vitest';
import { extractBodyAttachments, stripAttachmentNodes } from './note-attachments.ts';

describe('extractBodyAttachments', () => {
  it('returns nothing for an empty or attachment-free body', () => {
    expect(extractBodyAttachments(undefined)).toEqual([]);
    expect(extractBodyAttachments('<p>just words</p>')).toEqual([]);
  });

  it('maps each serialized node form to its stored kind', () => {
    const html =
      '<img data-attachment-id="i1">' +
      '<video data-attachment-id="v1" controls></video>' +
      '<audio data-attachment-id="au1" controls></audio>' +
      '<a data-attachment-id="f1" href="#">report.pdf</a>' +
      '<excalidraw-drawing data-attachment-id="d1"></excalidraw-drawing>';

    expect(extractBodyAttachments(html)).toEqual([
      { id: 'i1', kind: 'image' },
      { id: 'v1', kind: 'video' },
      { id: 'au1', kind: 'audio' },
      { id: 'f1', kind: 'file' },
      { id: 'd1', kind: 'excalidraw' },
    ]);
  });

  it('preserves document order, which is what the summary groups from', () => {
    const html =
      '<a data-attachment-id="f1">x</a><img data-attachment-id="i1"><img data-attachment-id="i2">';

    expect(extractBodyAttachments(html).map((a) => a.id)).toEqual(['f1', 'i1', 'i2']);
  });

  it('deduplicates a repeated id so one attachment counts once', () => {
    const html = '<img data-attachment-id="i1"><img data-attachment-id="i1">';

    expect(extractBodyAttachments(html)).toEqual([{ id: 'i1', kind: 'image' }]);
  });

  it('skips a tag it has no kind for rather than guessing', () => {
    expect(extractBodyAttachments('<iframe data-attachment-id="x1"></iframe>')).toEqual([]);
  });

  it('reads the id regardless of attribute order', () => {
    expect(extractBodyAttachments('<img alt="a" data-attachment-id="i1" width="2">')).toEqual([
      { id: 'i1', kind: 'image' },
    ]);
  });
});

describe('stripAttachmentNodes', () => {
  it('leaves prose untouched', () => {
    expect(stripAttachmentNodes('<p>hello</p>')).toBe('<p>hello</p>');
  });

  it('removes void and paired attachment nodes with their content', () => {
    const html =
      '<img data-attachment-id="i1"><p>hello</p>' +
      '<audio data-attachment-id="au1"></audio>' +
      '<a data-attachment-id="f1" href="#">report.pdf</a>' +
      '<excalidraw-drawing data-attachment-id="d1"></excalidraw-drawing>';

    expect(stripAttachmentNodes(html)).toBe('<p>hello</p>');
  });

  it('keeps a plain link, which is not an attachment', () => {
    const html = '<p>see <a href="https://example.com">this</a></p>';

    expect(stripAttachmentNodes(html)).toBe(html);
  });

  it('removes several nodes of the same tag without swallowing what is between them', () => {
    const html =
      '<audio data-attachment-id="a1"></audio><p>mid</p><audio data-attachment-id="a2"></audio>';

    expect(stripAttachmentNodes(html)).toBe('<p>mid</p>');
  });
});

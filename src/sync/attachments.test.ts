import { describe, expect, it } from 'vitest';
import type { AttachmentTransfer } from '@/data/LocalStore.ts';
import type { Attachment } from '@/models.ts';
import { plan } from './attachments.ts';

const T0 = '2026-01-01T00:00:00.000Z';
const bytes = new Blob(['x']);

function row(
  id: string,
  attachment: Partial<Attachment> = {},
  state: Partial<Omit<AttachmentTransfer, 'attachment'>> = {}
): AttachmentTransfer {
  return {
    attachment: {
      id,
      noteId: 'n',
      kind: 'image',
      mime: 'image/png',
      createdAt: T0,
      updatedAt: T0,
      ...attachment,
    },
    noteOnServer: true,
    onServer: [],
    tooLarge: false,
    ...state,
  };
}

describe('attachment transfer plan', () => {
  it('uploads every thumbnail before any full blob', () => {
    const { uploads } = plan([
      row('a', { blob: bytes, thumbnail: bytes, thumbnailId: 'ta' }),
      row('b', { blob: bytes, thumbnail: bytes, thumbnailId: 'tb' }),
      row('c', { blob: bytes }),
    ]);
    expect(uploads.map((t) => t.blobId)).toEqual(['ta', 'tb', 'a', 'b', 'c']);
  });

  it('uploads nothing the server holds, nothing too large, nothing of a Note it does not know', () => {
    const { uploads } = plan([
      row('held', { blob: bytes, thumbnail: bytes, thumbnailId: 't' }, { onServer: ['held', 't'] }),
      row('large', { blob: bytes }, { tooLarge: true }),
      row('draft', { blob: bytes }, { noteOnServer: false }),
      row('half', { blob: bytes, thumbnail: bytes, thumbnailId: 'th' }, { onServer: ['half'] }),
    ]);
    expect(uploads).toEqual([{ id: 'half', blobId: 'th', part: 'thumbnail' }]);
  });

  it('mints a thumbnailId for a thumbnail written before there was one, and uploads it later', () => {
    const { mint, uploads } = plan([row('old', { blob: bytes, thumbnail: bytes })]);
    expect(mint).toEqual(['old']);
    expect(uploads.map((t) => t.part)).toEqual(['blob']);
  });

  it('downloads every missing thumbnail and, by default, no full bytes', () => {
    const { downloads } = plan([
      row('pulled', { thumbnailId: 't1', size: 10 }),
      row('clip', { kind: 'video', size: 10 }),
      row('file', { kind: 'file', size: 5 }),
      row('have', { thumbnailId: 't2', thumbnail: bytes }),
    ]);
    expect(downloads).toEqual([{ id: 'pulled', blobId: 't1', part: 'thumbnail' }]);
  });

  it('an image with no thumbnail is fetched with the thumbnails, being its own Preview', () => {
    const { downloads } = plan([row('small', { size: 900 }), row('video', { kind: 'video' })]);
    expect(downloads).toEqual([{ id: 'small', blobId: 'small', part: 'blob' }]);
  });

  it('keeping everything downloads every missing blob after the thumbnails, smallest first', () => {
    const { downloads } = plan(
      [
        row('big', { thumbnailId: 't', size: 900 }),
        row('unknown', { kind: 'file' }),
        row('small', { kind: 'file', size: 3 }),
        row('here', { blob: bytes, size: 1 }),
      ],
      { keepEverything: true }
    );
    expect(downloads.map((t) => t.blobId)).toEqual(['t', 'small', 'big', 'unknown']);
  });
});

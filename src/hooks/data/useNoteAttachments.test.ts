import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Attachment } from '@/models.ts';
import { clearStore, renderHookWithStore, testStore } from '@/test/store.tsx';
import { useAttachmentsByNote } from './useNoteAttachments.ts';

beforeEach(clearStore);

async function putAttachment(id: string, noteId: string): Promise<Attachment> {
  const now = new Date().toISOString();
  const row: Attachment = {
    id,
    noteId,
    kind: 'image',
    mime: 'image/png',
    blob: new Blob(['x'], { type: 'image/png' }),
    createdAt: now,
    updatedAt: now,
  };
  await testStore.attachments.add(row);
  return row;
}

describe('useAttachmentsByNote', () => {
  it('joins every listed note in one query', async () => {
    await putAttachment('a1', 'n1');
    await putAttachment('a2', 'n1');
    await putAttachment('b1', 'n2');

    const { result } = renderHookWithStore(() => useAttachmentsByNote(['n1', 'n2']));

    await waitFor(() => expect(result.current.get('n1')?.size).toBe(2));
    expect([...(result.current.get('n1') ?? new Map()).keys()].sort()).toEqual(['a1', 'a2']);
    expect([...(result.current.get('n2') ?? new Map()).keys()]).toEqual(['b1']);
  });

  it('leaves out a note that owns nothing rather than mapping it to an empty Map', async () => {
    await putAttachment('a1', 'n1');

    const { result } = renderHookWithStore(() => useAttachmentsByNote(['n1', 'n2']));

    await waitFor(() => expect(result.current.get('n1')?.size).toBe(1));
    expect(result.current.has('n2')).toBe(false);
  });

  // The guarantee that makes one shared query safe. A write to n2 refires the
  // query for every note on screen; if n1's Map came back new, CardMedia would
  // revoke and re-mint each of its object URLs and the thumbnail would flicker.
  it('keeps an untouched note its exact Map when another note is written', async () => {
    await putAttachment('a1', 'n1');
    await putAttachment('b1', 'n2');

    const { result } = renderHookWithStore(() => useAttachmentsByNote(['n1', 'n2']));
    await waitFor(() => expect(result.current.get('n2')?.size).toBe(1));

    const untouched = result.current.get('n1');
    const untouchedRow = untouched?.get('a1');

    await putAttachment('b2', 'n2');
    await waitFor(() => expect(result.current.get('n2')?.size).toBe(2));

    expect(result.current.get('n1')).toBe(untouched);
    expect(result.current.get('n1')?.get('a1')).toBe(untouchedRow);
  });

  it('gives the written note a new Map, so its own card does refresh', async () => {
    await putAttachment('a1', 'n1');

    const { result } = renderHookWithStore(() => useAttachmentsByNote(['n1']));
    await waitFor(() => expect(result.current.get('n1')?.size).toBe(1));
    const before = result.current.get('n1');

    await putAttachment('a2', 'n1');
    await waitFor(() => expect(result.current.get('n1')?.size).toBe(2));

    expect(result.current.get('n1')).not.toBe(before);
  });

  it('re-reads a row that was updated in place, not just added or removed', async () => {
    await putAttachment('a1', 'n1');
    const { result } = renderHookWithStore(() => useAttachmentsByNote(['n1']));
    await waitFor(() => expect(result.current.get('n1')?.size).toBe(1));
    const before = result.current.get('n1');

    await testStore.attachments.update('a1', {
      updatedAt: new Date(Date.now() + 1000).toISOString(),
    });

    await waitFor(() => expect(result.current.get('n1')).not.toBe(before));
  });

  it('runs no query and returns nothing for an empty feed', async () => {
    await putAttachment('a1', 'n1');

    const { result } = renderHookWithStore(() => useAttachmentsByNote([]));

    await waitFor(() => expect(result.current.size).toBe(0));
  });
});

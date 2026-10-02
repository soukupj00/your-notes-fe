// @vitest-environment node
// Not jsdom: fake-indexeddb's structuredClone turns jsdom's Blob into `{}`, while Node's
// native Blob round-trips as a real browser's does.
import { describe, expect, it } from 'vitest';
import type { Attachment } from '@/models.ts';
import { db } from './db.ts';

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    noteId: crypto.randomUUID(),
    kind: 'image',
    mime: 'image/png',
    blob: new Blob(['x'], { type: 'image/png' }),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('attachments table', () => {
  it('round-trips an Attachment row with its Blob', async () => {
    const att = makeAttachment();
    await db.attachments.put(att);
    const read = await db.attachments.get(att.id);
    expect(read?.id).toBe(att.id);
    expect(read?.kind).toBe('image');
    expect(read?.blob).toBeInstanceOf(Blob);
  });

  it('indexes attachments by noteId', async () => {
    const noteId = crypto.randomUUID();
    await db.attachments.bulkPut([makeAttachment({ noteId }), makeAttachment({ noteId })]);
    const rows = await db.attachments.where('noteId').equals(noteId).toArray();
    expect(rows).toHaveLength(2);
  });
});

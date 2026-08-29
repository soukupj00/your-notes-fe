// @vitest-environment node
//
// This file is forced to the `node` environment (overriding the project's
// default `jsdom`) because jsdom's Blob polyfill is not recognized by
// Node's native structuredClone, which fake-indexeddb relies on to persist
// values. Under jsdom, a stored Blob comes back as a plain `{}`. Node's
// native Blob round-trips correctly and matches what a real browser does.
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

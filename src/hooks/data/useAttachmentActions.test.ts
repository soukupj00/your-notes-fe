import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db.ts';
import { clearNotesDb } from '@/test/db.ts';
import { useAttachmentActions } from './useAttachmentActions.ts';

function actions() {
  return renderHook(() => useAttachmentActions()).result.current;
}

const pngFile = () => new File([new Uint8Array(4)], 'p.png', { type: 'image/png' });

beforeEach(clearNotesDb);

describe('useAttachmentActions', () => {
  it('createAttachment validates then writes a row', async () => {
    const a = actions();
    const noteId = crypto.randomUUID();
    const att = await a.createAttachment(noteId, pngFile());
    expect(att.noteId).toBe(noteId);
    expect(att.kind).toBe('image');
    expect(att.mime).toBe('image/png');
    expect(await db.attachments.get(att.id)).toBeTruthy();
  });

  it('createAttachment stores an image thumbnail in the same row', async () => {
    const a = actions();
    const noteId = crypto.randomUUID();
    const thumbnail = new Blob(['small'], { type: 'image/webp' });

    const att = await a.createAttachment(noteId, pngFile(), 'image', { thumbnail });

    expect(att).toMatchObject({ thumbnail });
    expect(await db.attachments.get(att.id)).toMatchObject({ thumbnail });
  });

  it('createAttachment rejects a bad type without writing', async () => {
    const a = actions();
    const bad = new File(['x'], 'x.svg', { type: 'image/svg+xml' });
    await expect(a.createAttachment(crypto.randomUUID(), bad)).rejects.toMatchObject({
      code: 'unsupported-type',
    });
    expect(await db.attachments.count()).toBe(0);
  });

  it('getAttachment + deleteAttachment round-trip', async () => {
    const a = actions();
    const att = await a.createAttachment(crypto.randomUUID(), pngFile());
    expect((await a.getAttachment(att.id))?.id).toBe(att.id);
    await a.deleteAttachment(att.id);
    expect(await a.getAttachment(att.id)).toBeUndefined();
  });

  it('cloneAttachment mints a distinct owned row with copied bytes', async () => {
    const a = actions();
    const src = await a.createAttachment(crypto.randomUUID(), pngFile());
    const targetNote = crypto.randomUUID();
    const clone = await a.cloneAttachment(src, targetNote);
    expect(clone.id).not.toBe(src.id);
    expect(clone.noteId).toBe(targetNote);
    expect(clone.blob).toBeInstanceOf(Blob);
    expect(await db.attachments.count()).toBe(2);
  });

  it('collectOrphans removes unreferenced rows for the note, keeps referenced', async () => {
    const a = actions();
    const noteId = crypto.randomUUID();
    const keep = await a.createAttachment(noteId, pngFile());
    const drop = await a.createAttachment(noteId, pngFile());
    const removed = await a.collectOrphans(noteId, [keep.id]);
    expect(removed).toBe(1);
    expect(await a.getAttachment(keep.id)).toBeTruthy();
    expect(await a.getAttachment(drop.id)).toBeUndefined();
  });

  it('collectMissingNoteOrphans removes rows whose note is gone', async () => {
    const a = actions();
    const orphanNote = crypto.randomUUID();
    await a.createAttachment(orphanNote, pngFile());
    const liveNote = crypto.randomUUID();
    await db.notes.put({
      id: liveNote,
      header: '',
      description: '',
      body: '',
      state: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await a.createAttachment(liveNote, pngFile());
    const removed = await a.collectMissingNoteOrphans();
    expect(removed).toBe(1);
  });

  it('collectStartupOrphans reconciles every saved note and missing note owner', async () => {
    const a = actions();
    const liveNote = crypto.randomUUID();
    const keep = await a.createAttachment(liveNote, pngFile());
    const drop = await a.createAttachment(liveNote, pngFile());
    const missingOwner = await a.createAttachment(crypto.randomUUID(), pngFile());
    const now = new Date().toISOString();
    await db.notes.put({
      id: liveNote,
      header: '',
      description: '',
      body: `<img data-attachment-id="${keep.id}">`,
      state: 'active',
      createdAt: now,
      updatedAt: now,
    });

    const removed = await a.collectStartupOrphans();

    expect(removed).toBe(2);
    expect(await a.getAttachment(keep.id)).toBeTruthy();
    expect(await a.getAttachment(drop.id)).toBeUndefined();
    expect(await a.getAttachment(missingOwner.id)).toBeUndefined();
  });
});

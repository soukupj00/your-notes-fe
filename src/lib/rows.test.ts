import { describe, expect, it } from 'vitest';
import type { Attachment } from '@/models.ts';
import { cloneAttachment, newAttachment, newNote, newNoteTag, newTag } from './rows.ts';

const UUID = /^[0-9a-f-]{36}$/;
const NOW = '2030-01-02T03:04:05.000Z';

describe('newNote', () => {
  it('fills every default and stamps both timestamps equal', () => {
    const note = newNote({});
    expect(note.id).toMatch(UUID);
    expect(note).toMatchObject({ header: '', description: '', body: '', state: 'active' });
    expect(note.createdAt).toBe(note.updatedAt);
  });

  it('keeps a supplied id, because the editor puts it in the URL before the row exists', () => {
    expect(newNote({ id: 'given' }).id).toBe('given');
  });

  it('carries trashedAt through so a note seeded into the trash is not immortal', () => {
    expect(newNote({ state: 'trashed', trashedAt: '2026-01-01T00:00:00.000Z' }).trashedAt).toBe(
      '2026-01-01T00:00:00.000Z'
    );
  });

  it('carries a Reminder through, rather than dropping it silently', () => {
    const note = newNote({ remindAt: '2030-03-04T09:00', repeat: 'weekly' });
    expect(note.remindAt).toBe('2030-03-04T09:00');
    expect(note.repeat).toBe('weekly');
  });

  it('takes the moment it is given, so the rows of one write share a timestamp', () => {
    const note = newNote({}, NOW);
    expect(note.createdAt).toBe(NOW);
    expect(note.updatedAt).toBe(NOW);
  });

  it('never carries tags, which live in the join table', () => {
    const note = newNote({ tags: [{ id: 't', name: 'Work', createdAt: NOW, updatedAt: NOW }] });
    expect(note.tags).toBeUndefined();
  });
});

describe('newTag and newNoteTag', () => {
  it('newTag mints an id and stamps both timestamps', () => {
    const tag = newTag('Work', 'blue', NOW);
    expect(tag.id).toMatch(UUID);
    expect(tag).toMatchObject({ name: 'Work', color: 'blue', createdAt: NOW, updatedAt: NOW });
  });

  it('newTag has no colour when none is given', () => {
    expect(newTag('Work').color).toBeUndefined();
  });

  it('newNoteTag links the two ids and stamps both timestamps', () => {
    expect(newNoteTag('n', 't', NOW)).toEqual({
      noteId: 'n',
      tagId: 't',
      createdAt: NOW,
      updatedAt: NOW,
    });
  });
});

describe('newAttachment', () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'pic.png', { type: 'image/png' });

  it('takes its metadata from the file and keeps the File as the bytes', () => {
    const row = newAttachment('n', file, 'image', {}, NOW);
    expect(row.id).toMatch(UUID);
    expect(row).toMatchObject({
      noteId: 'n',
      kind: 'image',
      mime: 'image/png',
      name: 'pic.png',
      size: 3,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(row.blob).toBe(file);
    expect(row.thumbnailId).toBeUndefined();
  });

  it('mints a thumbnailId only when a thumbnail comes with it', () => {
    const thumbnail = new Blob(['t'], { type: 'image/webp' });
    const row = newAttachment('n', file, 'image', { thumbnail, duration: 2, width: 4, height: 5 });
    expect(row.thumbnail).toBe(thumbnail);
    expect(row.thumbnailId).toMatch(UUID);
    expect(row).toMatchObject({ duration: 2, width: 4, height: 5 });
  });
});

describe('cloneAttachment', () => {
  const source: Attachment = {
    id: 'source',
    noteId: 'n1',
    kind: 'image',
    mime: 'image/png',
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
    name: 'pic.png',
    size: 3,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
  };

  it('is a new row under the new note with the same metadata and fresh timestamps', () => {
    const clone = cloneAttachment(source, 'n2', NOW);
    expect(clone.id).toMatch(UUID);
    expect(clone.id).not.toBe(source.id);
    expect(clone).toMatchObject({
      noteId: 'n2',
      kind: 'image',
      mime: 'image/png',
      name: 'pic.png',
      size: 3,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('copies the bytes into a Blob of its own, and has none when the source has none', async () => {
    const clone = cloneAttachment(source, 'n2');
    expect(clone.blob).not.toBe(source.blob);
    expect(clone.blob?.type).toBe('image/png');
    expect(await clone.blob?.arrayBuffer()).toEqual(await source.blob?.arrayBuffer());
    expect(cloneAttachment({ ...source, blob: undefined }, 'n2').blob).toBeUndefined();
  });
});

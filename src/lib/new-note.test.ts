import { describe, expect, it } from 'vitest';
import { newNote } from './new-note.ts';

describe('newNote', () => {
  it('fills every default and stamps both timestamps equal', () => {
    const note = newNote({});
    expect(note.id).toMatch(/^[0-9a-f-]{36}$/);
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
});

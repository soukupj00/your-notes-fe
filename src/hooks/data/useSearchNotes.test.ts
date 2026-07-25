import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db.ts';
import type { Note } from '@/models.ts';
import { useSearchNotes } from './useSearchNotes.ts';

function makeNote(overrides: Partial<Note>): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    header: '',
    description: '',
    body: '',
    state: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

afterEach(async () => {
  await db.notes.clear();
});

describe('useSearchNotes', () => {
  it('matches the query against plain text inside the rich-text body (HTML stripped)', async () => {
    await db.notes.add(makeNote({ header: 'A', body: '<p>Buy <strong>avocados</strong></p>' }));
    await db.notes.add(makeNote({ header: 'B', body: '<p>unrelated</p>' }));

    const { result } = renderHook(() => useSearchNotes('avocado'));

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]?.header).toBe('A');
  });

  it('does not match on HTML tag names, only rendered text', async () => {
    await db.notes.add(makeNote({ header: 'A', body: '<strong>hello</strong>' }));

    const { result } = renderHook(() => useSearchNotes('strong'));

    // Give the live query a tick; it should stay empty.
    await waitFor(() => expect(result.current).toEqual([]));
  });
});

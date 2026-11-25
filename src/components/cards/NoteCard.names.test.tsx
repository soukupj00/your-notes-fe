import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { taskListMarkup } from '@/lib/body.ts';
import { newNote } from '@/lib/rows.ts';
import type { Note } from '@/models.ts';
import { clearStore, renderWithStore as render } from '@/test/store.tsx';
import { NoteCard } from './NoteCard.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-GB' } }),
}));

vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => false,
}));

const card = (overrides: Partial<Note>) =>
  render(<NoteCard note={newNote({ header: '', ...overrides })} onSelect={vi.fn()} />);

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock/0');
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(async () => {
  await clearStore();
});

describe('NoteCard names', () => {
  it.each([
    ['its title', { header: 'Groceries', body: '<p>Milk</p>' }, 'Groceries'],
    [
      'its first line of prose when untitled',
      { body: '<p>Call the plumber</p><p>Then</p>' },
      'Call the plumber',
    ],
    [
      'its first line of prose when the title is blank',
      { header: '  ', body: '<p>hello</p>' },
      'hello',
    ],
    [
      'its first checklist item',
      {
        body: taskListMarkup([
          ['Milk', false],
          ['Bread', true],
        ]),
      },
      'Milk',
    ],
    [
      'the words of a long line that fit in 40 characters',
      { body: `<p>${'abcd '.repeat(7)}abcdefgh</p>` },
      `${'abcd '.repeat(7).trimEnd()}…`,
    ],
    [
      'the first 40 characters of one long word',
      { body: `<p>${'x'.repeat(50)}</p>` },
      `${'x'.repeat(40)}…`,
    ],
    [
      'whole characters when one long word ends in emoji',
      { body: `<p>${'a'.repeat(39)}😀😀😀</p>` },
      `${'a'.repeat(39)}😀…`,
    ],
    [
      'the kind of its first attachment when it has no words',
      { body: '<img data-attachment-id="i1"><p> </p>' },
      'notes.attachmentImage',
    ],
    [
      'a Drawing',
      { body: '<excalidraw-drawing data-attachment-id="d1"></excalidraw-drawing>' },
      'notes.attachmentDrawing',
    ],
    ['a placeholder when it holds nothing', { body: '' }, 'notes.untitled'],
  ])('names a Card by %s', (_, overrides, name) => {
    card(overrides);

    expect(screen.getByRole('button', { name })).toHaveAttribute('data-slot', 'note-card-open');
    expect(screen.getByRole('article', { name })).toBeInTheDocument();
  });

  // Twenty "Archive" buttons in a wall read as one column of identical words.
  it("adds the Card's name after each control's own label", () => {
    card({ header: 'Groceries', body: '<p>Milk</p><audio data-attachment-id="a1"></audio>' });

    for (const label of [
      'notes.pin',
      'notes.color',
      'notes.archive',
      'notes.moveToTrash',
      'notes.playAudio',
    ]) {
      expect(screen.getByRole('button', { name: `${label} Groceries` })).toBeInTheDocument();
    }
  });

  it("names the trash rail's controls by the Card too", () => {
    card({ header: 'Binned', state: 'trashed', trashedAt: '2026-10-01T00:00:00.000Z' });

    for (const label of ['notes.restore', 'notes.archive', 'notes.deleteForever']) {
      expect(screen.getByRole('button', { name: `${label} Binned` })).toBeInTheDocument();
    }
  });
});

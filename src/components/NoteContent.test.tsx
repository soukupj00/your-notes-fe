import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@/models.ts';
import { NoteContent } from './NoteContent.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const notesState = {
  notes: [] as Note[],
  query: '',
  loading: false,
};
// Search state comes from the URL; this suite is about layout, so stub the
// router-backed hook rather than mounting a router.
vi.mock('@/hooks/useNoteSearchState.ts', () => ({
  useNoteSearchState: () => ({
    search: { q: notesState.query, sort: 'updated', dir: 'desc', tags: [] },
    setSearch: vi.fn(),
    toggleTag: vi.fn(),
  }),
}));

// The feed query has its own suite; stub it so this test stays about layout.
vi.mock('@/hooks/data/useNoteFeed.ts', () => ({
  useNoteFeed: () => ({ notes: notesState.notes, loading: notesState.loading }),
}));

const viewModeState = { viewMode: 'masonry' as 'masonry' | 'list' };
vi.mock('@/context/viewModeProvider.tsx', () => ({
  useViewMode: () => viewModeState,
}));

// The NoteCard is exercised in its own suite; stub it so this test focuses on
// the container layout, not card internals.
vi.mock('@/components/cards/NoteCard.tsx', () => ({
  NoteCard: ({ note }: { note: Note }) => <div data-testid="note-card">{note.id}</div>,
}));

function note(id: string): Note {
  const now = new Date().toISOString();
  return {
    id,
    header: id,
    description: '',
    body: '',
    state: 'active',
    createdAt: now,
    updatedAt: now,
  };
}

afterEach(() => {
  notesState.notes = [];
  notesState.query = '';
  notesState.loading = false;
  viewModeState.viewMode = 'masonry';
});

describe('NoteContent layout', () => {
  it('uses the masonry (columns) layout by default', () => {
    notesState.notes = [note('a'), note('b')];
    const { container } = render(<NoteContent scope={{ state: 'active' }} onSelect={vi.fn()} />);

    // card -> its <li> -> the list that carries the layout classes
    const grid = container.querySelector('[data-testid="note-card"]')?.parentElement?.parentElement;
    expect(grid?.className).toContain('columns-1');
    expect(grid?.className).not.toContain('flex-col');
  });

  it('uses a single-column list layout when viewMode is list', () => {
    notesState.notes = [note('a'), note('b')];
    viewModeState.viewMode = 'list';
    const { container } = render(<NoteContent scope={{ state: 'active' }} onSelect={vi.fn()} />);

    // card -> its <li> -> the list that carries the layout classes
    const grid = container.querySelector('[data-testid="note-card"]')?.parentElement?.parentElement;
    expect(grid?.className).toContain('flex-col');
    expect(grid?.className).not.toContain('columns-1');
  });

  it('renders one card per note regardless of layout', () => {
    notesState.notes = [note('a'), note('b'), note('c')];
    viewModeState.viewMode = 'list';
    render(<NoteContent scope={{ state: 'active' }} onSelect={vi.fn()} />);
    expect(screen.getAllByTestId('note-card')).toHaveLength(3);
  });
});

// Each view says what *it* is empty of: "No notes yet" is the wrong sentence
// for an empty trash or a label nothing is filed under.
describe('NoteContent empty states', () => {
  it.each([
    [{ state: 'active' } as const, 'notes.empty.active.title'],
    [{ state: 'archived' } as const, 'notes.empty.archived.title'],
    [{ state: 'trashed' } as const, 'notes.empty.trashed.title'],
    [{ state: 'active', tagId: 'tag-1' } as const, 'notes.empty.tag.title'],
  ])('describes an empty %o feed with its own copy', (scope, key) => {
    render(<NoteContent scope={scope} onSelect={vi.fn()} />);
    expect(screen.getByText(key)).toBeInTheDocument();
  });

  it('reports a filtered-to-nothing feed separately from an empty one', () => {
    notesState.query = 'nothing matches this';
    render(<NoteContent scope={{ state: 'trashed' }} onSelect={vi.fn()} />);

    expect(screen.getByText('notes.empty.filtered.title')).toBeInTheDocument();
    expect(screen.queryByText('notes.empty.trashed.title')).not.toBeInTheDocument();
  });
});

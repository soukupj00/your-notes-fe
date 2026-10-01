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

const viewModeState = { viewMode: 'masonry' as 'masonry' | 'stack' };
vi.mock('@/context/viewModeProvider.tsx', () => ({
  useViewMode: () => viewModeState,
}));

// Measurement and Motion have their own seams; this suite only verifies that
// query results and the chosen mode reach the populated feed.
vi.mock('@/components/notes/NoteFeed.tsx', () => ({
  NoteFeed: ({ notes, mode }: { notes: Note[]; mode: 'masonry' | 'stack' }) => (
    <ul data-testid="note-feed" data-layout={mode}>
      {notes.map((note) => (
        <li key={note.id} data-testid="note-card">
          {note.id}
        </li>
      ))}
    </ul>
  ),
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
  it('uses Masonry by default', () => {
    notesState.notes = [note('a'), note('b')];
    render(<NoteContent scope={{ state: 'active' }} onSelect={vi.fn()} />);

    expect(screen.getByTestId('note-feed')).toHaveAttribute('data-layout', 'masonry');
  });

  it('passes the Stack choice to the same feed', () => {
    notesState.notes = [note('a'), note('b')];
    viewModeState.viewMode = 'stack';
    render(<NoteContent scope={{ state: 'active' }} onSelect={vi.fn()} />);

    expect(screen.getByTestId('note-feed')).toHaveAttribute('data-layout', 'stack');
  });

  it('renders one card per note regardless of layout', () => {
    notesState.notes = [note('a'), note('b'), note('c')];
    viewModeState.viewMode = 'stack';
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

  it('points an empty Feed at the capture surface this width shows', () => {
    render(<NoteContent scope={{ state: 'active' }} onSelect={vi.fn()} />);

    expect(screen.getByText('notes.empty.active.subtitle')).toHaveClass('sm:hidden');
    expect(screen.getByText('notes.empty.active.subtitleWide')).toHaveClass('hidden', 'sm:block');
  });
});

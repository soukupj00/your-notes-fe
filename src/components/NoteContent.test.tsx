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

    const grid = container.querySelector('[data-testid="note-card"]')?.parentElement;
    expect(grid?.className).toContain('columns-1');
    expect(grid?.className).not.toContain('flex-col');
  });

  it('uses a single-column list layout when viewMode is list', () => {
    notesState.notes = [note('a'), note('b')];
    viewModeState.viewMode = 'list';
    const { container } = render(<NoteContent scope={{ state: 'active' }} onSelect={vi.fn()} />);

    const grid = container.querySelector('[data-testid="note-card"]')?.parentElement;
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

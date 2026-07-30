import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db.ts';
import type { Note } from '@/models.ts';
import { clearNotesDb } from '@/test/db.ts';
import { NoteCard } from './NoteCard.tsx';

// Keys pass through untranslated so assertions are stable.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const motion = { reduced: false };
vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => motion.reduced,
}));

const toastMock = vi.fn();
vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    header: 'My note',
    description: '',
    body: '<p>hello</p>',
    state: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

afterEach(async () => {
  toastMock.mockReset();
  await clearNotesDb();
});

beforeEach(() => {
  motion.reduced = false;
  // jsdom lacks object-URL APIs; NoteBody resolves attachments to blob URLs.
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock/0');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('NoteCard', () => {
  it('opens the editor for its note when the card is activated', async () => {
    const note = makeNote();
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    await userEvent.click(screen.getByText('My note'));

    expect(onSelect).toHaveBeenCalledWith(note.id);
  });

  it('carries the stored colour token on the card identity surface', () => {
    render(<NoteCard note={makeNote({ color: 'blue' })} onSelect={vi.fn()} />);

    const card = screen.getByRole('heading', { name: 'My note' }).closest('[role="button"]');
    expect(card).toHaveAttribute('data-note-color', 'blue');
    expect(card?.querySelector('[data-slot="note-card-surface"]')).toBeInTheDocument();
  });

  it('uses the default identity for an uncoloured card', () => {
    render(<NoteCard note={makeNote()} onSelect={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: 'My note' }).closest('[role="button"]')
    ).toHaveAttribute('data-note-color', 'default');
  });

  it('removes hover movement but keeps the material change under reduced motion', () => {
    motion.reduced = true;
    render(<NoteCard note={makeNote()} onSelect={vi.fn()} />);

    const surface = document.querySelector('[data-slot="note-card-surface"]');
    expect(surface).not.toHaveClass('group-hover:scale-[1.02]');
    expect(surface).toHaveClass('group-hover:border-note-border-hover');
  });

  it('opens the editor when the card itself is keyboard-activated', async () => {
    const note = makeNote();
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    const card = screen.getByText('My note').closest('[role="button"]') as HTMLElement;
    card.focus();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith(note.id);
  });

  it('does not open the editor when the overflow menu is keyboard-activated', async () => {
    const note = makeNote();
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    // Focus the "⋮" trigger and press Enter: the menu opens, but the card's
    // keydown handler must not also fire onSelect (guards against the portalled
    // synthetic-event bubble reopening the editor - including from Delete).
    screen.getByRole('button', { name: 'notes.menu' }).focus();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).not.toHaveBeenCalled();
  });

  async function chooseMenuItem(label: string) {
    await userEvent.click(screen.getByRole('button', { name: 'notes.menu' }));
    await userEvent.click(await screen.findByText(label));
  }

  /** Fire the undo action from the most recent toast. */
  async function undoLastToast() {
    const opts = toastMock.mock.calls.at(-1)?.[1] as { action: { onClick: () => void } };
    await opts.action.onClick();
  }

  it('moves the note to trash rather than deleting it, and offers an undo', async () => {
    const note = makeNote({ pinnedAt: new Date().toISOString() });
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await chooseMenuItem('notes.moveToTrash');

    await waitFor(async () => expect((await db.notes.get(note.id))?.state).toBe('trashed'));
    // Trashing is recoverable - the row must still be there.
    expect(await db.notes.get(note.id)).toBeTruthy();
    expect(toastMock).toHaveBeenCalledWith('notes.movedToTrash', expect.anything());

    await undoLastToast();

    await waitFor(async () =>
      expect(await db.notes.get(note.id)).toMatchObject({
        state: 'active',
        pinnedAt: note.pinnedAt,
      })
    );
  });

  it('pins an active note and offers an undo that unpins it', async () => {
    const note = makeNote();
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await chooseMenuItem('notes.pin');

    await waitFor(async () =>
      expect((await db.notes.get(note.id))?.pinnedAt).toEqual(expect.any(String))
    );

    await undoLastToast();
    await waitFor(async () => expect((await db.notes.get(note.id))?.pinnedAt).toBeUndefined());
  });

  it('archives an active note', async () => {
    const note = makeNote();
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await chooseMenuItem('notes.archive');

    await waitFor(async () => expect((await db.notes.get(note.id))?.state).toBe('archived'));
    expect(toastMock).toHaveBeenCalledWith('notes.archived', expect.anything());
  });

  it('offers restore and permanent deletion for a trashed note, and nothing else', async () => {
    const note = makeNote({ state: 'trashed', trashedAt: new Date().toISOString() });
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.menu' }));

    expect(await screen.findByText('notes.restore')).toBeInTheDocument();
    expect(screen.getByText('notes.deleteForever')).toBeInTheDocument();
    // Trashing or pinning something already in the trash is meaningless.
    expect(screen.queryByText('notes.moveToTrash')).not.toBeInTheDocument();
    expect(screen.queryByText('notes.pin')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('notes.deleteForever'));

    await waitFor(async () => expect(await db.notes.get(note.id)).toBeUndefined());
    expect(toastMock).toHaveBeenCalledWith('notes.deletedForever', expect.anything());

    // Purge is irreversible, so its undo re-puts the captured note verbatim.
    await undoLastToast();
    await waitFor(async () => expect(await db.notes.get(note.id)).toEqual(note));
  });

  it('offers restore instead of archive for an archived note', async () => {
    const note = makeNote({ state: 'archived' });
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await chooseMenuItem('notes.restore');

    await waitFor(async () => expect((await db.notes.get(note.id))?.state).toBe('active'));
  });

  it('renders the body for an image-only note (no header, no checklist text)', async () => {
    const note = makeNote({
      header: '',
      body: '<img data-attachment-id="x1">',
    });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    // The attachment row is not stored, so NoteBody's async blob resolution
    // never completes - but the <img> node itself must still mount (proving
    // NoteBody rendered), so the card is not blank.
    await waitFor(() => {
      expect(document.querySelector('img[data-attachment-id="x1"]')).toBeInTheDocument();
    });
  });

  it('renders a play button for an audio-only note (no header, no checklist text)', () => {
    const note = makeNote({
      header: '',
      body: '<audio data-attachment-id="au1"></audio>',
    });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    // An audio-only body (stripHtml drops the <audio> tag) would otherwise be a
    // blank card. The always-visible play button keeps it non-blank.
    expect(screen.getByRole('button', { name: 'notes.playAudio' })).toBeInTheDocument();
  });

  it('opens the editor with autoplay intent when the audio play button is clicked', async () => {
    const note = makeNote({ body: '<p>hello</p><audio data-attachment-id="au1"></audio>' });
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.playAudio' }));
    expect(onSelect).toHaveBeenCalledWith(note.id, { autoplayFirstAudio: true });
    expect(onSelect).toHaveBeenCalledTimes(1);

    // Clicking elsewhere on the same card must still take the plain open path.
    onSelect.mockClear();
    await userEvent.click(screen.getByText('My note'));
    expect(onSelect).toHaveBeenCalledWith(note.id);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders no play button when the note has no audio', () => {
    render(<NoteCard note={makeNote()} onSelect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'notes.playAudio' })).not.toBeInTheDocument();
  });

  it('renders a play button for a video-only note (no header, no checklist text)', () => {
    const note = makeNote({
      header: '',
      body: '<video data-attachment-id="v1"></video>',
    });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'notes.playVideo' })).toBeInTheDocument();
  });

  it('opens the note (no autoplay) when the video play button is clicked', async () => {
    const note = makeNote({ body: '<p>hello</p><video data-attachment-id="v1"></video>' });
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.playVideo' }));
    expect(onSelect).toHaveBeenCalledWith(note.id);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders both audio and video play buttons when a note has both', () => {
    const note = makeNote({
      header: '',
      body: '<audio data-attachment-id="au1"></audio><video data-attachment-id="v1"></video>',
    });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'notes.playAudio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'notes.playVideo' })).toBeInTheDocument();
  });

  it('shows a file button for a file-only body', () => {
    const note = makeNote({
      header: '',
      body: '<a data-attachment-id="f1">report.pdf</a>',
    });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'notes.openFile' })).toBeInTheDocument();
  });

  it('opens the note when the file button is clicked', async () => {
    const note = makeNote({ body: '<p>hello</p><a data-attachment-id="f1">report.pdf</a>' });
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.openFile' }));
    expect(onSelect).toHaveBeenCalledWith(note.id);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows audio, video, and file buttons together', () => {
    const note = makeNote({
      header: '',
      body: '<audio data-attachment-id="a1"></audio><video data-attachment-id="v1"></video><a data-attachment-id="f1">x</a>',
    });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'notes.playAudio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'notes.playVideo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'notes.openFile' })).toBeInTheDocument();
  });

  it('renders the note’s labels as read-only pills', async () => {
    const note = makeNote();
    const now = new Date().toISOString();
    await db.tags.bulkPut([
      { id: 't1', name: 'Work', color: 'blue', createdAt: now, updatedAt: now },
      { id: 't2', name: 'Ideas', createdAt: now, updatedAt: now },
      { id: 't3', name: 'Elsewhere', createdAt: now, updatedAt: now },
    ]);
    await db.noteTags.bulkPut([
      { noteId: note.id, tagId: 't1', createdAt: now, updatedAt: now },
      { noteId: note.id, tagId: 't2', createdAt: now, updatedAt: now },
    ]);

    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(await screen.findByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Ideas')).toBeInTheDocument();
    // Only this note's labels, and no remove affordance on a card.
    expect(screen.queryByText('Elsewhere')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tags.remove/ })).not.toBeInTheDocument();
  });
});

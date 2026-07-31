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

  it('does not open the editor when a rail control is keyboard-activated', async () => {
    const note = makeNote();
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    // Focus a rail control and press Enter: it runs its own action, but the
    // card's keydown handler must not also fire onSelect (guards against a
    // portalled synthetic-event bubble reopening the editor).
    screen.getByRole('button', { name: 'notes.color' }).focus();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).not.toHaveBeenCalled();
  });

  /** Fire the undo action from the most recent toast. */
  async function undoLastToast() {
    const opts = toastMock.mock.calls.at(-1)?.[1] as {
      action: { onClick: () => void | Promise<void> };
    };
    await opts.action.onClick();
  }

  it('moves the note to trash rather than deleting it, and offers an undo', async () => {
    const note = makeNote({ pinnedAt: new Date().toISOString() });
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.moveToTrash' }));

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

  it('pins an active note from the corner control, and offers an undo that unpins it', async () => {
    const note = makeNote();
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.pin' }));

    await waitFor(async () =>
      expect((await db.notes.get(note.id))?.pinnedAt).toEqual(expect.any(String))
    );

    await undoLastToast();
    await waitFor(async () => expect((await db.notes.get(note.id))?.pinnedAt).toBeUndefined());
  });

  it('offers unpin on an already pinned note', async () => {
    const note = makeNote({ pinnedAt: new Date().toISOString() });
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    const pin = screen.getByRole('button', { name: 'notes.unpin' });
    expect(pin).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(pin);

    await waitFor(async () => expect((await db.notes.get(note.id))?.pinnedAt).toBeUndefined());
  });

  // The Pin-Is-Always-In-Front Rule: the pin is a child of the card itself, not
  // of the content layer, so no attachment, scrim or action row can occlude it.
  it('mounts the pin outside the content layer so nothing can cover it', () => {
    const note = makeNote({ body: '<img data-attachment-id="x1">' });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    const card = screen.getByRole('heading', { name: 'My note' }).closest('[role="button"]');
    const pin = screen.getByRole('button', { name: 'notes.pin' });
    expect(pin.parentElement).toBe(card);
  });

  it('does not open the editor when the pin is clicked', async () => {
    const note = makeNote();
    await db.notes.add(note);
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.pin' }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('hides the pin where pinning is meaningless', () => {
    render(<NoteCard note={makeNote({ state: 'archived' })} onSelect={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'notes.pin' })).not.toBeInTheDocument();
  });

  it('archives an active note from the foot rail', async () => {
    const note = makeNote();
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.archive' }));

    await waitFor(async () => expect((await db.notes.get(note.id))?.state).toBe('archived'));
    expect(toastMock).toHaveBeenCalledWith('notes.archived', expect.anything());
  });

  it('recolours the card from the foot rail swatch', async () => {
    const note = makeNote();
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.color' }));
    await userEvent.click(await screen.findByRole('button', { name: 'colors.blue' }));

    await waitFor(async () => expect((await db.notes.get(note.id))?.color).toBe('blue'));
  });

  it('does not open the editor when a foot rail control is used', async () => {
    const note = makeNote();
    await db.notes.add(note);
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.color' }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the foot rail controls always visible', () => {
    render(<NoteCard note={makeNote()} onSelect={vi.fn()} />);

    const rail = document.querySelector('[data-slot="note-card-actions"]');
    expect(rail).not.toHaveClass('opacity-0');
    expect(rail).not.toHaveClass('group-hover:opacity-100');
  });

  it('offers restore instead of archive on the foot rail of an archived note', async () => {
    const note = makeNote({ state: 'archived' });
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'notes.archive' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'notes.restore' }));

    await waitFor(async () => expect((await db.notes.get(note.id))?.state).toBe('active'));
  });

  it('offers only restore for a trashed note, and never permanent deletion', async () => {
    const note = makeNote({ state: 'trashed', trashedAt: new Date().toISOString() });
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    // Trashing or pinning something already in the trash is meaningless, and
    // purging is not a card action at all - the trash itself is the
    // confirmation, so a note only leaves for good from /trash or by expiring.
    expect(screen.queryByRole('button', { name: 'notes.moveToTrash' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.pin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.deleteForever' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'notes.restore' }));

    await waitFor(async () => expect((await db.notes.get(note.id))?.state).toBe('active'));
  });

  it('never puts an overflow menu on the rail: every control is a direct button', () => {
    render(<NoteCard note={makeNote()} onSelect={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'notes.menu' })).not.toBeInTheDocument();
  });

  // Attachments are summarised by CardMedia rather than rendered inline, so
  // these assert the *grouping* contract: one block per kind, each standing in
  // for its siblings, so a card's height follows the layout and not what the
  // user happened to attach.
  const mediaSlots = (slot: string) =>
    document.querySelectorAll(`[data-slot="card-media-${slot}"]`);

  it('summarises an image-only note so the card is not blank', () => {
    const note = makeNote({ header: '', body: '<img data-attachment-id="x1">' });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(mediaSlots('visual')).toHaveLength(1);
  });

  it('does not render an attachment a second time inside the text preview', () => {
    const note = makeNote({ body: '<img data-attachment-id="x1"><p>hello</p>' });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(document.querySelector('img[data-attachment-id="x1"]')).not.toBeInTheDocument();
  });

  it('collapses several pictures into one capped wall with a +N tile', () => {
    const body = Array.from({ length: 6 }, (_, i) => `<img data-attachment-id="i${i}">`).join('');
    render(<NoteCard note={makeNote({ body })} onSelect={vi.fn()} />);

    expect(mediaSlots('grid')).toHaveLength(1);
    expect(mediaSlots('tile')).toHaveLength(4);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders a play button for an audio-only note', () => {
    const note = makeNote({ header: '', body: '<audio data-attachment-id="au1"></audio>' });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'notes.playAudio' })).toBeInTheDocument();
  });

  it('collapses several voice notes into one player carrying a +N', () => {
    const note = makeNote({
      body: '<audio data-attachment-id="a1"></audio><audio data-attachment-id="a2"></audio><audio data-attachment-id="a3"></audio>',
    });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(screen.getAllByRole('button', { name: 'notes.playAudio' })).toHaveLength(1);
    expect(screen.getByText('+2')).toBeInTheDocument();
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

  it('renders no media summary at all when the note has no attachments', () => {
    render(<NoteCard note={makeNote()} onSelect={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'notes.playAudio' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="card-media"]')).not.toBeInTheDocument();
  });

  it('summarises a video-only note as a video preview, not as a bare chip', () => {
    const note = makeNote({ header: '', body: '<video data-attachment-id="v1"></video>' });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(
      document.querySelector('[data-slot="card-media-visual"][data-kind="video"]')
    ).toBeTruthy();
  });

  it('summarises a drawing as its own preview kind', () => {
    const note = makeNote({
      header: '',
      body: '<excalidraw-drawing data-attachment-id="d1"></excalidraw-drawing>',
    });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(
      document.querySelector('[data-slot="card-media-visual"][data-kind="excalidraw"]')
    ).toBeTruthy();
  });

  it('opens the note when a video preview is clicked, like any other part of the card', async () => {
    const note = makeNote({ body: '<p>hello</p><video data-attachment-id="v1"></video>' });
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    await userEvent.click(screen.getByText('hello'));
    expect(onSelect).toHaveBeenCalledWith(note.id);
  });

  it('shows a file row for a file-only body', () => {
    const note = makeNote({ header: '', body: '<a data-attachment-id="f1">report.pdf</a>' });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(mediaSlots('file')).toHaveLength(1);
  });

  it('collapses several files into one row carrying a +N', () => {
    const note = makeNote({
      body: '<a data-attachment-id="f1">a</a><a data-attachment-id="f2">b</a>',
    });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(mediaSlots('file')).toHaveLength(1);
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('gives each kind its own block when a note carries all three', () => {
    const note = makeNote({
      header: '',
      body: '<audio data-attachment-id="a1"></audio><video data-attachment-id="v1"></video><a data-attachment-id="f1">x</a>',
    });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(mediaSlots('visual')).toHaveLength(1);
    expect(mediaSlots('audio')).toHaveLength(1);
    expect(mediaSlots('file')).toHaveLength(1);
  });

  it('caps card labels at three pills followed by one +N pill', async () => {
    const note = makeNote();
    const now = new Date().toISOString();
    const tags = Array.from({ length: 5 }, (_, index) => ({
      id: `t${index + 1}`,
      name: `Label ${index + 1}`,
      createdAt: now,
      updatedAt: now,
    }));
    await db.tags.bulkPut(tags);
    await db.noteTags.bulkPut(
      tags.map((tag) => ({
        noteId: note.id,
        tagId: tag.id,
        createdAt: now,
        updatedAt: now,
      }))
    );

    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(await screen.findByText('Label 1')).toBeInTheDocument();
    expect(screen.getByText('Label 2')).toBeInTheDocument();
    expect(screen.getByText('Label 3')).toBeInTheDocument();
    expect(screen.queryByText('Label 4')).not.toBeInTheDocument();
    expect(screen.queryByText('Label 5')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
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

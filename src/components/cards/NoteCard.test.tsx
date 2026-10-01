import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@/models.ts';
import { clearStore, renderWithStore as render, testStore } from '@/test/store.tsx';
import { NoteCard } from './NoteCard.tsx';

// Keys pass through untranslated so assertions are stable.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-GB' } }),
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
  await clearStore();
});

beforeEach(() => {
  motion.reduced = false;
  // jsdom lacks object-URL APIs; CardMedia mints them for its previews.
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

    const card = screen.getByRole('heading', { name: 'My note' }).closest('[data-slot="card"]');
    expect(card).toHaveAttribute('data-note-color', 'blue');
    expect(card?.querySelector('[data-slot="note-card-surface"]')).toBeInTheDocument();
  });

  it('uses the default identity for an uncoloured card', () => {
    render(<NoteCard note={makeNote()} onSelect={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: 'My note' }).closest('[data-slot="card"]')
    ).toHaveAttribute('data-note-color', 'default');
  });

  it('removes hover movement but keeps the material change under reduced motion', () => {
    motion.reduced = true;
    render(<NoteCard note={makeNote()} onSelect={vi.fn()} />);

    const surface = document.querySelector('[data-slot="note-card-surface"]');
    expect(surface).not.toHaveClass('group-hover:scale-[1.02]');
    expect(surface).toHaveClass('group-hover:border-note-border-hover');
  });

  it("opens the editor from the keyboard through the title's button", async () => {
    const note = makeNote();
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    screen.getByRole('button', { name: 'My note' }).focus();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith(note.id);
  });

  it("names the open button by the title alone, never by the rail's controls", () => {
    render(<NoteCard note={makeNote()} onSelect={vi.fn()} />);

    const open = screen.getByRole('button', { name: 'My note' });
    expect(open).toHaveAttribute('data-slot', 'note-card-open');
    expect(screen.queryByRole('button', { name: /My note.+notes\./ })).not.toBeInTheDocument();
  });

  it('puts the open button first in the tab order, and names an untitled one', async () => {
    render(<NoteCard note={makeNote({ header: '' })} onSelect={vi.fn()} />);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'notes.editNoteTitle' })).toHaveFocus();
  });

  it('names a whitespace-only title as untitled', () => {
    render(<NoteCard note={makeNote({ header: '   ' })} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'notes.editNoteTitle' })).toBeInTheDocument();
  });

  it('focuses the open button on a click, so closing the editor returns focus here', async () => {
    render(<NoteCard note={makeNote()} onSelect={vi.fn()} />);
    await userEvent.click(screen.getByText('My note'));
    expect(screen.getByRole('button', { name: 'My note' })).toHaveFocus();
  });

  it('does not open the editor when a rail control is keyboard-activated', async () => {
    const note = makeNote();
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    // Focus a rail control and press Enter: it runs its own action, and its click
    // must not bubble to the Card's `onClick` and open the editor too.
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
    await testStore.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.moveToTrash' }));

    await waitFor(async () => expect((await testStore.notes.get(note.id))?.state).toBe('trashed'));
    // Trashing is recoverable - the row must still be there.
    expect(await testStore.notes.get(note.id)).toBeTruthy();
    expect(toastMock).toHaveBeenCalledWith('notes.movedToTrash', expect.anything());

    await undoLastToast();

    await waitFor(async () =>
      expect(await testStore.notes.get(note.id)).toMatchObject({
        state: 'active',
        pinnedAt: note.pinnedAt,
      })
    );
  });

  it('pins an active note from the corner control, and offers an undo that unpins it', async () => {
    const note = makeNote();
    await testStore.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.pin' }));

    await waitFor(async () =>
      expect((await testStore.notes.get(note.id))?.pinnedAt).toEqual(expect.any(String))
    );

    await undoLastToast();
    await waitFor(async () =>
      expect((await testStore.notes.get(note.id))?.pinnedAt).toBeUndefined()
    );
  });

  it('offers unpin on an already pinned note', async () => {
    const note = makeNote({ pinnedAt: new Date().toISOString() });
    await testStore.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    const pin = screen.getByRole('button', { name: 'notes.unpin' });
    expect(pin).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(pin);

    await waitFor(async () =>
      expect((await testStore.notes.get(note.id))?.pinnedAt).toBeUndefined()
    );
  });

  // The Pin-Is-Always-In-Front Rule: the pin is a child of the card itself, not
  // of the content layer, so no attachment, scrim or action row can occlude it.
  it('mounts the pin outside the content layer so nothing can cover it', () => {
    const note = makeNote({ body: '<img data-attachment-id="x1">' });
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    const card = screen.getByRole('heading', { name: 'My note' }).closest('[data-slot="card"]');
    const pin = screen.getByRole('button', { name: 'notes.pin' });
    expect(pin.parentElement).toBe(card);
  });

  it('does not open the editor when the pin is clicked', async () => {
    const note = makeNote();
    await testStore.notes.add(note);
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.pin' }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows a reminder as a chip, and hides it once the note is trashed', () => {
    const reminder = { remindAt: '2030-03-04T09:00', repeat: 'weekly' } as const;
    const { unmount } = render(<NoteCard note={makeNote(reminder)} onSelect={vi.fn()} />);
    expect(screen.getByTestId('reminder-chip')).toHaveTextContent(/0?9:00/);
    unmount();

    // The fields stay on the row, so Restore brings the chip back - only the
    // card stops showing an appointment a note on its way out no longer keeps.
    render(
      <NoteCard
        note={makeNote({ ...reminder, state: 'trashed', trashedAt: new Date().toISOString() })}
        onSelect={vi.fn()}
      />
    );
    expect(screen.queryByTestId('reminder-chip')).not.toBeInTheDocument();
  });

  it('hides the pin where pinning is meaningless', () => {
    render(<NoteCard note={makeNote({ state: 'archived' })} onSelect={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'notes.pin' })).not.toBeInTheDocument();
  });

  it('archives an active note from the foot rail', async () => {
    const note = makeNote();
    await testStore.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.archive' }));

    await waitFor(async () => expect((await testStore.notes.get(note.id))?.state).toBe('archived'));
    expect(toastMock).toHaveBeenCalledWith('notes.archived', expect.anything());
  });

  it('recolours the card from the foot rail swatch', async () => {
    const note = makeNote();
    await testStore.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.color' }));
    await userEvent.click(await screen.findByRole('button', { name: 'colors.blue' }));

    await waitFor(async () => expect((await testStore.notes.get(note.id))?.color).toBe('blue'));
  });

  it('does not open the editor when a foot rail control is used', async () => {
    const note = makeNote();
    await testStore.notes.add(note);
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
    await testStore.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'notes.archive' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'notes.restore' }));

    await waitFor(async () => expect((await testStore.notes.get(note.id))?.state).toBe('active'));
  });

  it('offers only restore for a trashed note, and never permanent deletion', async () => {
    const note = makeNote({ state: 'trashed', trashedAt: new Date().toISOString() });
    await testStore.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    // Trashing or pinning something already in the trash is meaningless, and
    // purging is not a card action at all - the trash itself is the
    // confirmation, so a note only leaves for good from /trash or by expiring.
    expect(screen.queryByRole('button', { name: 'notes.moveToTrash' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.pin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.deleteForever' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'notes.restore' }));

    await waitFor(async () => expect((await testStore.notes.get(note.id))?.state).toBe('active'));
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

  // The feed joins every card's rows in one query and hands them down. If a card
  // silently fell back to its own query, nothing would look wrong - the N+1 would
  // just be back - so this pins the rows coming from the prop by leaving the
  // database empty and still expecting a drawing to render.
  it('draws from the rows the feed handed it, without querying for its own', async () => {
    const now = new Date().toISOString();
    const note = makeNote({
      header: '',
      body: '<excalidraw-drawing data-attachment-id="d1"></excalidraw-drawing>',
    });
    const attachments = new Map([
      [
        'd1',
        {
          id: 'd1',
          noteId: note.id,
          kind: 'excalidraw' as const,
          mime: 'application/json',
          blob: new Blob(['{}'], { type: 'application/json' }),
          preview: '<svg id="from-prop"></svg>',
          createdAt: now,
          updatedAt: now,
        },
      ],
    ]);

    render(<NoteCard note={note} attachments={attachments} onSelect={vi.fn()} />);

    await waitFor(() => expect(document.querySelector('svg#from-prop')).toBeTruthy());
    expect(await testStore.attachments.list()).toHaveLength(0);
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
    for (const tag of tags) await testStore.tags.add(tag);
    for (const tag of tags) {
      await testStore.tags.link({ noteId: note.id, tagId: tag.id, createdAt: now, updatedAt: now });
    }

    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(await screen.findByText('Label 1')).toBeInTheDocument();
    expect(screen.getByText('Label 2')).toBeInTheDocument();
    expect(screen.getByText('Label 3')).toBeInTheDocument();
    expect(screen.queryByText('Label 4')).not.toBeInTheDocument();
    expect(screen.queryByText('Label 5')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  describe('checklist (ADR 0013)', () => {
    const checklist = (...items: [string, boolean][]) =>
      `<ul data-type="taskList">${items
        .map(
          ([label, checked]) =>
            `<li data-type="taskItem" data-checked="${checked}">` +
            `<label><input type="checkbox"${checked ? ' checked' : ''}><span></span></label>` +
            `<div><p>${label}</p></div></li>`
        )
        .join('')}</ul>`;

    /** The card writes to Dexie, so the stored note is what the tick has to reach. */
    const storedBody = async (id: string) => (await testStore.notes.get(id))?.body;

    it('ticks an item from the card and persists it', async () => {
      // The defect this whole slice starts from: the box flipped, nothing was
      // written, and reopening the note showed it unchecked again.
      const note = makeNote({ body: checklist(['Milk', false], ['Bread', false]) });
      await testStore.notes.put(note);
      render(<NoteCard note={note} onSelect={vi.fn()} />);

      await userEvent.click(screen.getAllByRole('checkbox')[0]);

      await waitFor(async () => {
        expect(await storedBody(note.id)).toContain('<li data-type="taskItem" data-checked="true"');
      });
    });

    it('does not open the note when the box itself is clicked', async () => {
      const note = makeNote({ body: checklist(['Milk', false]) });
      await testStore.notes.put(note);
      const onSelect = vi.fn();
      render(<NoteCard note={note} onSelect={onSelect} />);

      await userEvent.click(screen.getAllByRole('checkbox')[0]);

      expect(onSelect).not.toHaveBeenCalled();
    });

    /** jsdom lays nothing out and its Range has no `getClientRects`; this is
     *  where the item's text sits, so a click at (0,0) is on or off it. */
    const layText = (rect: { left: number; right: number; top: number; bottom: number }) => {
      Range.prototype.getClientRects = vi.fn(() => [rect] as unknown as DOMRectList);
    };
    afterEach(() => {
      // @ts-expect-error restoring jsdom's absence of the method
      Range.prototype.getClientRects = undefined;
    });

    it('ticks when the item’s text is clicked, and does not open the note', async () => {
      // The box and the words are the control (CONTEXT.md, Card): a thumb aims
      // at the words, not at a 32px square beside them.
      layText({ left: 0, right: 40, top: 0, bottom: 20 });
      const note = makeNote({ body: checklist(['Milk', false]) });
      await testStore.notes.put(note);
      const onSelect = vi.fn();
      render(<NoteCard note={note} onSelect={onSelect} />);

      await userEvent.click(screen.getByText('Milk'));

      await waitFor(async () => {
        expect(await storedBody(note.id)).toContain('data-checked="true"');
      });
      expect(onSelect).not.toHaveBeenCalled();
      expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    });

    it('opens the note when the empty space after the text is clicked', async () => {
      // The row is not the control: past the end of the words it is the card.
      layText({ left: 100, right: 140, top: 0, bottom: 20 });
      const note = makeNote({ body: checklist(['Milk', false]) });
      await testStore.notes.put(note);
      const onSelect = vi.fn();
      render(<NoteCard note={note} onSelect={onSelect} />);

      await userEvent.click(screen.getByText('Milk'));

      expect(onSelect).toHaveBeenCalledWith(note.id);
      expect(await storedBody(note.id)).toContain('data-checked="false"');
    });

    it('opens the note from a long press on the row', async () => {
      const note = makeNote({ body: checklist(['Milk', false]) });
      await testStore.notes.put(note);
      const onSelect = vi.fn();
      render(<NoteCard note={note} onSelect={onSelect} />);
      const row = screen.getByText('Milk').closest('li') as HTMLElement;

      // Only the hold's own timer is faked: the store's reads and writes ride
      // on the real clock, and a fake one would stall them.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
        await act(async () => {
          vi.advanceTimersByTime(500);
        });
      } finally {
        vi.useRealTimers();
      }

      expect(onSelect).toHaveBeenCalledWith(note.id);
      expect(await storedBody(note.id)).toContain('data-checked="false"');
    });

    it('ticks from the keyboard, because the box is a real focusable control', async () => {
      // This is why the delegated listener does not need its own key handler:
      // Space on a focused checkbox fires a click, which reaches the delegate by
      // bubbling. The a11y suppression in `NoteBody` rests on this test.
      const note = makeNote({ body: checklist(['Milk', false]) });
      await testStore.notes.put(note);
      render(<NoteCard note={note} onSelect={vi.fn()} />);

      screen.getAllByRole('checkbox')[0].focus();
      await userEvent.keyboard(' ');

      await waitFor(async () => {
        expect(await storedBody(note.id)).toContain('data-checked="true"');
      });
    });

    it('unticks an item that was checked', async () => {
      const note = makeNote({ body: checklist(['Milk', true]) });
      await testStore.notes.put(note);
      render(<NoteCard note={note} onSelect={vi.fn()} />);

      await userEvent.click(screen.getAllByRole('checkbox')[0]);

      await waitFor(async () => {
        expect(await storedBody(note.id)).toContain('data-checked="false"');
      });
    });

    it('ticks the item that was clicked, not the first one', async () => {
      const note = makeNote({
        body: checklist(['Milk', false], ['Bread', false], ['Eggs', false]),
      });
      await testStore.notes.put(note);
      render(<NoteCard note={note} onSelect={vi.fn()} />);

      await userEvent.click(screen.getAllByRole('checkbox')[2]);

      await waitFor(async () => {
        const body = (await storedBody(note.id)) ?? '';
        expect(body.match(/data-checked="true"/g) ?? []).toHaveLength(1);
        expect(body.indexOf('data-checked="true"')).toBeGreaterThan(body.indexOf('Bread'));
      });
    });

    it('leaves the stored order exactly as it was written', async () => {
      // The regression guard for sinking being presentation: the card must move
      // nothing, because the stored order is what a backup and M5 sync carry.
      const note = makeNote({
        body: checklist(['Milk', false], ['Bread', false], ['Eggs', false]),
      });
      await testStore.notes.put(note);
      render(<NoteCard note={note} onSelect={vi.fn()} />);

      await userEvent.click(screen.getAllByRole('checkbox')[0]);

      await waitFor(async () => {
        const body = (await storedBody(note.id)) ?? '';
        expect(body.indexOf('Milk')).toBeLessThan(body.indexOf('Bread'));
        expect(body.indexOf('Bread')).toBeLessThan(body.indexOf('Eggs'));
      });
    });
  });

  it('renders the note’s labels as read-only pills', async () => {
    const note = makeNote();
    const now = new Date().toISOString();
    for (const tag of [
      { id: 't1', name: 'Work', color: 'blue', createdAt: now, updatedAt: now },
      { id: 't2', name: 'Ideas', createdAt: now, updatedAt: now },
      { id: 't3', name: 'Elsewhere', createdAt: now, updatedAt: now },
    ]) {
      await testStore.tags.add(tag);
    }
    for (const tagId of ['t1', 't2']) {
      await testStore.tags.link({ noteId: note.id, tagId, createdAt: now, updatedAt: now });
    }

    render(<NoteCard note={note} onSelect={vi.fn()} />);

    expect(await screen.findByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Ideas')).toBeInTheDocument();
    // Only this note's labels, and no remove affordance on a card.
    expect(screen.queryByText('Elsewhere')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tags.remove/ })).not.toBeInTheDocument();
  });
});

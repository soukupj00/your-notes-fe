import { describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from '@/lib/persistentStorage.ts';
import { createNoteDraft, isEmpty, type NoteDraft } from './draft.ts';

vi.mock('@/lib/persistentStorage.ts', () => ({ requestPersistentStorage: vi.fn(async () => {}) }));

function deps(typed = { header: '', body: '' }) {
  return {
    content: () => typed,
    createNote: vi.fn(async (_note: { id: string; header: string; body: string }) => {}),
    updateNote: vi.fn(async (_id: string, _change: { header: string; body: string }) => {}),
    purgeNote: vi.fn(async (_id: string) => {}),
    collectOrphans: vi.fn(async (_id: string, _referenced: string[]) => {}),
  };
}

const newDraft = (d = deps()) => [createNoteDraft({ id: 'n1', isNew: true }, d), d] as const;
const openNote = (d = deps()) => [createNoteDraft({ id: 'n1', isNew: false }, d), d] as const;

/** A promise the test settles by hand, to hold a write open. */
function held() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe('isEmpty', () => {
  it.each([
    ['nothing at all', '', '', true],
    ['blank markup', '  ', '<p> </p>', true],
    ['a header', 'Milk', '', false],
    ['words in the body', '', '<p>hi</p>', false],
    ['an Attachment and no words', '', '<img data-attachment-id="a1">', false],
  ])('%s', (_, header, body, expected) => {
    expect(isEmpty(header, body)).toBe(expected);
  });
});

describe('a new Draft', () => {
  it('writes nothing while it is empty', async () => {
    const [draft, d] = newDraft();

    await draft.save('', '<p></p>');

    expect(d.createNote).not.toHaveBeenCalled();
    expect(draft.saved).toBe(false);
  });

  it('creates its row under its id on the first content, then updates it', async () => {
    const [draft, d] = newDraft();

    await draft.save('Milk', '');
    expect(d.createNote).toHaveBeenCalledWith({ id: 'n1', header: 'Milk', body: '' });
    expect(draft.saved).toBe(true);

    await draft.save('Milk and bread', '');
    expect(d.createNote).toHaveBeenCalledOnce();
    expect(d.updateNote).toHaveBeenCalledWith('n1', { header: 'Milk and bread', body: '' });
  });

  it('earns its row on demand with what is typed so far, once', async () => {
    const [draft, d] = newDraft(deps({ header: 'Half a', body: '<p>thought</p>' }));

    await expect(draft.ensureSaved()).resolves.toBe('n1');
    expect(d.createNote).toHaveBeenCalledWith({
      id: 'n1',
      header: 'Half a',
      body: '<p>thought</p>',
    });

    await expect(draft.ensureSaved()).resolves.toBe('n1');
    expect(d.createNote).toHaveBeenCalledOnce();
  });

  // Both read "no row yet" in the same tick; without one queue each would create.
  it.each([
    [
      'an act, then a save',
      (draft: NoteDraft) => [draft.ensureSaved(), draft.save('', '<p>hi</p>')],
      1,
    ],
    [
      'a save, then an act',
      (draft: NoteDraft) => [draft.save('', '<p>hi</p>'), draft.ensureSaved()],
      0,
    ],
  ])('creates one row when %s race in one tick', async (_, race, updates) => {
    const [draft, d] = newDraft(deps({ header: '', body: '<p>hi</p>' }));

    await Promise.all(race(draft));

    expect(d.createNote).toHaveBeenCalledOnce();
    // The second arrival finds the row: a save updates it, an act only answers the id.
    expect(d.updateNote).toHaveBeenCalledTimes(updates);
  });

  it('leaves nothing behind when it closes empty', async () => {
    const [draft, d] = newDraft();

    await draft.close('', '', { keepEmpty: false, edited: true });

    expect(d.createNote).not.toHaveBeenCalled();
    expect(d.purgeNote).not.toHaveBeenCalled();
    expect(d.collectOrphans).not.toHaveBeenCalled();
  });

  it('asks for persistent storage once it has written, not before', async () => {
    const [draft] = newDraft();
    vi.mocked(requestPersistentStorage).mockClear();

    await draft.save('', '');
    expect(requestPersistentStorage).not.toHaveBeenCalled();

    await draft.save('Milk', '');
    expect(requestPersistentStorage).toHaveBeenCalledOnce();
  });
});

describe('an open Note', () => {
  it('answers its id to an act without writing', async () => {
    const [draft, d] = openNote();

    await expect(draft.ensureSaved()).resolves.toBe('n1');

    expect(d.createNote).not.toHaveBeenCalled();
    expect(d.updateNote).not.toHaveBeenCalled();
    expect(draft.saved).toBe(true);
  });

  it('updates on save, even to empty', async () => {
    const [draft, d] = openNote();

    await draft.save('', '');

    expect(d.updateNote).toHaveBeenCalledWith('n1', { header: '', body: '' });
    expect(d.createNote).not.toHaveBeenCalled();
  });
});

describe('closing', () => {
  it('writes the last content, then sweeps the Attachments the Body dropped', async () => {
    const [draft, d] = openNote();
    const body = '<p>kept</p><img data-attachment-id="a1">';

    await draft.close('Milk', body, { keepEmpty: false, edited: true });

    expect(d.updateNote).toHaveBeenCalledWith('n1', { header: 'Milk', body });
    expect(d.collectOrphans).toHaveBeenCalledWith('n1', ['a1']);
    expect(d.purgeNote).not.toHaveBeenCalled();
  });

  // A read is not an edit: the write would bump `updatedAt`, re-rank the feed and sync as a change.
  it('writes nothing for a Note that was only read', async () => {
    const [draft, d] = openNote();

    await draft.close('Milk', '<p>kept</p>', { keepEmpty: false, edited: false });

    expect(d.updateNote).not.toHaveBeenCalled();
    expect(d.collectOrphans).toHaveBeenCalledWith('n1', []);
  });

  it('purges a Note that was emptied out', async () => {
    const [draft, d] = openNote();

    await draft.close('', '', { keepEmpty: false, edited: true });

    expect(d.purgeNote).toHaveBeenCalledWith('n1');
    expect(d.collectOrphans).not.toHaveBeenCalled();
    expect(draft.saved).toBe(false);
  });

  it('keeps an empty Note it is told to keep', async () => {
    const [draft, d] = openNote();

    await draft.close('', '', { keepEmpty: true, edited: true });

    expect(d.purgeNote).not.toHaveBeenCalled();
    expect(d.collectOrphans).toHaveBeenCalledWith('n1', []);
  });

  it('decides the fate after a create that was still in flight', async () => {
    const [draft, d] = newDraft();
    const create = held();
    d.createNote.mockReturnValueOnce(create.promise);

    const first = draft.save('a', '');
    const closing = draft.close('', '', { keepEmpty: false, edited: true });
    create.release();
    await Promise.all([first, closing]);

    // The row the autosave created is the one the empty close purges.
    expect(d.createNote).toHaveBeenCalledOnce();
    expect(d.purgeNote).toHaveBeenCalledWith('n1');
  });
});

describe('the write queue', () => {
  it('runs writes one after another', async () => {
    const [draft, d] = newDraft();
    const create = held();
    d.createNote.mockReturnValueOnce(create.promise);

    const first = draft.save('a', '');
    const second = draft.save('ab', '');
    await Promise.resolve();
    expect(d.updateNote).not.toHaveBeenCalled();

    create.release();
    await Promise.all([first, second]);

    expect(d.createNote).toHaveBeenCalledOnce();
    expect(d.updateNote).toHaveBeenCalledWith('n1', { header: 'ab', body: '' });
  });

  it('tells a failed write to its caller and still runs the next one', async () => {
    const [draft, d] = newDraft();
    d.createNote.mockRejectedValueOnce(new Error('quota exceeded'));

    await expect(draft.save('Milk', '')).rejects.toThrow('quota exceeded');
    expect(draft.saved).toBe(false);

    await draft.save('Milk', '');
    expect(d.createNote).toHaveBeenCalledTimes(2);
    expect(draft.saved).toBe(true);
  });
});

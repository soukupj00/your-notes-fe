import { bodyHasAttachment, extractAttachmentIds } from '@/lib/body.ts';
import { requestPersistentStorage } from '@/lib/persistentStorage.ts';
import { stripHtml } from '@/lib/utils.ts';

/** Nothing a person would miss: no words in the header or the Body, and no Attachment. */
export const isEmpty = (header: string, body: string) =>
  header.trim() === '' && stripHtml(body).trim() === '' && !bodyHasAttachment(body);

/**
 * The Editor's working copy of a Note for the life of one open (CONTEXT.md "Draft"). It has its
 * id from the open and earns its row on the first content or the first act that needs one.
 */
export interface NoteDraft {
  /** Fixed from the open: the URL names the Note before its row exists (ADR 0014). */
  readonly id: string;
  /** Whether the Note has its row yet; `ensureSaved()` makes it so. */
  readonly saved: boolean;
  /**
   * For an act that needs the row (a label, an Attachment, a Reminder): earns it now with what is
   * typed so far, and answers the id.
   */
  ensureSaved(): Promise<string>;
  /** Writes the header and the Body; an empty new Draft is not worth a row yet. */
  save(header: string, body: string): Promise<void>;
  /**
   * The last write, if anything was `edited` this open, then the Note's fate: purged when empty
   * unless kept, otherwise swept of the Attachments its Body no longer references.
   */
  close(
    header: string,
    body: string,
    options: { keepEmpty: boolean; edited: boolean }
  ): Promise<void>;
}

export function createNoteDraft(
  { id, isNew }: { id: string; isNew: boolean },
  {
    content,
    createNote,
    updateNote,
    purgeNote,
    collectOrphans,
  }: {
    /** What the user has typed so far, read when an act needs the row before the autosave ran. */
    content: () => { header: string; body: string };
    createNote: (note: { id: string; header: string; body: string }) => Promise<unknown>;
    updateNote: (id: string, change: { header: string; body: string }) => Promise<unknown>;
    purgeNote: (id: string) => Promise<unknown>;
    /** Drops the Note's Attachment rows its Body no longer references. */
    collectOrphans: (id: string, referenced: string[]) => Promise<unknown>;
  }
): NoteDraft {
  let saved = !isNew;
  // One queue for the writes that may create the row, so a save and an act racing on a new Draft
  // create it once.
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work);
    // The caller sees its own failure; the queue must not fail every later write with it.
    queue = next.catch(() => undefined);
    return next;
  };

  const write = async (header: string, body: string) => {
    if (saved) {
      await updateNote(id, { header, body });
      return;
    }
    await createNote({ id, header, body });
    saved = true;
  };

  const save = (header: string, body: string) =>
    enqueue(async () => {
      if (!saved && isEmpty(header, body)) return;
      await write(header, body);
      // The user's first own writing is when persistent storage is worth a prompt
      // (lib/persistentStorage.ts).
      void requestPersistentStorage();
    });

  const ensureSaved = () =>
    enqueue(async () => {
      if (!saved) {
        const typed = content();
        await write(typed.header, typed.body);
      }
      return id;
    });

  const close: NoteDraft['close'] = async (header, body, { keepEmpty, edited }) => {
    // A read is not an edit: the write would bump `updatedAt` and sync as a change.
    if (edited) await save(header, body);
    else await queue;
    if (!saved) return;
    if (isEmpty(header, body) && !keepEmpty) {
      await purgeNote(id);
      saved = false;
      return;
    }
    // Safe only now: the in-editor undo stack that could restore a reference is gone.
    await collectOrphans(id, extractAttachmentIds(body));
  };

  return {
    id,
    get saved() {
      return saved;
    },
    ensureSaved,
    save,
    close,
  };
}

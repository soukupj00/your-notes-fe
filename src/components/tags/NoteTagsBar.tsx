import { useState } from 'react';
import { TagPills } from '@/components/tags/TagPills.tsx';
import { TagPopover } from '@/components/tags/TagPopover.tsx';
import { useTagActions } from '@/hooks/data/useTagActions.ts';
import { useTags } from '@/hooks/data/useTags.ts';
import { useTagsForNote } from '@/hooks/data/useTagsForNote.ts';
import { cn } from '@/lib/utils.ts';
import type { Tag } from '@/models.ts';

type NoteTagsBarProps = {
  /** The note's id, or null for a draft that has not been persisted yet. */
  noteId: string | null;
  /** Persists the draft on demand and returns its id. Required when `noteId` is null. */
  ensureNoteId?: () => Promise<string>;
  className?: string;
};

/**
 * A note's labels plus the control that changes them: removable pills next to
 * the "＋ Label" popover.
 *
 * Assignment needs a persisted note, but the editor opens drafts that don't
 * exist yet - so the id is resolved lazily through `ensureNoteId` on the first
 * change and remembered here (the parent's `noteId` prop stays null: it holds
 * the draft id in a ref, not in state).
 */
export function NoteTagsBar({ noteId, ensureNoteId, className }: NoteTagsBarProps) {
  const [resolvedId, setResolvedId] = useState(noteId);
  const tags = useTags();
  const assigned = useTagsForNote(resolvedId ?? '');
  const { createTag, addTagToNote, removeTagFromNote } = useTagActions();

  const assignedIds = new Set(assigned.map((tag) => tag.id));

  const resolveNoteId = async () => {
    if (resolvedId) return resolvedId;
    if (!ensureNoteId) throw new Error('NoteTagsBar needs ensureNoteId to label an unsaved note');
    const created = await ensureNoteId();
    setResolvedId(created);
    return created;
  };

  const toggle = async (tag: Tag) => {
    const id = await resolveNoteId();
    if (assignedIds.has(tag.id)) {
      await removeTagFromNote(id, tag.id);
    } else {
      await addTagToNote(id, tag.id);
    }
  };

  const create = async (name: string) => {
    const id = await resolveNoteId();
    const tag = await createTag(name);
    await addTagToNote(id, tag.id);
  };

  const remove = async (tag: Tag) => {
    const id = await resolveNoteId();
    await removeTagFromNote(id, tag.id);
  };

  return (
    /*
     * A column, not a wrapping row: the trigger keeps its own line and the pills
     * flow underneath it.
     *
     * The pills are a single `<ul>`, so in one wrapping row they are one flex
     * item - the moment they outgrow the space beside the trigger the whole
     * block drops to the next line, and anything after it (the editor bar's
     * colour and pin) is pushed down again. Stacking makes the trigger's
     * position independent of how many labels a note carries, which also keeps
     * the popover anchored where the user last clicked.
     */
    <div className={cn('flex min-w-0 flex-col items-start gap-1.5', className)}>
      <TagPopover
        tags={tags}
        assignedIds={assignedIds}
        onToggle={(tag) => void toggle(tag)}
        onCreate={(name) => void create(name)}
      />
      <TagPills tags={assigned} onRemove={(tag) => void remove(tag)} className="max-w-full" />
    </div>
  );
}

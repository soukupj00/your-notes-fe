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
 * A draft's id is resolved lazily through `ensureNoteId` (CLAUDE.md, Tags) and remembered here,
 * because the parent's `noteId` prop stays null for the whole open.
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
    /* A column, so the trigger and its popover stay put however many labels a note carries. */
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

import { TagPills } from '@/components/tags/TagPills.tsx';
import { TagPopover } from '@/components/tags/TagPopover.tsx';
import { useTagActions } from '@/hooks/data/useTagActions.ts';
import { useTags } from '@/hooks/data/useTags.ts';
import { useTagsForNote } from '@/hooks/data/useTagsForNote.ts';
import type { NoteDraft } from '@/lib/draft.ts';
import { cn } from '@/lib/utils.ts';
import type { Tag } from '@/models.ts';

type NoteTagsBarProps = {
  draft: NoteDraft;
  className?: string;
};

/**
 * The one place labels are assigned (CLAUDE.md, Tags). A label needs the Note's row, so each act
 * goes through the Draft's `ensureSaved`, the same queue Attachments use.
 */
export function NoteTagsBar({ draft, className }: NoteTagsBarProps) {
  const tags = useTags();
  const assigned = useTagsForNote(draft.id);
  const { createTag, addTagToNote, removeTagFromNote } = useTagActions();

  const assignedIds = new Set(assigned.map((tag) => tag.id));

  const toggle = async (tag: Tag) => {
    const id = await draft.ensureSaved();
    if (assignedIds.has(tag.id)) {
      await removeTagFromNote(id, tag.id);
    } else {
      await addTagToNote(id, tag.id);
    }
  };

  const create = async (name: string) => {
    const id = await draft.ensureSaved();
    const tag = await createTag(name);
    await addTagToNote(id, tag.id);
  };

  const remove = async (tag: Tag) => {
    const id = await draft.ensureSaved();
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

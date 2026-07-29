import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { noteColorStyle } from '@/lib/note-colors.ts';
import { cn } from '@/lib/utils.ts';
import type { Tag } from '@/models.ts';

type TagPillsProps = {
  tags: Tag[];
  /** When given, each pill grows a remove button. Omit for a read-only row. */
  onRemove?: (tag: Tag) => void;
  className?: string;
};

/**
 * A note's labels as pills, tinted from the shared Note/Tag palette so a label
 * reads the same wherever it appears. Read-only on cards, removable in the
 * editor.
 */
export function TagPills({ tags, onRemove, className }: TagPillsProps) {
  const { t } = useTranslation();
  if (tags.length === 0) return null;

  return (
    <ul className={cn('flex flex-wrap items-center gap-1', className)}>
      {tags.map((tag) => (
        <li
          key={tag.id}
          style={noteColorStyle(tag.color)}
          className="flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs"
        >
          <span className="truncate">{tag.name}</span>
          {onRemove && (
            <button
              type="button"
              aria-label={t('tags.remove', { name: tag.name })}
              onClick={(e) => {
                // Cards are clickable as a whole; a pill action must not open them.
                e.stopPropagation();
                onRemove(tag);
              }}
              className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3" aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { noteColorAttrs } from '@/lib/note-colors.ts';
import { cn } from '@/lib/utils.ts';
import type { Tag } from '@/models.ts';

type TagPillsProps = {
  tags: Tag[];
  /** When given, each pill grows a remove button. Omit for a read-only row. */
  onRemove?: (tag: Tag) => void;
  /** Caps read-only card rows without hiding labels in the editor. */
  maxVisible?: number;
  className?: string;
};

/**
 * A note's labels as pills, tinted from the shared Note/Tag palette so a label
 * reads the same wherever it appears. Read-only on cards, removable in the
 * editor.
 */
export function TagPills({ tags, onRemove, maxVisible, className }: TagPillsProps) {
  const { t } = useTranslation();
  if (tags.length === 0) return null;

  const shown = maxVisible === undefined ? tags : tags.slice(0, Math.max(0, maxVisible));
  const hiddenCount = tags.length - shown.length;

  return (
    <ul className={cn('flex flex-wrap items-center gap-1', className)}>
      {shown.map((tag) => (
        <li
          key={tag.id}
          {...noteColorAttrs(tag.color)}
          /* The chip form from DESIGN.md: pill, uppercase label at the 11px
             floor, filled from the label's own identity with identity-derived
             text. `text-label` carries the tracking and weight with it.

             `min-w-0` is load-bearing: a flex item's default `min-width: auto`
             refuses to shrink below its content, so without it the `truncate`
             below never engages and one long label ("Personalfinanceand-
             budgeting2026") runs straight past the card's edge. */
          className="flex min-w-0 max-w-full items-center gap-1 rounded-full bg-note-chip px-2 py-0.5 text-label text-note-on-chip uppercase"
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
      {hiddenCount > 0 && (
        <li className="rounded-full bg-foreground/10 px-2 py-0.5 text-label text-muted-foreground">
          +{hiddenCount}
        </li>
      )}
    </ul>
  );
}

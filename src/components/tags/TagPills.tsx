import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OverflowCount } from '@/components/ui/OverflowCount.tsx';
import { labelCollator, sortLabels } from '@/lib/label-order.ts';
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

export function TagPills({ tags, onRemove, maxVisible, className }: TagPillsProps) {
  const { t, i18n } = useTranslation();
  if (tags.length === 0) return null;

  const ordered = sortLabels(tags, labelCollator(i18n.language));
  const shown = maxVisible === undefined ? ordered : ordered.slice(0, Math.max(0, maxVisible));
  const hiddenCount = ordered.length - shown.length;

  return (
    <ul className={cn('flex flex-wrap items-center gap-1', className)}>
      {shown.map((tag) => (
        <li
          key={tag.id}
          {...noteColorAttrs(tag.color)}
          /* `min-w-0` is load-bearing: without it the flex item will not shrink, `truncate`
             never engages, and one long label runs past the card's edge. */
          className="flex min-w-0 max-w-full items-center gap-1 rounded-full bg-note-chip py-1 pr-2 pl-2.5 text-label text-note-on-chip uppercase"
        >
          {/* Pulls back the tracking CSS adds after the last glyph, which looked lopsided. */}
          <span className="-me-[0.1em] truncate">{tag.name}</span>
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
        <li className="flex shrink-0">
          <OverflowCount count={hiddenCount} />
        </li>
      )}
    </ul>
  );
}

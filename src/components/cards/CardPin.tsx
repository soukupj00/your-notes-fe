import { Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { cn } from '@/lib/utils.ts';

interface CardPinProps {
  pinned: boolean;
  onToggle: () => void;
}

/**
 * Never hover-revealed, above the media, with its own backing (DESIGN.md, Pin-Is-Always-In-Front
 * Rule). Pinned is chrome, so it takes the accent: the note's own colour would vanish on a card
 * of that colour.
 */
export function CardPin({ pinned, onToggle }: CardPinProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <button
      type="button"
      data-slot="note-card-pin"
      aria-label={t(pinned ? 'notes.unpin' : 'notes.pin')}
      aria-pressed={pinned}
      // A click on the card opens the editor; pinning must not also open it.
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        'absolute top-2 right-2 z-30 flex size-9 items-center justify-center rounded-full border shadow-rest',
        // Invisible 44px hit box, since a 44px disc would hang into the note's first line.
        // -5px, not -4px: the pseudo-element sits in the padding box, so it must cover the border.
        'before:absolute pointer-coarse:before:-inset-[5px] before:content-[""]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        pinned
          ? 'border-transparent bg-primary text-primary-foreground'
          : 'border-note-border bg-note-surface text-muted-foreground hover:border-note-border-hover hover:text-foreground',
        // Material change as well as scale, so hover survives reduced motion (DESIGN.md, Buttons).
        'hover:shadow-lift',
        !reducedMotion &&
          'transition-[transform,color,background-color,border-color,box-shadow] hover:scale-[1.06]'
      )}
    >
      <Pin className={cn('size-4', pinned && 'fill-current')} aria-hidden />
    </button>
  );
}

import { Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { cn } from '@/lib/utils.ts';

interface CardPinProps {
  pinned: boolean;
  onToggle: () => void;
}

/**
 * The card's pin corner (DESIGN.md → *The Pin-Is-Always-In-Front Rule*).
 *
 * Two things make this control different from every other one on a card, and
 * both are requirements rather than styling choices:
 *
 * 1. It is never hover-revealed and never occluded. It is mounted as a child of
 *    the card rather than of the content layer, so it stacks above the media,
 *    any scrim and the foot rail in both layouts and both themes.
 * 2. It carries its own filled backing in the card's surface colour, because it
 *    can land on a white photo or a black video thumbnail. A pin that is legible
 *    only because the attachment behind it happens to be light is not backed,
 *    it is lucky.
 *
 * Pinned state reads as *chrome*, so it takes the accent - the same signal that
 * marks the active rail item and the FAB - never the note's identity colour,
 * which would make the state unreadable on a card of that same colour.
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
      // The card is a role="button" that opens the editor; pinning must not
      // also open it.
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        'absolute top-2 right-2 z-30 flex size-9 items-center justify-center rounded-full border shadow-rest',
        // The 44px touch floor is met with invisible padding rather than a
        // bigger disc (DESIGN.md → The 44px Touch Rule: "padding may be
        // invisible, but it must be there"). A 44px *disc* would hang down into
        // the first line of the note's own text on every card that has no
        // media, which is the one thing this corner may not do.
        // -5px, not -4px: the pseudo-element's containing block is the padding
        // box, so it has to cover the 1px border as well to reach a true 44px.
        'before:absolute pointer-coarse:before:-inset-[5px] before:content-[""]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        pinned
          ? // Filled with the accent, exactly like the active rail item: pinned
            // is the one card state a glance has to catch across a whole wall.
            'border-transparent bg-primary text-primary-foreground'
          : 'border-note-border bg-note-surface text-muted-foreground hover:border-note-border-hover hover:text-foreground',
        // Both a material change and a scale, so the affordance survives the
        // reduced-motion killswitch (DESIGN.md → Buttons).
        'hover:shadow-lift',
        !reducedMotion &&
          'transition-[transform,color,background-color,border-color,box-shadow] hover:scale-[1.06]'
      )}
    >
      <Pin className={cn('size-4', pinned && 'fill-current')} aria-hidden />
    </button>
  );
}

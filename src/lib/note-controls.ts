import type { ClassValue } from 'clsx';
import { cn } from '@/lib/utils.ts';

/**
 * The one icon-button recipe for a note's own controls, shared by the card's
 * foot rail (`CardActions`) and the editor's note bar (`NoteEditorBar`).
 *
 * It lives here rather than in either caller because the two surfaces have to
 * stay the same control: a touch fix or a focus change made on one and not the
 * other is exactly the drift this file exists to prevent.
 */
const NOTE_CONTROL_BUTTON =
  'touch-target flex size-9 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-rest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * A hover carries both a material change and a scale; the material is what
 * survives when the scale is switched off (DESIGN.md → Buttons), which is why
 * the reduced-motion branch removes only the transform half.
 */
export function noteControlButton(reducedMotion: boolean, className?: ClassValue) {
  return cn(
    NOTE_CONTROL_BUTTON,
    !reducedMotion && 'transition-[background-color,color,box-shadow,transform] hover:scale-[1.06]',
    className
  );
}

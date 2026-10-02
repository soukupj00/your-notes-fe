import type { ClassValue } from 'clsx';
import { cn } from '@/lib/utils.ts';

/** Shared by `CardActions` and `NoteEditorBar` so the two stay one control: a fix lands on both. */
const NOTE_CONTROL_BUTTON =
  'touch-target flex size-9 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-rest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Reduced motion drops only the hover's scale; its material change stays (DESIGN.md, Buttons). */
export function noteControlButton(reducedMotion: boolean, className?: ClassValue) {
  return cn(
    NOTE_CONTROL_BUTTON,
    !reducedMotion && 'transition-[background-color,color,box-shadow,transform] hover:scale-[1.06]',
    className
  );
}

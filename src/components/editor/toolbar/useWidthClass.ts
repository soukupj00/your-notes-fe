import { useIsMobile } from '@/hooks/use-mobile';
import { useFinePointer } from '@/hooks/useFinePointer';
import type { WidthClass } from './types';

/**
 * Which stored Layout is in effect: the app's single `sm` breakpoint, or a
 * coarse pointer.
 *
 * The width half is the *window*, not the device: a desktop window dragged
 * narrow gets the Compact Layout, because the constraint the Layout answers is
 * width, and a bar that overflowed rather than adapting would be the same bug
 * the `hideOnMobile` flag used to paper over.
 *
 * The pointer half is the exception ADR 0016 names. A phone held sideways is
 * 844px wide and would otherwise get the Wide Layout - wrapping, four rows deep
 * - on a screen 390px tall with the keyboard about to take half of it. Compact
 * was always specified in pointer units rather than width ones: its six slots
 * are 44px apiece because of DESIGN.md's Touch Rule, and its one-row rule exists
 * because it rides above a virtual keyboard. Both are facts about the pointer.
 *
 * `(pointer: fine)` means a mouse or trackpad is the primary pointer, so a
 * touchscreen laptop keeps the Wide Layout and only a touch-only device flips.
 * This hook is the sole consumer of the pointer signal, so nothing can
 * desynchronise from it - which is why the same change would be wrong in
 * `useIsMobile`, where the nav and the editor sheet both read it.
 */
export function useWidthClass(): WidthClass {
  const narrow = useIsMobile();
  const finePointer = useFinePointer();
  return narrow || !finePointer ? 'compact' : 'wide';
}

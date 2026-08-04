import { useIsMobile } from '@/hooks/use-mobile';
import type { WidthClass } from './types';

/**
 * Which stored Layout is in effect, from the app's single `sm` breakpoint.
 *
 * Deliberately the *window*, not the device: a desktop window dragged narrow
 * gets the Compact Layout, because the constraint the Layout answers is width,
 * and a bar that overflowed rather than adapting would be the same bug the
 * `hideOnMobile` flag used to paper over.
 */
export function useWidthClass(): WidthClass {
  return useIsMobile() ? 'compact' : 'wide';
}

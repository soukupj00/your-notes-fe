import { useIsMobile } from '@/hooks/use-mobile';
import { useFinePointer } from '@/hooks/useFinePointer';
import type { WidthClass } from './types';

/**
 * Compact for a narrow window or a coarse pointer, so a sideways phone keeps it. Why the
 * pointer belongs here and not in `useIsMobile`: ADR 0016.
 */
export function useWidthClass(): WidthClass {
  const narrow = useIsMobile();
  const finePointer = useFinePointer();
  return narrow || !finePointer ? 'compact' : 'wide';
}

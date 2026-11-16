import { useMediaQuery } from '@/hooks/useMediaQuery.ts';

/**
 * Whether the primary pointer is a mouse or trackpad, which decides affordances; never a width
 * (ADR 0016). Unmeasurable reads as `false`, hiding a hint rather than showing an unusable one.
 */
export function useFinePointer(): boolean {
  return useMediaQuery('(pointer: fine)');
}

/** Any mouse or trackpad, even beside a touchscreen: an iPad with a trackpad case (ADR 0028). */
export function useAnyFinePointer(): boolean {
  return useMediaQuery('(any-pointer: fine)');
}

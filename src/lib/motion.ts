import type { Transition } from 'motion/react';

/** Nightshift's one movement contract: overdamped, calm and without overshoot. */
export const NIGHTSHIFT_SPRING = {
  type: 'spring',
  stiffness: 180,
  damping: 34,
  mass: 0.9,
} satisfies Transition;

const INSTANT_TRANSITION = { duration: 0 } satisfies Transition;

export const PRESENCE_TRANSITION = {
  duration: 0.16,
  ease: [0.4, 0, 0.2, 1],
} satisfies Transition;

/**
 * Reduced motion means "arrive instantly", not "do not animate": a zero-duration transition still
 * lands the element in place. One function so no surface honours the preference by halves.
 */
export function resolveTransition(reducedMotion: boolean, base: Transition = NIGHTSHIFT_SPRING) {
  return reducedMotion ? INSTANT_TRANSITION : base;
}

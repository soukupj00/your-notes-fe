import type { Transition } from 'motion/react';

/** Nightshift's one movement contract: overdamped, calm and without overshoot. */
export const NIGHTSHIFT_SPRING = {
  type: 'spring',
  stiffness: 180,
  damping: 34,
  mass: 0.9,
} satisfies Transition;

export const INSTANT_TRANSITION = { duration: 0 } satisfies Transition;

export const PRESENCE_TRANSITION = {
  duration: 0.16,
  ease: [0.4, 0, 0.2, 1],
} satisfies Transition;

/**
 * The transition to actually hand a `motion` component, given the user's
 * reduced-motion preference.
 *
 * Every animated surface owes the preference the same answer, and the answer is
 * "arrive instantly", not "do not animate" - dropping the transition entirely
 * would leave the element wherever it was, while a zero-duration one still
 * lands it in the right place. One function so a new animated surface cannot
 * honour the preference by halves.
 */
export function resolveTransition(reducedMotion: boolean, base: Transition = NIGHTSHIFT_SPRING) {
  return reducedMotion ? INSTANT_TRANSITION : base;
}

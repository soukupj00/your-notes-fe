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

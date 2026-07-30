import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';

/**
 * Makes the app preference authoritative for Motion as well as CSS.
 *
 * Individual presence animations still use an explicit zero-duration
 * transition because Motion's reduced-motion policy deliberately preserves
 * opacity. Transform and layout animation are guarded here at the root so a
 * future caller cannot accidentally bypass the preference.
 */
const loadMotionFeatures = () =>
  import('@/lib/motion-features.ts').then((module) => module.default);

export function AppMotionProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
      <LazyMotion features={loadMotionFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}

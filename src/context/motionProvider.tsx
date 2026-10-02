import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';

const loadMotionFeatures = () =>
  import('@/lib/motion-features.ts').then((module) => module.default);

/**
 * Makes the reduced-motion preference authoritative for Motion, guarding transform and layout at
 * the root. Presence animations still need an explicit zero duration: Motion keeps opacity.
 */
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

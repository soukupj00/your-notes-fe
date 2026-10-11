import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTourActive } from '@/context/TourProvider.tsx';

/**
 * Only what needs no browser: jsdom measures everything as 0x0, so the Tour itself is tested in
 * `e2e/onboarding.spec.ts`. Left here: `useTourActive` without a provider.
 */

function Probe() {
  return <span data-testid="active">{String(useTourActive())}</span>;
}

describe('useTourActive', () => {
  it('answers false where there is no provider at all', () => {
    // `searchInput` asks on every render and is mounted on its own in half a
    // dozen tests: "no provider" and "no Tour" mean the same thing to a caller
    // that only wants to know whether to stand down.
    render(<Probe />);

    expect(screen.getByTestId('active')).toHaveTextContent('false');
  });
});

/**
 * Polls a DOM condition once per animation frame, never a fixed delay (CLAUDE.md "The Tour").
 * A frame is the right step because what is awaited is usually a rect, true only after layout.
 */

/**
 * Generous because giving up early cuts a spotlight over nothing, while waiting long is only a
 * pause. Nothing retries, so the budget is only ever spent on a real bug.
 */
export const TOUR_WAIT_MS = 3000;

/**
 * Resolves `null` rather than rejecting when the budget runs out, so a step without its target
 * still shows its copy. A spent budget is always a bug: it warns in DEV, and
 * `e2e/onboarding.spec.ts` fails on that warning.
 */
export function waitFor<T>(
  condition: () => T | null | undefined | false,
  { timeout = TOUR_WAIT_MS, label = 'a DOM condition' }: { timeout?: number; label?: string } = {}
): Promise<T | null> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout;

    const check = () => {
      const value = condition();
      if (value) {
        resolve(value);
        return;
      }
      // Checked after the condition, so a zero timeout still gets one look. The
      // common case is that the thing being waited for is already there.
      if (Date.now() >= deadline) {
        if (import.meta.env.DEV) console.warn(`[tour] timed out waiting for ${label}`);
        resolve(null);
        return;
      }
      requestAnimationFrame(check);
    };

    check();
  });
}

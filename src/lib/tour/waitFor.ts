/**
 * Await a condition against the DOM, never a delay.
 *
 * Every act the Tour performs is asynchronous in a way it cannot predict: a
 * navigation resolves before the route has painted, a pin has to travel through
 * Dexie and a live query before the wall re-packs, and the editor is a lazy
 * chunk that may still be downloading. The step after it needs an element, so
 * something has to wait.
 *
 * That something may not be a timer. Reduced motion is a hard killswitch in this
 * app (DESIGN.md), so every transition is zero-duration for some users and its
 * full length for the rest: a fixed wait is therefore wrong in both directions
 * at once, dead time for one user and too short for the other. It is also wrong
 * on both a fast desktop and a cold phone, for the same reason.
 *
 * So: poll the condition per animation frame until it holds or the budget runs
 * out. A frame is the right granularity because what is being waited on is
 * almost always a *rect* - `resolveTourTarget` asks whether an element measures
 * anything - and a rect is only true after the browser has laid out, which is
 * exactly what a frame boundary marks.
 */

/**
 * How long an act waits before giving up.
 *
 * Generous, because the cost of the two outcomes is not symmetric: waiting an
 * extra second for a slow phone to paint the editor is a pause, and giving up
 * early is a spotlight cut over nothing. Nothing here retries, so this budget is
 * only ever spent when something is genuinely wrong.
 */
export const TOUR_WAIT_MS = 3000;

/**
 * Resolves with the condition's value as soon as it is truthy, or `null` when
 * the budget runs out.
 *
 * `null` is a returned value rather than a rejection: a step that cannot find
 * its target still has copy worth reading, and the Tour showing it centred with
 * no spotlight beats the Tour dying halfway through with a stack trace.
 */
export function waitFor<T>(
  condition: () => T | null | undefined | false,
  timeout = TOUR_WAIT_MS
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
        resolve(null);
        return;
      }
      requestAnimationFrame(check);
    };

    check();
  });
}

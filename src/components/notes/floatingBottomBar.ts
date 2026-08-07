/**
 * Where a floating control sits above the bottom edge of a phone screen.
 *
 * One constant because two things land in that corner - the quick-capture `＋`
 * and a view's own action pill (Empty trash) - and they are never allowed to sit
 * at different heights, even though no route currently shows both at once.
 *
 * The numbers are the reason this is not just `bottom-0`:
 *
 * - **24px above the safe-area inset**, not 12. The inset covers the strip the
 *   phone itself owns - Android's gesture handle, iOS Safari's toolbar, and the
 *   swipe-up-from-bottom area both platforms reserve. A primary control 12px off
 *   the edge is inside that strip: the thumb has to aim past the system's own
 *   target to reach it. 24px puts it clear.
 *
 *   That inset was 0 everywhere until `viewport-fit=cover` landed, so this
 *   computed a flat 24px and never actually cleared anything. `--safe-bottom`
 *   is the shared name for it (`globals.css`); an overridable variable is also
 *   the only way to see the non-zero case without a phone.
 * - **16px from the side**, matching the feed's own `px-4` gutter, so the button
 *   lines up with the cards it floats over instead of sitting 4px proud of them.
 *   The horizontal insets ride on top of that gutter for landscape.
 */
export const FLOATING_BOTTOM_BAR =
  'fixed inset-x-0 bottom-0 z-40 flex pr-[calc(1rem+var(--safe-right))] pb-[calc(var(--safe-bottom)+1.5rem)] pl-[calc(1rem+var(--safe-left))]';

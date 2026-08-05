/**
 * Where a floating control sits above the bottom edge of a phone screen.
 *
 * One constant because two things land in that corner - the quick-capture `＋`
 * and a view's own action pill (Empty trash) - and they are never allowed to sit
 * at different heights, even though no route currently shows both at once.
 *
 * The numbers are the reason this is not just `bottom-0`:
 *
 * - **24px above the safe-area inset**, not 12. `env(safe-area-inset-bottom)`
 *   resolves to 0 in an ordinary browser tab, so it does nothing about the strip
 *   the phone itself owns - Android's gesture handle, iOS Safari's toolbar, and
 *   the swipe-up-from-bottom area both platforms reserve. A primary control 12px
 *   off the edge is inside that strip: the thumb has to aim past the system's
 *   own target to reach it. 24px puts it clear.
 * - **16px from the side**, matching the feed's own `px-4` gutter, so the button
 *   lines up with the cards it floats over instead of sitting 4px proud of them.
 */
export const FLOATING_BOTTOM_BAR =
  'fixed inset-x-0 bottom-0 z-40 flex px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]';

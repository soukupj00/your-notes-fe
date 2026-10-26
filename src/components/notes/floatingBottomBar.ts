// Shared by the quick-capture `＋` and a view's action pill so they sit at one height (CLAUDE.md,
// Nav shell), 24px above the safe-area inset, clear of the system gesture strip. The strip spans
// the whole edge, so only its children take the pointer, or the cards under it go dead.
export const FLOATING_BOTTOM_BAR =
  'pointer-events-none fixed inset-x-0 bottom-0 z-40 flex *:pointer-events-auto pr-[calc(1rem+var(--safe-right))] pb-[calc(var(--safe-bottom)+1.5rem)] pl-[calc(1rem+var(--safe-left))]';

/** Added by a view under a floating bar, so its last row scrolls clear of the bar on a phone. */
export const FLOATING_BOTTOM_BAR_CLEARANCE = 'pb-18 sm:pb-0';

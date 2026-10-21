// Shared by the quick-capture `＋` and a view's action pill so they never sit at different
// heights (CLAUDE.md, Nav shell). 24px above the safe-area inset, not 12, which would still
// be inside the system's own gesture strip. The strip spans the whole edge, so only its children
// take the pointer, or the cards under it go dead (feedback B1).
export const FLOATING_BOTTOM_BAR =
  'pointer-events-none fixed inset-x-0 bottom-0 z-40 flex *:pointer-events-auto pr-[calc(1rem+var(--safe-right))] pb-[calc(var(--safe-bottom)+1.5rem)] pl-[calc(1rem+var(--safe-left))]';

/**
 * Take the whole app out of reach for as long as something else is driving it.
 *
 * The Tour is a demonstration: the user presses Next, Back or Skip and nothing
 * else (ADR 0015). `inert` is what makes that true rather than merely intended,
 * and one attribute does three jobs at once - Tab cycles inside the popover with
 * no focus-trap library, the dimmed app is unreachable by keyboard as well as by
 * pointer, and an autofocusing editor cannot raise a phone's software keyboard.
 *
 * ## Why every child of `body`, and not the app root
 *
 * Radix portals to `body`, so marking `#root` alone would leave the editor
 * dialog, the speed dial's popover and every toast fully live above the scrim.
 * The marking is therefore a standing rule with a `MutationObserver` behind it,
 * not a single sweep: most of what has to be marked does not exist yet when the
 * Tour starts.
 *
 * ## What it does not do
 *
 * `inert` disables hit testing, not dispatch: a programmatic `.click()` still
 * runs its React handler inside an inert subtree, which is exactly how the Tour
 * opens the speed dial (verified in Chromium at both breakpoints, along with
 * Radix's open-focus attempt failing silently rather than looping).
 */

/**
 * Marks every direct child of `document.body` inert except those the caller
 * exempts, and keeps doing so as new ones arrive. Returns the undo.
 *
 * `exempt` rather than a hard-coded rule because what stays live is the
 * spotlight library's business, and nothing in here should have to know which
 * library that is.
 */
export function holdBodyInert(exempt: (node: Element) => boolean): () => void {
  const marked = new Set<Element>();

  const mark = (node: Element) => {
    // An element that was already inert stays somebody else's business: we must
    // not hand back interactivity the app had deliberately taken away.
    if (exempt(node) || node.hasAttribute('inert')) return;
    node.setAttribute('inert', '');
    marked.add(node);
  };

  for (const child of Array.from(document.body.children)) mark(child);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node instanceof Element) mark(node);
    }
  });
  observer.observe(document.body, { childList: true });

  return () => {
    observer.disconnect();
    for (const node of marked) node.removeAttribute('inert');
  };
}

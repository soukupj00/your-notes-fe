/**
 * Every child of `body` goes inert, not just `#root`, because Radix portals there (ADR 0015); the
 * observer catches what mounts later.
 */

/** Returns the undo. `exempt` keeps the spotlight library's own nodes live without naming it. */
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

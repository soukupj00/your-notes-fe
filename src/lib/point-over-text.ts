/**
 * Whether a viewport point lies over the glyphs of the text inside `container`,
 * as opposed to the empty part of the same block after the line ends.
 *
 * Per text node, not per element: a block's box spans the full width, so
 * asking the `<p>` would say yes everywhere on the line. A Range over a text
 * node reports one rect per line box the text actually occupies.
 */
export function pointOverText(container: Element, x: number, y: number): boolean {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true;
    }
  }
  return false;
}

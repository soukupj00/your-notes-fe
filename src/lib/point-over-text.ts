/**
 * Over the glyphs, not the empty run after a line ends. Asked per text node, because a block's box
 * spans the full width while a Range reports one rect per line box the text occupies.
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

import { vi } from 'vitest';

const CARD_HEIGHT = 120;

/**
 * jsdom has no layout, so the feed never measures and its Cards stay hidden. Sizes the feed and
 * its Cards only, so `useNoteFeedLayout` places them; call the returned restore afterwards.
 */
export function stubFeedLayout(): () => void {
  const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.matches('ul[data-layout]') ? window.innerWidth : 0;
  });
  const height = vi
    .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-note-feed-id') ? CARD_HEIGHT : 0;
    });
  return () => {
    width.mockRestore();
    height.mockRestore();
  };
}

/**
 * The navbar's ref: publishes its height as `--nav-height`, which the root's `scroll-padding-top`
 * reads. Measured, because the height changes with the route, the width and a search row.
 */
export function publishNavHeight(header: HTMLElement) {
  const root = document.documentElement.style;
  const observer = new ResizeObserver(() => {
    root.setProperty('--nav-height', `${header.getBoundingClientRect().height}px`);
  });
  observer.observe(header, { box: 'border-box' });
  return () => {
    observer.disconnect();
    root.removeProperty('--nav-height');
  };
}

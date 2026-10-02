export interface LongPressOptions {
  /** Which element under the pointer counts. Receives the event target. */
  isTarget: (target: Element) => boolean;
  onLongPress: (target: Element) => void;
  delayMs?: number;
}

const DEFAULT_DELAY_MS = 500;
/** Movement past this is a scroll, not a hold. */
const SLOP_PX = 10;

/**
 * Delegated from a container because the rows are `innerHTML` with no React elements. Mouse is
 * ignored, as holding a mouse is how text is selected. After a press, the next click and
 * contextmenu are swallowed so the row is not ticked and Android's menu does not open.
 */
export function attachLongPress(el: HTMLElement, opts: LongPressOptions): () => void {
  const delay = opts.delayMs ?? DEFAULT_DELAY_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let origin: { x: number; y: number } | null = null;
  let fired = false;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    origin = null;
  };

  const onDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return;
    const target = event.target as Element | null;
    if (!target || !opts.isTarget(target)) return;
    cancel();
    fired = false;
    origin = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      timer = null;
      origin = null;
      fired = true;
      opts.onLongPress(target);
    }, delay);
  };

  const onMove = (event: PointerEvent) => {
    if (!origin) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > SLOP_PX) cancel();
  };

  const swallow = (event: Event) => {
    if (!fired) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'click') fired = false;
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
  // Capture phase: the contextmenu has to be stopped before the browser's own
  // menu, and the click before the delegate that would tick the row.
  el.addEventListener('contextmenu', swallow, true);
  el.addEventListener('click', swallow, true);

  return () => {
    cancel();
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', cancel);
    el.removeEventListener('pointercancel', cancel);
    el.removeEventListener('pointerleave', cancel);
    el.removeEventListener('contextmenu', swallow, true);
    el.removeEventListener('click', swallow, true);
  };
}

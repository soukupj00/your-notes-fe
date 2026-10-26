import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * How many Starts the bar shows inline: all that fit in `available` px, or one fewer to leave a
 * slot for the ⋯ that holds the rest.
 */
export function startsThatFit(available: number, slot: number, gap: number, total: number) {
  const slots = Math.max(0, Math.floor((available + gap) / (slot + gap)));
  return slots >= total ? total : Math.max(0, slots - 1);
}

const px = (value: string) => Number.parseFloat(value) || 0;

/**
 * The capture bar keeps its whole prompt and gives the Starts what is left. Measured before paint,
 * and again on every resize, so the row never shows a count it is about to change.
 */
export function useStartsThatFit(total: number, promptKey: unknown) {
  const barRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLButtonElement>(null);
  const promptTextRef = useRef<HTMLSpanElement>(null);
  const shortcutRef = useRef<HTMLElement>(null);
  const startsRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(total);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `promptKey` is the re-measure trigger
  useLayoutEffect(() => {
    const measure = () => {
      const slot = startsRef.current?.querySelector('button');
      // Hidden below `sm:`, or unmeasured (jsdom): every Start stays inline.
      if (!barRef.current?.clientWidth || !promptRef.current || !promptTextRef.current || !slot) {
        setFit(total);
        return;
      }
      const barStyle = getComputedStyle(barRef.current);
      const promptStyle = getComputedStyle(promptRef.current);
      const hint = shortcutRef.current?.offsetWidth ?? 0;
      const promptWidth =
        promptTextRef.current.offsetWidth +
        px(promptStyle.paddingLeft) +
        px(promptStyle.paddingRight) +
        (hint && hint + px(promptStyle.columnGap));
      const gap = px(barStyle.columnGap);
      const available = barRef.current.clientWidth - px(barStyle.paddingRight) - promptWidth - gap;
      setFit(startsThatFit(available, slot.offsetWidth, gap, total));
    };

    measure();
    if (typeof ResizeObserver !== 'function' || !barRef.current || !promptTextRef.current) return;
    const observer = new ResizeObserver(() => flushSync(measure));
    observer.observe(barRef.current);
    observer.observe(promptTextRef.current);
    return () => observer.disconnect();
  }, [total, promptKey]);

  return { fit: Math.min(fit, total), barRef, promptRef, promptTextRef, shortcutRef, startsRef };
}

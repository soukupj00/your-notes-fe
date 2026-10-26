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

/**
 * The rotating prompt is decoration, so it rotates only while its longest copy leaves room for
 * every Start; otherwise the resting prompt stays and the Starts fit against it.
 */
export function planCaptureBar(
  room: number,
  prompts: { resting: number; longest: number },
  slot: number,
  gap: number,
  total: number
) {
  if (startsThatFit(room - prompts.longest, slot, gap, total) === total) {
    return { rotate: true, fit: total };
  }
  return { rotate: false, fit: startsThatFit(room - prompts.resting, slot, gap, total) };
}

const px = (value: string) => Number.parseFloat(value) || 0;

/**
 * Measured before paint, and again on every resize, so the row never shows a count it is about to
 * change. The prompts are measured in a copy that takes no space, so the plan cannot feed back
 * into what it measures.
 */
export function useStartsThatFit(total: number, remeasureKey: unknown) {
  const barRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLButtonElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const shortcutRef = useRef<HTMLElement>(null);
  const startsRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState({ rotate: true, fit: total });

  // biome-ignore lint/correctness/useExhaustiveDependencies: `remeasureKey` is the trigger
  useLayoutEffect(() => {
    const measure = () => {
      const bar = barRef.current;
      const prompt = promptRef.current;
      const copies = Array.from(measureRef.current?.children ?? [], (copy) =>
        copy instanceof HTMLElement ? copy.offsetWidth : 0
      );
      const slot = startsRef.current?.querySelector('button');
      // Hidden below `sm:`, or unmeasured (jsdom): every Start inline, the prompt free to turn.
      if (!bar?.clientWidth || !prompt || !copies.length || !slot) {
        setPlan({ rotate: true, fit: total });
        return;
      }
      const barStyle = getComputedStyle(bar);
      const promptStyle = getComputedStyle(prompt);
      const hint = shortcutRef.current?.offsetWidth ?? 0;
      const gap = px(barStyle.columnGap);
      const room =
        bar.clientWidth -
        px(barStyle.paddingRight) -
        gap -
        px(promptStyle.paddingLeft) -
        px(promptStyle.paddingRight) -
        (hint && hint + px(promptStyle.columnGap));
      const prompts = { resting: copies[0], longest: Math.max(...copies) };
      setPlan(planCaptureBar(room, prompts, slot.offsetWidth, gap, total));
    };

    measure();
    if (typeof ResizeObserver !== 'function' || !barRef.current || !measureRef.current) return;
    const observer = new ResizeObserver(() => flushSync(measure));
    observer.observe(barRef.current);
    observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [total, remeasureKey]);

  return {
    rotate: plan.rotate,
    fit: Math.min(plan.fit, total),
    barRef,
    promptRef,
    measureRef,
    shortcutRef,
    startsRef,
  };
}

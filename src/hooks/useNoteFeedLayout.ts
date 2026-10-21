import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  calculateNoteFeedLayout,
  type NoteFeedLayout,
  type NoteFeedLayoutMode,
} from '@/lib/note-feed-layout.ts';

const EMPTY_LAYOUT: NoteFeedLayout = {
  placements: {},
  height: 0,
  itemWidth: 0,
  columns: 1,
};

const PIXEL_TOLERANCE = 0.5;

type LayoutInput = {
  mode: NoteFeedLayoutMode;
  ids: readonly string[];
  minColumnRem: number;
};

function layoutsMatch(
  left: NoteFeedLayout,
  right: NoteFeedLayout,
  ids: readonly string[]
): boolean {
  if (
    Math.abs(left.height - right.height) > PIXEL_TOLERANCE ||
    Math.abs(left.itemWidth - right.itemWidth) > PIXEL_TOLERANCE ||
    left.columns !== right.columns
  ) {
    return false;
  }

  return ids.every((id) => {
    const a = left.placements[id];
    const b = right.placements[id];
    return (
      a !== undefined &&
      b !== undefined &&
      Math.abs(a.x - b.x) <= PIXEL_TOLERANCE &&
      Math.abs(a.y - b.y) <= PIXEL_TOLERANCE &&
      Math.abs(a.width - b.width) <= PIXEL_TOLERANCE
    );
  });
}

/**
 * Measures note cards and resolves both Masonry and Stack through one placement
 * path. Child registration is attribute-based so the observer and ref callback
 * remain stable when notes reorder.
 */
export function useNoteFeedLayout(
  mode: NoteFeedLayoutMode,
  ids: readonly string[],
  minColumnRem = 13.5
) {
  const supported = typeof ResizeObserver !== 'undefined';
  const containerNode = useRef<HTMLUListElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const observedItems = useRef(new Set<HTMLElement>());
  const animationFrame = useRef<number | null>(null);
  const input = useRef<LayoutInput>({ mode, ids, minColumnRem });
  const layoutSnapshot = useRef(EMPTY_LAYOUT);
  const [layout, setLayout] = useState(EMPTY_LAYOUT);
  const [ready, setReady] = useState(false);

  const syncObservedItems = useCallback(() => {
    const container = containerNode.current;
    const instance = observer.current;
    if (!container || !instance) return;

    const current = new Set(
      Array.from(container.querySelectorAll<HTMLElement>('[data-note-feed-id]'))
    );

    for (const node of observedItems.current) {
      if (!current.has(node)) instance.unobserve(node);
    }
    for (const node of current) {
      if (!observedItems.current.has(node)) instance.observe(node);
    }
    observedItems.current = current;
  }, []);

  const measure = useCallback(() => {
    const container = containerNode.current;
    if (!container) return;

    const { mode: currentMode, ids: currentIds, minColumnRem } = input.current;
    const width = container.clientWidth;
    if (width <= 0) return;

    const gap = Number.parseFloat(getComputedStyle(container).rowGap) || 13.6;
    // DESIGN.md's breakpoint is container-driven: a narrow app panel gets the
    // same 10rem columns as a narrow viewport, regardless of window size. In rem, so
    // columns widen with the root font on a large screen.
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const effectiveMinimum = width < 46 * rem ? 10 * rem : minColumnRem * rem;
    const dimensions = calculateNoteFeedLayout({
      mode: currentMode,
      containerWidth: width,
      gap,
      minColumnWidth: effectiveMinimum,
      items: [],
    });

    // Width determines card height. Commit the destination width first, then
    // the next layout effect reads each card once at that width and packs it.
    if (Math.abs(layoutSnapshot.current.itemWidth - dimensions.itemWidth) > PIXEL_TOLERANCE) {
      const widthOnly = {
        ...layoutSnapshot.current,
        itemWidth: dimensions.itemWidth,
        columns: dimensions.columns,
      };
      layoutSnapshot.current = widthOnly;
      setLayout(widthOnly);
      return;
    }

    const nodes = new Map<string, HTMLElement>();
    for (const node of container.querySelectorAll<HTMLElement>('[data-note-feed-id]')) {
      const id = node.dataset.noteFeedId;
      if (id) nodes.set(id, node);
    }
    if (currentIds.some((id) => !nodes.has(id))) return;

    const next = calculateNoteFeedLayout({
      mode: currentMode,
      containerWidth: width,
      gap,
      minColumnWidth: effectiveMinimum,
      items: currentIds.map((id) => ({ id, height: nodes.get(id)?.offsetHeight ?? 0 })),
    });

    if (!layoutsMatch(layoutSnapshot.current, next, currentIds)) {
      layoutSnapshot.current = next;
      setLayout(next);
    }
    setReady(true);
  }, []);

  const scheduleMeasure = useCallback(() => {
    if (animationFrame.current !== null) return;
    animationFrame.current = requestAnimationFrame(() => {
      animationFrame.current = null;
      syncObservedItems();
      measure();
    });
  }, [measure, syncObservedItems]);

  const containerRef = useCallback((node: HTMLUListElement | null) => {
    containerNode.current = node;
  }, []);

  useLayoutEffect(() => {
    layoutSnapshot.current = layout;
  }, [layout]);

  useLayoutEffect(() => {
    input.current = { mode, ids, minColumnRem };
    syncObservedItems();
    measure();
  }, [ids, measure, minColumnRem, mode, syncObservedItems]);

  // A destination width has to land before its resulting card heights can be
  // read. This second layout pass still completes before paint.
  useLayoutEffect(() => {
    if (layout.itemWidth > 0) measure();
  }, [layout.itemWidth, measure]);

  useEffect(() => {
    const container = containerNode.current;
    if (!supported || !container) return;

    const instance = new ResizeObserver(scheduleMeasure);
    observer.current = instance;
    instance.observe(container);
    syncObservedItems();

    return () => {
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
      instance.disconnect();
      observer.current = null;
      observedItems.current.clear();
    };
  }, [scheduleMeasure, supported, syncObservedItems]);

  return { containerRef, layout, ready, supported };
}

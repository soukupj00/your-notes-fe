import type { Editor } from '@tiptap/react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from '@/components/editor/extensions/button-types';
import { cn } from '@/lib/utils.ts';
import { canRenderItem } from './registry';
import { resolveLayout } from './resolveLayout';
import { ToolbarFamilyMenu } from './ToolbarFamilyMenu';
import { ToolbarLeaf } from './ToolbarLeaf';
import type { ToolbarLayout, WidthClass } from './types';
import { useWidthClass } from './useWidthClass';

interface EditorToolbarProps {
  editor: Editor;
  /**
   * The user's stored Layouts, one per Width Class. Omitted or empty means never
   * customised, and that width renders its built-in default.
   */
  layouts?: Partial<Record<WidthClass, ToolbarLayout>>;
  /**
   * On mobile, pin the bar to the bottom of the scroll container so it rides
   * above the virtual keyboard.
   */
  stickyOnMobile?: boolean;
  className?: string;
}

/** Which ends of the scrolling row have content hidden past them. */
interface Overflow {
  start: boolean;
  end: boolean;
}

const NO_OVERFLOW: Overflow = { start: false, end: false };

/**
 * Fade only the edge that is actually hiding something.
 *
 * A permanent fade would dim the first and last button on a bar that fits, which
 * is a lie about there being more; and once scrolled to the end, a fade there
 * would suggest content that does not exist.
 */
function useEdgeFade(active: boolean): [React.RefObject<HTMLDivElement | null>, Overflow] {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<Overflow>(NO_OVERFLOW);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setOverflow({ start: node.scrollLeft > 1, end: max > 1 && node.scrollLeft < max - 1 });
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    measure();
    node.addEventListener('scroll', measure, { passive: true });
    // The bar's own contents change (a family collapses, a Layout is stamped),
    // so watching the window alone would leave a stale fade.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [active, measure]);

  // Derived, not reset in the effect: a wide bar has no fade regardless of what
  // the last compact measurement said, and clearing it in the effect would be a
  // cascading render for a value we can simply not use.
  return [ref, active ? overflow : NO_OVERFLOW];
}

/** A gradient mask over whichever ends are hiding buttons, and none otherwise. */
function edgeFadeStyle({ start, end }: Overflow): React.CSSProperties | undefined {
  if (!start && !end) return undefined;
  const stops = [
    start ? 'transparent 0, black 1.5rem' : 'black 0',
    end ? 'black calc(100% - 1.5rem), transparent 100%' : 'black 100%',
  ].join(', ');
  const mask = `linear-gradient(to right, ${stops})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

/**
 * The editor toolbar, rendered from the user's resolved Layout (ADR 0011).
 *
 * There are no hardcoded sections and no `hideOnMobile`: which buttons a given
 * width shows is stored data, resolved against the registry, and the two Width
 * Classes are two separate Layouts rather than one list that hides things.
 *
 * Compact is one non-wrapping row that scrolls horizontally. Stealing vertical
 * space from the note is the one thing a bar sitting above the keyboard may not
 * do, so it may not wrap.
 */
export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  layouts,
  stickyOnMobile,
  className,
}) => {
  const { t } = useTranslation();
  const widthClass = useWidthClass();
  // Drop what this editor cannot actually draw before anything downstream cares
  // about position. `resolveLayout` is pure and knows nothing about which
  // extensions are mounted, so without this an unmounted family renders as an
  // empty box - and, worse, could be the one that gets pinned.
  const families = resolveLayout(layouts?.[widthClass], widthClass)
    .map((entry) => ({
      ...entry,
      items: entry.items.filter((item) => canRenderItem(item, { editor, t: t as TFunction })),
    }))
    .filter((entry) => entry.items.length > 0);
  const compact = widthClass === 'compact';
  const [scrollRef, overflow] = useEdgeFade(compact);
  // Whether the row is genuinely wider than the box holding it, which is the one
  // condition the pin exists for.
  const scrolls = overflow.start || overflow.end;
  // The pinned family sits at the left edge, so fading that edge would fade the
  // one thing that is meant to stay legible.
  const fade = compact && families.length > 0 ? { ...overflow, start: false } : overflow;

  return (
    <div
      ref={scrollRef}
      data-testid="editor-toolbar"
      data-width-class={widthClass}
      data-overflow-start={fade.start || undefined}
      data-overflow-end={fade.end || undefined}
      style={compact ? edgeFadeStyle(fade) : undefined}
      className={cn(
        'flex items-center gap-1',
        compact
          ? // The scrollbar itself would eat a row of its own under the buttons,
            // and a shrinking button is not a button.
            //
            // `justify-between` spreads a bar that fits across the width it has,
            // instead of bunching it at the left edge with dead space beside it.
            // It needs no "does it fit?" test, because it *is* one: distributing
            // free space is a no-op when there is none, so an overflowing bar
            // packs and scrolls exactly as before.
            'justify-between overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_button]:shrink-0'
          : 'flex-wrap',
        // The sticky bar needs an opaque background to cover the text scrolling
        // under it, and it takes the note's own surface rather than the app
        // background - the editor sits inside a note-tinted dialog, where a
        // neutral band would read as a foreign element.
        stickyOnMobile &&
          'sticky bottom-0 z-10 order-last bg-note-surface py-2 sm:static sm:order-none sm:py-0',
        className
      )}
    >
      {families.map(({ family, items, collapsed }, index) => {
        // The first family stays put while the rest scrolls under it, so the
        // control you reach for *after* something went wrong is never off-screen.
        // Which family that is stays the user's choice - it is whatever they put
        // first - so this needs no setting and no new vocabulary. History is
        // first in both defaults, which is what makes undo always reachable on a
        // phone, where there is no Ctrl+Z at all.
        //
        // Only while the row actually scrolls, because pinning costs a wrapper:
        // a sticky family is one flex item instead of several, which `justify-
        // between` would then spread *around* rather than *within*, hugging its
        // buttons together while everything else fanned out. A bar that fits has
        // nothing to scroll under the pin anyway, so it gives up nothing.
        //
        // This cannot oscillate: unpinning only ever makes the row narrower, so
        // a row that fits unpinned stays unpinned, and one that overflows
        // unpinned still overflows once the wrapper is added.
        const pinned = compact && scrolls && index === 0;
        const content = collapsed ? (
          <ToolbarFamilyMenu family={family} items={items} editor={editor} t={t as TFunction} />
        ) : (
          items.map((item) => (
            <ToolbarLeaf key={item.id} item={item} editor={editor} t={t as TFunction} />
          ))
        );

        return (
          // A family is a group, not a wrapper with its own layout: `contents`
          // keeps its buttons as direct children of the bar's flex row, so
          // scrolling and gaps behave as if the grouping were not there. The
          // pinned one is the exception - sticking needs a box to stick.
          <div
            key={family.id}
            data-pinned={pinned || undefined}
            className={
              pinned
                ? // An opaque backing, or the scrolled buttons show through it.
                  // `bg-note-surface` falls back to `--background`, so it is
                  // right both inside a tinted note dialog and outside one.
                  //
                  // Same `gap-1` as the bar and no extra padding, so wrapping
                  // the family costs exactly zero width. That is what keeps
                  // `scrolls` a pure question about the buttons: with a `pr-1`
                  // here, a bar that fit unpinned could overflow *because* it
                  // pinned, and would then never unpin again - measured as a
                  // real latch at 341px, where 292px of buttons fit in 293px
                  // until the 4px of padding pushed them to 296px.
                  'sticky left-0 z-10 flex shrink-0 items-center gap-1 bg-note-surface'
                : 'contents'
            }
          >
            {content}
          </div>
        );
      })}
    </div>
  );
};

export default EditorToolbar;

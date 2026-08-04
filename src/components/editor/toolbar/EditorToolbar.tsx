import type { Editor } from '@tiptap/react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from '@/components/editor/extensions/button-types';
import { cn } from '@/lib/utils.ts';
import { resolveLayout } from './resolveLayout';
import { ToolbarFamilyMenu } from './ToolbarFamilyMenu';
import { ToolbarLeaf } from './ToolbarLeaf';
import type { ToolbarLayout } from './types';
import { useWidthClass } from './useWidthClass';

interface EditorToolbarProps {
  editor: Editor;
  /** The user's stored Layout for the current Width Class; undefined = defaults. */
  layout?: ToolbarLayout;
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
  layout,
  stickyOnMobile,
  className,
}) => {
  const { t } = useTranslation();
  const widthClass = useWidthClass();
  const families = resolveLayout(layout, widthClass);
  const compact = widthClass === 'compact';
  const [scrollRef, overflow] = useEdgeFade(compact);

  return (
    <div
      ref={scrollRef}
      data-testid="editor-toolbar"
      data-width-class={widthClass}
      data-overflow-start={overflow.start || undefined}
      data-overflow-end={overflow.end || undefined}
      style={compact ? edgeFadeStyle(overflow) : undefined}
      className={cn(
        'flex items-center gap-1',
        compact
          ? // The scrollbar itself would eat a row of its own under the buttons,
            // and a shrinking button is not a button.
            'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_button]:shrink-0'
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
      {families.map(({ family, items, collapsed }) =>
        collapsed ? (
          <ToolbarFamilyMenu
            key={family.id}
            family={family}
            items={items}
            editor={editor}
            t={t as TFunction}
          />
        ) : (
          // A family is a group, not a wrapper with its own layout: `contents`
          // keeps its buttons as direct children of the bar's flex row, so
          // scrolling and gaps behave as if the grouping were not there.
          <div key={family.id} className="contents">
            {items.map((item) => (
              <ToolbarLeaf key={item.id} item={item} editor={editor} t={t as TFunction} />
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default EditorToolbar;

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
  /** A width with no stored Layout was never customised and renders its built-in default. */
  layouts?: Partial<Record<WidthClass, ToolbarLayout>>;
  /** Mobile only: pin the bar to the bottom so it rides above the virtual keyboard. */
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
 * Fade only an edge that is actually hiding buttons: a permanent fade would dim the
 * ends of a bar that fits and imply content that is not there.
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

  // Derived, not reset in the effect: a wide bar never fades, and clearing it in
  // the effect would be a cascading render.
  return [ref, active ? overflow : NO_OVERFLOW];
}

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
 * Drawn from the user's resolved Layout, one per Width Class (ADR 0011). Compact
 * scrolls rather than wraps: a bar above the keyboard may not take height from the note.
 */
export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  layouts,
  stickyOnMobile,
  className,
}) => {
  // The button factories take `t` under our own narrower alias; cast once here.
  const { t } = useTranslation() as { t: TFunction };
  const widthClass = useWidthClass();
  // `resolveLayout` does not know which extensions are mounted, so drop what this
  // editor cannot draw first, or an unmounted family renders as an empty box and
  // could be the one that gets pinned.
  const families = resolveLayout(layouts?.[widthClass], widthClass)
    .map((entry) => ({
      ...entry,
      items: entry.items.filter((item) => canRenderItem(item, { editor, t })),
    }))
    .filter((entry) => entry.items.length > 0);
  const compact = widthClass === 'compact';
  const [scrollRef, overflow] = useEdgeFade(compact);
  const scrolls = overflow.start || overflow.end;
  // The pinned family sits at the left edge, so that edge never fades.
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
          ? // `justify-between` is a no-op once the bar overflows: editor/CLAUDE.md.
            'justify-between overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_button]:shrink-0'
          : 'flex-wrap',
        // The sheet drops its own padding below `sm:`, so this bar clears the home
        // indicator and the keyboard itself. `--keyboard-inset` is 0 wherever the
        // layout viewport already shrank (`useKeyboardInset`), as on Android.
        stickyOnMobile &&
          'sticky bottom-0 z-10 order-last bg-note-surface pt-2 pb-[calc(0.5rem+var(--safe-bottom)+var(--keyboard-inset))] sm:static sm:order-none sm:py-0',
        className
      )}
    >
      {families.map(({ family, items, collapsed }, index) => {
        // The first family stays put while the rest scrolls, so undo (first by
        // default) is always in reach on a phone. Why only while the row scrolls,
        // and why that cannot oscillate: editor/CLAUDE.md.
        const pinned = compact && scrolls && index === 0;
        const content = collapsed ? (
          <ToolbarFamilyMenu family={family} items={items} editor={editor} t={t} />
        ) : (
          items.map((item) => <ToolbarLeaf key={item.id} item={item} editor={editor} t={t} />)
        );

        return (
          // On Compact, `contents` keeps a family's buttons in the bar's own row so they
          // spread; only a pinned family needs a box. On Wide a family wraps as one unit.
          <div
            key={family.id}
            data-pinned={pinned || undefined}
            className={
              pinned
                ? // No padding: a pin that cost width could latch itself on (editor/CLAUDE.md).
                  'sticky left-0 z-10 flex shrink-0 items-center gap-1 bg-note-surface'
                : compact
                  ? 'contents'
                  : 'flex items-center gap-1'
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

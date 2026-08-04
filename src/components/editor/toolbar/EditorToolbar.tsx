import type { Editor } from '@tiptap/react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from '@/components/editor/extensions/button-types';
import { cn } from '@/lib/utils.ts';
import { resolveItemButton } from './registry';
import { resolveLayout } from './resolveLayout';
import type { ToolbarItem, ToolbarLayout } from './types';
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

/** One leaf: the button view its extension contributes, or nothing at all. */
const ToolbarLeaf: React.FC<{ item: ToolbarItem; editor: Editor; t: TFunction }> = ({
  item,
  editor,
  t,
}) => {
  const view = resolveItemButton(item, { editor, t });
  if (!view) return null;
  const { component: Component, componentProps } = view;
  return <Component {...componentProps} />;
};

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

  return (
    <div
      data-testid="editor-toolbar"
      data-width-class={widthClass}
      className={cn(
        'flex items-center gap-1',
        // Compact never wraps; wide has room to.
        widthClass === 'compact' ? 'overflow-x-auto' : 'flex-wrap',
        // The sticky bar needs an opaque background to cover the text scrolling
        // under it, and it takes the note's own surface rather than the app
        // background - the editor sits inside a note-tinted dialog, where a
        // neutral band would read as a foreign element.
        stickyOnMobile &&
          'sticky bottom-0 z-10 order-last bg-note-surface py-2 sm:static sm:order-none sm:py-0',
        className
      )}
    >
      {/* Step 3 replaces the leaves of a `collapsed` family with one
          state-reporting trigger; until then every family draws its leaves. */}
      {families.map(({ family, items }) => (
        // A family is a group, not a wrapper with its own layout: `contents`
        // keeps its buttons as direct children of the bar's flex row, so
        // scrolling and gaps behave as if the grouping were not there.
        <div key={family.id} className="contents">
          {items.map((item) => (
            <ToolbarLeaf key={item.id} item={item} editor={editor} t={t as TFunction} />
          ))}
        </div>
      ))}
    </div>
  );
};

export default EditorToolbar;

import type { Editor } from '@tiptap/react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ButtonContext,
  ButtonView,
  TFunction,
} from '@/components/editor/extensions/button-types';
import { cn } from '@/lib/utils.ts';

interface ExtensionButtonBarProps {
  editor: Editor;
  /**
   * Names of the extensions whose canonical (Pattern A) `button` should be rendered,
   * in display order. Names that are not registered or expose no `button` are skipped.
   */
  names: string[];
  className?: string;
}

/**
 * Renders the extension-owned toolbar buttons (Pattern A, ADR 0004) for the given
 * extension names. Each extension's `button({ editor, t })` factory returns the
 * component + props to render, so the button, its icon, tooltip and active state
 * all live with the extension - the bar just resolves and lays them out.
 */
export const ExtensionButtonBar: React.FC<ExtensionButtonBarProps> = ({
  editor,
  names,
  className,
}) => {
  const { t } = useTranslation();

  return (
    // On mobile the wrapper is `display: contents` so its buttons become direct children of
    // the toolbar's flex-wrap and wrap button-by-button (not whole sections at a time); at
    // `sm`+ it is a normal flex group so sections stay intact.
    <div className={cn('contents items-center gap-1 sm:flex', className)}>
      {names.map((name) => {
        const extension = editor.extensionManager.extensions.find((e) => e.name === name);
        const buttonFactory = extension?.options?.button as
          | ((context: ButtonContext) => ButtonView | ButtonView[])
          | undefined;
        if (!buttonFactory) {
          return null;
        }
        // A `button` factory may return one button or several (e.g. Heading levels, undo/redo).
        const result = buttonFactory({ editor, t: t as TFunction });
        const views = Array.isArray(result) ? result : [result];
        return views.map(({ component: Component, componentProps, hideOnMobile }, index) => {
          const key = `${name}-${index}`;
          // `hideOnMobile` buttons are wrapped so the responsive class hides them below
          // `sm` regardless of whether the button component itself forwards a className.
          if (hideOnMobile) {
            return (
              <span key={key} className="hidden sm:inline-flex">
                <Component {...componentProps} />
              </span>
            );
          }
          return <Component key={key} {...componentProps} />;
        });
      })}
    </div>
  );
};

export default ExtensionButtonBar;

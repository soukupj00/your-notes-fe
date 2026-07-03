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
    <div className={cn('flex items-center gap-1', className)}>
      {names.map((name) => {
        const extension = editor.extensionManager.extensions.find((e) => e.name === name);
        const buttonFactory = extension?.options?.button as
          | ((context: ButtonContext) => ButtonView)
          | undefined;
        if (!buttonFactory) {
          return null;
        }
        const { component: Component, componentProps } = buttonFactory({
          editor,
          t: t as TFunction,
        });
        return <Component key={name} {...componentProps} />;
      })}
    </div>
  );
};

export default ExtensionButtonBar;

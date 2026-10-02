import { type HeadingOptions, Heading as TiptapHeading } from '@tiptap/extension-heading';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

const HEADING_LEVELS = [1, 2, 3] as const;
type HeadingLevel = (typeof HEADING_LEVELS)[number];

export interface HeadingExtensionOptions extends HeadingOptions {
  button: (context: ButtonContext) => ButtonView[];
}

export const Heading = TiptapHeading.extend<HeadingExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) =>
        HEADING_LEVELS.map((level: HeadingLevel) => ({
          component: ActionButton,
          componentProps: {
            action: () => editor.chain().focus().toggleHeading({ level }).run(),
            isActive: () => editor.isActive('heading', { level }),
            shortcutKeys: ['Mod', 'Alt', String(level)],
            icon: `Heading${level}` as ButtonView['componentProps']['icon'],
            // The key the registry labels this leaf with, so there is one string to translate.
            // It must exist: the bar rebuilds per keystroke, so a missing key warns per keystroke.
            tooltip: t(`editor.heading.h${level}`),
            toggle: true,
          },
        })),
    } as unknown as HeadingExtensionOptions;
  },
});

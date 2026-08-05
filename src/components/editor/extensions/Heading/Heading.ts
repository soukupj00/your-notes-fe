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
            // One key per level, the same ones the registry labels these leaves
            // with. The interpolated `editor.heading.level` this replaces was
            // never in any translation file, so every heading button resolved to
            // the raw key and i18next logged a `missingKey` for it - and because
            // the bar rebuilds every button on every editor update (it has to:
            // `isActive` is live), that was one warning per heading leaf per
            // keystroke. A second string saying "Heading 1" would also have been
            // a second string to translate and to keep in step with the menu row
            // sitting right next to it.
            tooltip: t(`editor.heading.h${level}`),
            toggle: true,
          },
        })),
    } as unknown as HeadingExtensionOptions;
  },
});

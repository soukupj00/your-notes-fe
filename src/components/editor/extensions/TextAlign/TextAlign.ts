import { type TextAlignOptions, TextAlign as TiptapTextAlign } from '@tiptap/extension-text-align';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

const ALIGNMENTS = ['left', 'center', 'right'] as const;
type Alignment = (typeof ALIGNMENTS)[number];

const ICONS: Record<Alignment, ButtonView['componentProps']['icon']> = {
  left: 'AlignLeft',
  center: 'AlignCenter',
  right: 'AlignRight',
};

/** Hints for upstream's existing bindings; nothing new is bound here. */
const SHORTCUTS: Record<Alignment, string[]> = {
  left: ['Mod', 'Shift', 'L'],
  center: ['Mod', 'Shift', 'E'],
  right: ['Mod', 'Shift', 'R'],
};

export interface TextAlignExtensionOptions extends TextAlignOptions {
  button: (context: ButtonContext) => ButtonView[];
}

/** `justify` is left out: it reads badly at note width. Without `types` naming the blocks
 *  that carry the attribute, the commands silently no-op. */
export const TextAlign = TiptapTextAlign.extend<TextAlignExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      types: ['heading', 'paragraph'],
      alignments: [...ALIGNMENTS],
      button: ({ editor, t }: ButtonContext) =>
        ALIGNMENTS.map((alignment) => ({
          component: ActionButton,
          componentProps: {
            action: () => editor.chain().focus().toggleTextAlign(alignment).run(),
            isActive: () => editor.isActive({ textAlign: alignment }),
            icon: ICONS[alignment],
            shortcutKeys: SHORTCUTS[alignment],
            tooltip: t(`editor.textAlign.${alignment}`),
            toggle: true,
          },
        })),
    } as unknown as TextAlignExtensionOptions;
  },
});

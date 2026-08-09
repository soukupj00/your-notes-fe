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

/**
 * Upstream binds these already (`Mod-Shift-l/e/r`); we simply never showed them,
 * so three working shortcuts were invisible. No new bindings here - just the
 * hints for the ones that exist.
 */
const SHORTCUTS: Record<Alignment, string[]> = {
  left: ['Mod', 'Shift', 'L'],
  center: ['Mod', 'Shift', 'E'],
  right: ['Mod', 'Shift', 'R'],
};

export interface TextAlignExtensionOptions extends TextAlignOptions {
  button: (context: ButtonContext) => ButtonView[];
}

/**
 * Paragraph/heading alignment, contributing one button per alignment (the
 * Heading pattern). `justify` is left out: it reads badly at note width and
 * would be a fourth button nobody reaches for.
 *
 * `types` has to name the block nodes that carry the attribute; without it the
 * commands silently no-op.
 */
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

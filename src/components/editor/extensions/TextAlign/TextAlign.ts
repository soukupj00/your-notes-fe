import { TextAlign as TiptapTextAlign } from '@tiptap/extension-text-align';
import type { IconName } from '@/components/icons';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { withButton } from '../withButton';
import { withoutKeys } from '../withoutKeys';

const ALIGNMENTS = ['left', 'center', 'right'] as const;
type Alignment = (typeof ALIGNMENTS)[number];

const ICONS: Record<Alignment, IconName> = {
  left: 'AlignLeft',
  center: 'AlignCenter',
  right: 'AlignRight',
};

/** `justify` is left out: it reads badly at note width. Without `types` naming the blocks
 *  that carry the attribute, the commands silently no-op. */
export const TextAlign = withButton(
  withoutKeys(TiptapTextAlign, ['Mod-Shift-l', 'Mod-Shift-e', 'Mod-Shift-r', 'Mod-Shift-j']),
  ({ editor, t }) =>
    ALIGNMENTS.map((alignment) => ({
      component: ActionButton,
      componentProps: {
        action: () => editor.chain().focus().toggleTextAlign(alignment).run(),
        isActive: () => editor.isActive({ textAlign: alignment }),
        icon: ICONS[alignment],
        tooltip: t(`editor.textAlign.${alignment}`),
        toggle: true,
      },
    })),
  { types: ['heading', 'paragraph'], alignments: [...ALIGNMENTS] }
);

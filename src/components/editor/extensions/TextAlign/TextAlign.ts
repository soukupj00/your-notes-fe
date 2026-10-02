import { TextAlign as TiptapTextAlign } from '@tiptap/extension-text-align';
import type { IconName } from '@/components/icons';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { withButton } from '../withButton';

const ALIGNMENTS = ['left', 'center', 'right'] as const;
type Alignment = (typeof ALIGNMENTS)[number];

const ICONS: Record<Alignment, IconName> = {
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

/** `justify` is left out: it reads badly at note width. Without `types` naming the blocks
 *  that carry the attribute, the commands silently no-op. */
export const TextAlign = withButton(
  TiptapTextAlign,
  ({ editor, t }) =>
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
  { types: ['heading', 'paragraph'], alignments: [...ALIGNMENTS] }
);

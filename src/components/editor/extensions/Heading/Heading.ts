import { Heading as TiptapHeading } from '@tiptap/extension-heading';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { withButton } from '../withButton';
import { withoutKeys } from '../withoutKeys';

const HEADING_LEVELS = [1, 2, 3] as const;

// Upstream's default is 1-6. Limiting it also drops their `####` rules, and turns
// a stored or pasted h4-h6 into a paragraph with its text kept.
export const Heading = withButton(
  withoutKeys(TiptapHeading, ['Mod-Alt-1', 'Mod-Alt-2', 'Mod-Alt-3']),
  ({ editor, t }) =>
    HEADING_LEVELS.map((level) => ({
      component: ActionButton,
      componentProps: {
        action: () => editor.chain().focus().toggleHeading({ level }).run(),
        isActive: () => editor.isActive('heading', { level }),
        icon: `Heading${level}`,
        // The key the registry labels this leaf with, so there is one string to translate.
        // It must exist: the bar rebuilds per keystroke, so a missing key warns per keystroke.
        tooltip: t(`editor.heading.h${level}`),
        toggle: true,
      },
    })),
  { levels: [...HEADING_LEVELS] }
);

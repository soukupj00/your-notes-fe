import {
  type HorizontalRuleOptions,
  HorizontalRule as TiptapHorizontalRule,
} from '@tiptap/extension-horizontal-rule';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonContext, ButtonView } from '../button-types';

export interface HorizontalRuleExtensionOptions extends HorizontalRuleOptions {
  button: (context: ButtonContext) => ButtonView;
}

/** An insert, not a toggle, so the button has no active state. */
export const HorizontalRule = TiptapHorizontalRule.extend<HorizontalRuleExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.setHorizontalRule(),
          icon: 'Minus',
          tooltip: t('editor.horizontalRule.tooltip'),
        },
      }),
    } as unknown as HorizontalRuleExtensionOptions;
  },
});

import type { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { TFunction } from '../button-types';
import { LinkButton } from './LinkButton';

/** Module scope on purpose: BubbleMenu dispatches when these change, and with
 *  `shouldRerenderOnTransaction` a fresh literal per render loops into "Maximum update depth
 *  exceeded". Do not inline them into the JSX. */
const SHOULD_SHOW = ({ editor }: { editor: Editor }) => editor.isActive('link');
const MENU_OPTIONS = { placement: 'bottom' } as const;

const linkHref = (editor: Editor) =>
  (editor.getAttributes('link').href as string | undefined) ?? '';

/** With `openOnClick` off, this is the only way to see where a link goes while editing. */
export function LinkBubbleMenu({ editor, t }: { editor: Editor; t: TFunction }) {
  return (
    <BubbleMenu editor={editor} shouldShow={SHOULD_SHOW} options={MENU_OPTIONS}>
      <div className="flex items-center gap-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
        <a
          href={linkHref(editor) || '#'}
          target="_blank"
          rel="noreferrer noopener"
          className="max-w-48 truncate px-2 text-xs underline underline-offset-2 hover:text-foreground"
        >
          {linkHref(editor)}
        </a>
        <LinkButton editor={editor} t={t} tooltip={t('editor.link.edit')} />
        <ActionButton
          icon="Link2Off"
          tooltip={t('editor.link.remove')}
          action={() => editor.chain().focus().unsetLink().run()}
        />
      </div>
    </BubbleMenu>
  );
}

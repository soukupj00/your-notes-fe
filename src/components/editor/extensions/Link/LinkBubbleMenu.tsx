import type { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { TFunction } from '../button-types';
import { LinkButton } from './LinkButton';

/**
 * Both of these MUST keep a stable identity across renders.
 *
 * `BubbleMenu`'s update effect lists `shouldShow` and `options` in its
 * dependencies and dispatches a transaction when they change. Our editor runs
 * with `shouldRerenderOnTransaction: true`, so a fresh literal on each render
 * becomes: render -> effect -> dispatch -> render, i.e. "Maximum update depth
 * exceeded" the moment a note is opened. Defining them at module scope is what
 * breaks that cycle - do not inline them back into the JSX.
 */
const SHOULD_SHOW = ({ editor }: { editor: Editor }) => editor.isActive('link');
const MENU_OPTIONS = { placement: 'bottom' } as const;

const linkHref = (editor: Editor) =>
  (editor.getAttributes('link').href as string | undefined) ?? '';

/**
 * Contextual menu for the link under the cursor: the URL it points at, an edit
 * (the same popover the toolbar uses) and an unlink.
 *
 * It exists because a link's own affordances belong on the link. `openOnClick`
 * is off in the editor, so without this there is no way to see where a link
 * goes without saving the note and reading it back.
 */
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

import type { Editor } from '@tiptap/core';
import { useCallback, useEffect, useState } from 'react';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import type { TFunction } from '../button-types';

export interface LinkButtonProps {
  editor: Editor;
  t: TFunction;
  tooltip: string;
  /** Passed in like every Pattern A button, so the registry's pin test and the Settings
   *  shortcut list find `link`'s shortcut on the resolved view. */
  shortcutKeys?: string[];
}

/** With a collapsed cursor the URL is inserted as its own link text, or the command would
 *  mark nothing. Editing and removing a link happen in the bubble menu. */
export function LinkButton({ editor, t, tooltip, shortcutKeys }: LinkButtonProps) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState('');

  const openPopover = useCallback(
    (next: boolean) => {
      // Seed from the link under the cursor so re-opening it is an edit, not a retype.
      if (next) setHref((editor.getAttributes('link').href as string | undefined) ?? '');
      setOpen(next);
    },
    [editor]
  );

  // `Mod+K` opens this popover rather than a second, different link UI. The
  // extension falls back to a prompt when no button is mounted, so the shortcut
  // still works when the whole format family is collapsed.
  useEffect(
    () => editor.storage.link.prompt.registerButton(() => openPopover(true)),
    [editor, openPopover]
  );

  const apply = () => {
    const url = href.trim();
    setOpen(false);
    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (editor.state.selection.empty) {
      editor.chain().focus().insertContent(url).run();
      // insertContent leaves the cursor after the text, so select what was just
      // written before marking it - otherwise the mark lands on nothing.
      const to = editor.state.selection.from;
      editor
        .chain()
        .setTextSelection({ from: to - url.length, to })
        .setLink({ href: url })
        .focus()
        .run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <Popover open={open} onOpenChange={openPopover}>
      <PopoverTrigger asChild>
        <ActionButton
          shortcutKeys={shortcutKeys}
          icon="Link2"
          tooltip={tooltip}
          toggle
          isActive={() => editor.isActive('link')}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <Input
            autoFocus
            type="url"
            inputMode="url"
            placeholder="https://"
            aria-label={t('editor.link.url')}
            value={href}
            onChange={(event) => setHref(event.target.value)}
          />
          <Button type="submit" size="sm">
            {t('editor.link.apply')}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

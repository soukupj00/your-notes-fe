import type { Editor } from '@tiptap/core';
import { useState } from 'react';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import type { TFunction } from '../button-types';

export interface LinkButtonProps {
  editor: Editor;
  t: TFunction;
  tooltip: string;
}

/**
 * Toolbar entry point for links: a popover that takes a URL and applies it to
 * the selection (or, with a collapsed cursor, inserts the URL as its own link
 * text - otherwise the command would mark nothing and appear to do nothing).
 *
 * Editing and removing an existing link happen from the bubble menu that
 * appears on one, not from here.
 */
export function LinkButton({ editor, t, tooltip }: LinkButtonProps) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState('');

  const openPopover = (next: boolean) => {
    // Seed from the link under the cursor so re-opening it is an edit, not a retype.
    if (next) setHref((editor.getAttributes('link').href as string | undefined) ?? '');
    setOpen(next);
  };

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

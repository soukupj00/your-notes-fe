import type { Editor } from '@tiptap/core';
import katex from 'katex';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { Input } from '@/components/ui/input.tsx';
import { cn } from '@/lib/utils.ts';
import type { TFunction } from '../button-types';
import type { TextPromptRequest } from './textPrompt';

interface Pending {
  request: TextPromptRequest;
  answer: (value: string | null) => void;
}

/** The editor's one text prompt, mounted while it is editable. A newer question replaces the
 *  dialog whole, so its field starts from that question's own text. */
export function TextPromptHost({ editor, t }: { editor: Editor; t: TFunction }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [asked, setAsked] = useState(0);
  const prompt = editor.storage.textPrompt;

  useEffect(
    () =>
      prompt.registerHost((request, answer) => {
        setPending({ request, answer });
        setAsked((count) => count + 1);
      }),
    [prompt]
  );

  if (!pending) return null;

  return (
    <TextPromptDialog
      key={asked}
      request={pending.request}
      t={t}
      onAnswer={(value) => {
        setPending(null);
        pending.answer(value);
      }}
      onClosed={() => {
        if (!editor.isDestroyed) editor.commands.focus();
      }}
    />
  );
}

interface TextPromptDialogProps {
  request: TextPromptRequest;
  t: TFunction;
  onAnswer: (value: string | null) => void;
  onClosed: () => void;
}

function TextPromptDialog({ request, t, onAnswer, onClosed }: TextPromptDialogProps) {
  const [value, setValue] = useState(request.initial ?? '');
  const math = request.kind === 'math';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onAnswer(null);
      }}
    >
      <DialogContent
        showCloseButton={false}
        // Centred in what the software keyboard leaves, or the field sits under it on a phone.
        className="top-[calc((100%-var(--keyboard-inset,0px))/2)] sm:max-w-sm"
        // Back to the text, not to the button that asked: the answer lands at the cursor.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onAnswer(value);
          }}
        >
          <DialogHeader>
            <DialogTitle>{request.title}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            type={math ? 'text' : 'url'}
            inputMode={math ? 'text' : 'url'}
            placeholder={math ? undefined : 'https://'}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={request.title}
            className={cn(math && 'font-mono')}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {math && value.trim() && (
            <div
              aria-hidden
              data-testid="math-preview"
              className="min-h-9 overflow-x-auto rounded-md bg-muted px-3 py-2 text-center"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX's own output, which escapes the source.
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(value, { throwOnError: false }),
              }}
            />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onAnswer(null)}>
              {t('editor.prompt.cancel')}
            </Button>
            <Button type="submit">{request.confirmLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

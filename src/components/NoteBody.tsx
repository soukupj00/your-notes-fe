import DOMPurify from 'dompurify';
import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils.ts';

/**
 * The one sanitizer configuration for a Body's HTML, shared with the public
 * Share Link page (`SharedNoteBody`), where the Body is a stranger's input.
 */
export function sanitizeBody(html: string): string {
  return DOMPurify.sanitize(html, { ADD_TAGS: ['excalidraw-drawing'] });
}

/**
 * Prose only: `NoteCard` strips attachments first, so a view needing inline attachments is a new
 * component, not a flag here. Rendered synchronously, not in an effect, because the masonry wall
 * measures a card the moment it mounts.
 */
function NoteBodyRenderer({
  html,
  className,
  onClick,
  ref,
}: {
  html: string | null | undefined;
  className?: string;
  /** Delegated, since `innerHTML` has no React elements; the card catches checkbox taps here. */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const markup = useMemo(() => sanitizeBody(html ?? ''), [html]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a delegate, not a control; the real checkboxes inside bring their own role.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Space on a focused checkbox already clicks, and that click bubbles here (NoteCard.test.tsx, "ticks from the keyboard").
    <div
      ref={ref}
      onClick={onClick}
      className={cn('prose prose-sm max-w-none text-foreground', className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized above, self-authored editor HTML
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/**
 * Memoised: setting `innerHTML` rebuilds every node, which also drops the user's text selection,
 * and `NoteCard` re-renders for many reasons the prose has no part in.
 */
export const NoteBody = memo(NoteBodyRenderer);

export default NoteBody;

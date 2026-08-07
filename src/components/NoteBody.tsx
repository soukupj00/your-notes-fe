import DOMPurify from 'dompurify';
import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils.ts';

/**
 * Read-only renderer for a Note's Body HTML.
 *
 * Prose only: its one caller (`NoteCard`) strips every attachment node first,
 * because the card summarises attachments in `CardMedia` and rendering them
 * twice would push a note's own words off the bottom of the clamp. So this
 * resolves no attachment ids and mints no object URLs - if a read-only view
 * ever needs inline attachments, that is a new component, not a flag here.
 *
 * Rendered synchronously rather than hydrated in an effect: a card is measured
 * for the masonry wall the moment it mounts, and a body that arrives one effect
 * later is a card that grows after it has already faded in.
 *
 * The markup is our own editor's output, sanitized on the way in - the same
 * trust model `CardMedia` applies to a stored Excalidraw preview.
 */
function NoteBodyRenderer({
  html,
  className,
  onClick,
  ref,
}: {
  html: string | null | undefined;
  className?: string;
  /**
   * Delegated, because the body is `innerHTML` and so has no React elements to
   * attach a handler to. The card uses it to catch a checkbox tap.
   */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const markup = useMemo(
    () => DOMPurify.sanitize(html ?? '', { ADD_TAGS: ['excalidraw-drawing'] }),
    [html]
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a delegate, not a control. The interactive elements are the real <input type="checkbox"> nodes inside the markup, which bring their own role and focusability; a role here would announce a control that does not exist.
    // biome-ignore lint/a11y/useKeyWithClickEvents: a key handler here would be dead code. Space on a focused checkbox fires a click through the element's own activation behaviour, and that click reaches this delegate by bubbling - locked by NoteCard.test.tsx, "ticks from the keyboard".
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
 * Memoised because setting `innerHTML` rebuilds the whole prose subtree, and
 * `NoteCard` re-renders for reasons the prose has no part in - its attachment
 * query resolving, its labels arriving, a lifecycle action running. Without
 * this, every one of those throws away and recreates each node in the body,
 * which in a browser also drops whatever text the user had selected inside the
 * card. Both props are strings, so the default shallow compare is enough.
 */
export const NoteBody = memo(NoteBodyRenderer);

export default NoteBody;

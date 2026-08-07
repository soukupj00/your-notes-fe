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
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const markup = useMemo(
    () => DOMPurify.sanitize(html ?? '', { ADD_TAGS: ['excalidraw-drawing'] }),
    [html]
  );

  return (
    <div
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

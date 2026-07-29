import DOMPurify from 'dompurify';
import { useEffect, useRef } from 'react';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import { cn } from '@/lib/utils.ts';

// A src-less <img> and an empty <excalidraw-drawing> both measure zero high, so
// a card grew by the full image height the moment its blob resolved. Reserve a
// skeleton box up front instead. The ratio is a guess (attachments do not
// persist their intrinsic dimensions), so this trades a jarring pop-in for a
// small settle - see the note in the slice plan about storing width/height.
const PLACEHOLDER_CLASSES = ['w-full', 'animate-pulse', 'rounded-md', 'bg-primary/10'];
const PLACEHOLDER_RATIO = '16 / 10';

function markAsPlaceholder(el: HTMLElement): void {
  el.classList.add(...PLACEHOLDER_CLASSES);
  el.style.aspectRatio = PLACEHOLDER_RATIO;
}

function clearPlaceholder(el: HTMLElement): void {
  el.classList.remove('animate-pulse', 'bg-primary/10');
  el.style.aspectRatio = '';
}

function replaceWithSanitizedMarkup(target: Element, markup: string): void {
  const fragment = DOMPurify.sanitize(markup, {
    RETURN_DOM_FRAGMENT: true,
    ADD_TAGS: ['excalidraw-drawing'],
  });
  target.replaceChildren(fragment);
}

/**
 * Read-only renderer for a Note's Body HTML. Sets innerHTML, then resolves every
 * <img data-attachment-id> to a Blob object URL (lazy-loaded) and revokes the
 * URLs on unmount. The one place that turns attachmentId -> object URL for the
 * non-editor path; reusable by any future read-only Note view.
 */
export function NoteBody({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { getAttachment } = useAttachmentActions();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // Self-authored HTML from our own editor (same trust model as the
    // dangerouslySetInnerHTML this component replaces).
    replaceWithSanitizedMarkup(root, html ?? '');
    const urls: string[] = [];
    let active = true;
    const imgs = root.querySelectorAll<HTMLImageElement>('img[data-attachment-id]');
    imgs.forEach((img) => {
      const id = img.getAttribute('data-attachment-id');
      if (!id) return;
      img.setAttribute('loading', 'lazy');
      img.classList.add('rounded-md');
      markAsPlaceholder(img);
      // The reserved box is only released once the bytes have actually decoded -
      // dropping it when `src` is assigned would collapse the card again for the
      // duration of the decode.
      img.addEventListener('load', () => clearPlaceholder(img), { once: true });
      img.addEventListener('error', () => clearPlaceholder(img), { once: true });
      getAttachment(id)
        .then((att) => {
          if (!active) return;
          if (!att) {
            clearPlaceholder(img);
            return;
          }
          const url = URL.createObjectURL(att.thumbnail ?? att.blob);
          urls.push(url);
          img.src = url;
        })
        // A failed lookup must not leave the skeleton pulsing forever.
        .catch(() => {
          if (active) clearPlaceholder(img);
        });
    });
    // Excalidraw drawings render as their stored SVG snapshot on the card
    // (image-like inline resolution) - never re-mounting the canvas on the feed.
    root.querySelectorAll<HTMLElement>('excalidraw-drawing[data-attachment-id]').forEach((el) => {
      const id = el.getAttribute('data-attachment-id');
      if (!id) return;
      el.style.display = 'block';
      markAsPlaceholder(el);
      getAttachment(id)
        .then((att) => {
          if (!active) return;
          if (!att?.preview) {
            clearPlaceholder(el);
            return;
          }
          clearPlaceholder(el);
          // Self-generated SVG markup (see sceneToSvgString), same trust model as
          // the Body HTML this component already sets.
          replaceWithSanitizedMarkup(el, att.preview);
          // Custom elements are inline by default, which makes the SVG participate
          // in a text line box and can reserve large blank space around wide
          // drawings. Treat the preview as a normal responsive block image.
          el.style.display = 'block';
          el.style.lineHeight = '0';
          el.classList.add('overflow-hidden', 'rounded-md');
          const svg = el.querySelector('svg');
          if (svg) {
            svg.style.display = 'block';
            svg.style.width = '100%';
            svg.style.height = 'auto';
            svg.style.maxWidth = '100%';
          }
        })
        // A failed lookup must not leave the skeleton pulsing forever.
        .catch(() => {
          if (active) clearPlaceholder(el);
        });
    });
    // Audio, video, and file attachments have no inline representation on the
    // card - the card renders a dedicated button (see NoteCard). Remove the
    // src-less <audio>/<video>/<a> nodes so they don't show as broken native
    // players or dead links.
    root.querySelectorAll('audio[data-attachment-id]').forEach((el) => {
      el.remove();
    });
    root.querySelectorAll('video[data-attachment-id]').forEach((el) => {
      el.remove();
    });
    root.querySelectorAll('a[data-attachment-id]').forEach((el) => {
      el.remove();
    });
    return () => {
      active = false;
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [html, getAttachment]);

  return <div ref={ref} className={cn('prose prose-sm max-w-none text-foreground', className)} />;
}

export default NoteBody;

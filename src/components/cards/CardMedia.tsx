import DOMPurify from 'dompurify';
import { FileText, PenLine, Play, Video } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNoteAttachments } from '@/hooks/data/useNoteAttachments.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { formatBytes, formatDuration, formatFileType } from '@/lib/format-attachment.ts';
import { type BodyAttachment, extractBodyAttachments } from '@/lib/note-attachments.ts';
import { cn } from '@/lib/utils.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';

/** Kinds whose whole point is the picture, so they share one thumbnail wall. */
const VISUAL_KINDS: readonly AttachmentKind[] = ['image', 'video', 'excalidraw'];

/**
 * Thumbnails shown before the wall starts counting instead. Four, because the
 * fifth tile is smaller than a thumbnail needs to be at card width, and past
 * that a count carries more information than another postage stamp.
 */
const GRID_CAP = 4;

/** A Body reference joined to its stored row; the row is absent while it loads. */
type Resolved = BodyAttachment & { row?: Attachment };

/**
 * Object URLs for every visual that has bytes.
 *
 * Minted during render rather than in an effect: an effect would need a
 * `setState` to publish them, which costs an extra render of every card in the
 * feed and paints one empty frame first. The effect here owns only the revoke,
 * and its cleanup closes over the *previous* map, so a set is released exactly
 * when it stops being displayed.
 *
 * Relies on `visuals` being referentially stable across renders (see the memos
 * in `CardMedia` and in `useNoteAttachments`) - re-minting on every render
 * would visibly flicker every thumbnail in the feed.
 */
function useVisualUrls(visuals: Resolved[]): Record<string, string> {
  const urls = useMemo(() => {
    const next: Record<string, string> = {};
    for (const visual of visuals) {
      // A drawing carries its preview as SVG markup, not as bytes.
      if (!visual.row || visual.kind === 'excalidraw') continue;
      next[visual.id] = URL.createObjectURL(visual.row.thumbnail ?? visual.row.blob);
    }
    return next;
  }, [visuals]);

  useEffect(
    () => () => {
      for (const url of Object.values(urls)) URL.revokeObjectURL(url);
    },
    [urls]
  );

  return urls;
}

/** The one overflow shape on the card, so the user learns it once. */
function More({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        'rounded-full bg-foreground/10 px-2 py-0.5 text-label text-muted-foreground tabular-nums',
        className
      )}
    >
      +{count}
    </span>
  );
}

/** Shared recessed plane every preview block sits on. */
const BLOCK = 'relative overflow-hidden rounded-control bg-note-media';

function VisualArt({
  visual,
  url,
  className,
}: {
  visual: Resolved;
  url?: string;
  className?: string;
}) {
  const { t } = useTranslation();

  if (visual.kind === 'excalidraw') {
    const preview = visual.row?.preview;
    if (!preview) return <span className={cn('block size-full', className)} aria-hidden />;
    return (
      <span
        className={cn(
          // A drawing is ink on paper, so it needs a light ground even at night -
          // but a pure-white field is the brightest thing in the night theme and
          // reads as a hole in the wall. Dim the paper instead of inverting it.
          'block size-full bg-[oklch(97%_0.008_84)] dark:bg-[oklch(84%_0.012_84)] [&_svg]:size-full [&_svg]:object-contain',
          className
        )}
        role="img"
        aria-label={t('notes.attachmentDrawing')}
        // Self-generated SVG from our own Excalidraw export (see sceneToSvgString),
        // the same trust model NoteBody applies to the Body markup itself.
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized above, self-authored SVG
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(preview) }}
      />
    );
  }

  if (!url) {
    // Reserve the box rather than let the card grow the moment the blob lands.
    return <span className={cn('block size-full animate-pulse bg-muted', className)} aria-hidden />;
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className={cn('block size-full object-cover', className)}
    />
  );
}

/**
 * A single picture, clip or sketch. Height is the note's own aspect ratio
 * clamped at 4:3 of the card, so a landscape photo shows uncropped while a tall
 * portrait can never turn one card into three cards' worth of column.
 */
function VisualHero({ visual, url }: { visual: Resolved; url?: string }) {
  const { t } = useTranslation();
  const duration = formatDuration(visual.row?.duration);
  const loaded = visual.kind === 'excalidraw' ? Boolean(visual.row?.preview) : Boolean(url);

  return (
    <div
      data-slot="card-media-visual"
      data-kind={visual.kind}
      className={cn(BLOCK, !loaded && 'aspect-[4/3]')}
    >
      <VisualArt visual={visual} url={url} className="max-h-[min(14rem,75cqw)] w-full" />

      {visual.kind === 'video' && (
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-note-surface/90 text-foreground shadow-rest"
        >
          <Play className="size-5 translate-x-px" />
        </span>
      )}

      {visual.kind !== 'image' && (
        <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-label text-white uppercase">
          {visual.kind === 'video' ? (
            <Video className="size-3" aria-hidden />
          ) : (
            <PenLine className="size-3" aria-hidden />
          )}
          {visual.kind === 'video' ? t('notes.attachmentVideo') : t('notes.attachmentDrawing')}
        </span>
      )}

      {duration && (
        <span className="absolute right-1.5 bottom-1.5 rounded-full bg-black/55 px-2 py-0.5 text-label text-white tabular-nums">
          {duration}
        </span>
      )}
    </div>
  );
}

/** Several pictures collapse into one capped wall of equal tiles. */
function VisualGrid({ visuals, urls }: { visuals: Resolved[]; urls: Record<string, string> }) {
  const shown = visuals.slice(0, GRID_CAP);
  const hidden = visuals.length - shown.length;

  return (
    <div
      data-slot="card-media-grid"
      className={cn(
        'grid gap-0.5 overflow-hidden rounded-control',
        shown.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
      )}
    >
      {shown.map((visual, index) => (
        <div
          key={visual.id}
          data-slot="card-media-tile"
          data-kind={visual.kind}
          className="relative aspect-[4/3] overflow-hidden bg-note-media"
        >
          <VisualArt visual={visual} url={urls[visual.id]} />
          {visual.kind === 'video' && (
            <span
              aria-hidden
              className="absolute top-1/2 left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <Play className="size-3.5 translate-x-px" />
            </span>
          )}
          {hidden > 0 && index === shown.length - 1 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/60 font-display text-base text-white tabular-nums">
              +{hidden}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// A fixed, deliberately uneven envelope. Real per-clip peaks would need the
// audio decoded on the feed, which is exactly the work the card exists to
// avoid; a constant shape still reads as "this is speech" rather than as noise.
const WAVE = [
  38, 72, 24, 96, 38, 58, 18, 44, 80, 30, 62, 92, 26, 50, 70, 34, 88, 20, 56, 76, 32, 64, 42, 28,
];

/** Every voice note on a card collapses into one player plus a count. */
function AudioRow({
  extra,
  duration,
  onActivate,
}: {
  extra: number;
  duration: string | null;
  onActivate: () => void;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <div data-slot="card-media-audio" className={cn(BLOCK, 'flex items-center gap-2 px-2 py-1.5')}>
      <button
        type="button"
        aria-label={t('notes.playAudio')}
        onClick={(event) => {
          event.stopPropagation();
          onActivate();
        }}
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-full bg-note-chip text-note-on-chip shadow-rest hover:shadow-note-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          !reducedMotion && 'transition-[background-color,box-shadow,transform] hover:scale-[1.04]'
        )}
      >
        <Play className="size-5 translate-x-px" />
      </button>

      <span className="flex h-6 min-w-0 flex-1 items-center gap-px" aria-hidden>
        {WAVE.map((height, index) => (
          <i
            // Position is the identity: this is one fixed decorative envelope.
            // biome-ignore lint/suspicious/noArrayIndexKey: positional waveform bar
            key={index}
            className="min-w-px flex-1 rounded-px bg-muted-foreground/55"
            style={{ height: `${height}%` }}
          />
        ))}
      </span>

      {duration && (
        <span className="shrink-0 text-label text-muted-foreground tabular-nums">{duration}</span>
      )}
      {extra > 0 && <More count={extra} className="shrink-0" />}
    </div>
  );
}

/**
 * Every attached file collapses into one row plus a count.
 *
 * Informational, not a control: a file opens from inside the opened note, and
 * the whole card already opens the note - a button here would be a second way
 * to do the identical thing, sitting on top of the card's own click target.
 */
function FileRow({ row, extra }: { row?: Attachment; extra: number }) {
  const { t } = useTranslation();
  const type = formatFileType(row?.name, row?.mime);
  const size = formatBytes(row?.size);

  return (
    <div data-slot="card-media-file" className={cn(BLOCK, 'flex items-center gap-2 px-2.5 py-2')}>
      <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />

      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-medium text-body text-foreground">
          {row?.name ?? t('notes.attachmentFile')}
        </span>
        {(type || size) && (
          <span className="truncate text-label text-muted-foreground">
            {[type, size].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>

      {extra > 0 && <More count={extra} className="shrink-0" />}
    </div>
  );
}

interface CardMediaProps {
  noteId: string;
  /** The note's Body HTML - the authority on which attachments exist and in what order. */
  body: string | null | undefined;
  /** Opens the note; every preview is a way into the note, never a player of its own. */
  onOpen: (opts?: { autoplayFirstAudio?: boolean }) => void;
}

/**
 * The card's answer to "a note can hold eleven blocks, so what does it show?".
 *
 * Kinds are *grouped* rather than listed in document order: visuals collapse
 * into one hero or one capped wall, voice notes into one player, files into one
 * row, each carrying a `+N` for the siblings it stands in for. That keeps a
 * card's height a function of the layout instead of a function of what the user
 * happened to attach - and a predictable height is what makes the masonry wall
 * scannable. The feed's job is recognising which note to open, not reading it.
 */
export function CardMedia({ noteId, body, onOpen }: CardMediaProps) {
  const refs = useMemo(() => extractBodyAttachments(body), [body]);
  const rows = useNoteAttachments(noteId);

  // One memo for all four lists: `useVisualUrls` mints object URLs off `visuals`
  // and must only see a new array when the underlying data actually changed.
  const { visuals, audio, files } = useMemo(() => {
    const resolved: Resolved[] = refs.map((ref) => ({ ...ref, row: rows.get(ref.id) }));
    return {
      visuals: resolved.filter((item) => VISUAL_KINDS.includes(item.kind)),
      audio: resolved.filter((item) => item.kind === 'audio'),
      files: resolved.filter((item) => item.kind === 'file'),
    };
  }, [refs, rows]);

  const urls = useVisualUrls(visuals);

  if (refs.length === 0) return null;

  return (
    <div data-slot="card-media" className="@container mb-2 flex flex-col gap-1.5">
      {visuals.length === 1 && <VisualHero visual={visuals[0]} url={urls[visuals[0].id]} />}
      {visuals.length > 1 && <VisualGrid visuals={visuals} urls={urls} />}

      {audio.length > 0 && (
        <AudioRow
          extra={audio.length - 1}
          duration={formatDuration(audio[0].row?.duration)}
          onActivate={() => onOpen({ autoplayFirstAudio: true })}
        />
      )}

      {files.length > 0 && <FileRow row={files[0].row} extra={files.length - 1} />}
    </div>
  );
}

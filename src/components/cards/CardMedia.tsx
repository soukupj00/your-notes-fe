import DOMPurify from 'dompurify';
import { FileText, Play } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { OverflowCount } from '@/components/ui/OverflowCount.tsx';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import { type NoteAttachments, useNoteAttachments } from '@/hooks/data/useNoteAttachments.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { type BodyAttachment, extractBodyAttachments } from '@/lib/body.ts';
import { formatBytes, formatDuration, formatFileType } from '@/lib/format.ts';
import type { Intent } from '@/lib/intent.ts';
import { cn } from '@/lib/utils.ts';
import { generateVideoPoster } from '@/lib/video-poster.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';

/** Kinds whose whole point is the picture, so they share one thumbnail wall. */
const VISUAL_KINDS: readonly AttachmentKind[] = ['image', 'video', 'excalidraw'];

// Four: a fifth tile is too small at card width, and past that a count says more.
const GRID_CAP = 4;

/** A Body reference joined to its stored row; the row is absent while it loads. */
type Resolved = BodyAttachment & { row?: Attachment };

/**
 * Minted during render, not in an effect, which would re-render every card and paint an empty
 * frame first; the effect only revokes the previous set. Needs a referentially stable `visuals`,
 * or every thumbnail in the feed flickers.
 */
function useVisualUrls(visuals: Resolved[]): Record<string, string> {
  const urls = useMemo(() => {
    const next: Record<string, string> = {};
    for (const visual of visuals) {
      // A drawing carries its preview as SVG markup, not as bytes.
      if (!visual.row || visual.kind === 'excalidraw') continue;
      // A row synced from another Device may have neither yet (its thumbnail is on the way);
      // the card never downloads full bytes itself.
      const bytes = visual.row.thumbnail ?? visual.row.blob;
      if (bytes) next[visual.id] = URL.createObjectURL(bytes);
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

const BLOCK = 'relative overflow-hidden rounded-control bg-note-media';

/**
 * Shared so `VisualArt` and `VisualHero` cannot disagree. A video's bytes are a container an
 * `<img>` cannot draw, so only its poster counts as art.
 */
function hasArt(visual: Resolved, url?: string): boolean {
  if (visual.kind === 'excalidraw') return Boolean(visual.row?.preview);
  if (visual.kind === 'video') return Boolean(visual.row?.thumbnail);
  return Boolean(url);
}

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

  if (!hasArt(visual, url)) {
    return (
      <span
        className={cn(
          'block size-full',
          // A poster-less video is a settled state; an image without its blob is still loading.
          visual.kind === 'video' && 'bg-note-media',
          visual.kind === 'image' && 'animate-pulse bg-muted',
          className
        )}
        aria-hidden
      />
    );
  }

  if (visual.kind === 'excalidraw') {
    return (
      <span
        className={cn(
          // Dimmed paper at night: a pure-white field reads as a hole in the wall.
          'block size-full bg-[oklch(97%_0.008_84)] dark:bg-[oklch(84%_0.012_84)] [&_svg]:size-full [&_svg]:object-contain',
          className
        )}
        role="img"
        aria-label={t('notes.attachmentDrawing')}
        // Self-generated SVG from our own Excalidraw export (see sceneToSvgString),
        // the same trust model NoteBody applies to the Body markup itself.
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized above, self-authored SVG
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(visual.row?.preview ?? '') }}
      />
    );
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

// Height is capped so a tall portrait cannot take three cards' worth of column.
function VisualHero({ visual, url }: { visual: Resolved; url?: string }) {
  const duration = formatDuration(visual.row?.duration);

  return (
    <div
      data-slot="card-media-visual"
      data-kind={visual.kind}
      // Reserves the box until the art lands, so the card does not grow under the reader.
      className={cn(BLOCK, !hasArt(visual, url) && 'aspect-[4/3]')}
    >
      <VisualArt visual={visual} url={url} className="max-h-[min(14rem,75cqw)] w-full" />

      {/* No kind label over the art: the play badge says video and a drawing shows itself.
          Duration stays, because the picture cannot say how long. */}
      {visual.kind === 'video' && (
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-note-surface/90 text-foreground shadow-rest"
        >
          <Play className="size-5 translate-x-px" />
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

// Once per id per session, so a clip the browser cannot decode never becomes a loop.
const posterAttempts = new Set<string>();

/**
 * Posters for videos stored before `Video/insert.ts` captured one. The feed must not decode
 * video per render, but decoding each old clip once and persisting the result is not that cost.
 */
function useVideoPosterBackfill(visuals: Resolved[]) {
  const { updateAttachment } = useAttachmentActions();

  useEffect(() => {
    let active = true;
    const pending = visuals.filter(
      // A `thumbnailId` means a poster exists and Sync is bringing it; a row
      // without bytes has nothing to decode.
      (visual) =>
        visual.kind === 'video' &&
        visual.row?.blob &&
        !visual.row.thumbnail &&
        !visual.row.thumbnailId
    );

    for (const visual of pending) {
      const row = visual.row;
      if (!row || posterAttempts.has(row.id)) continue;
      posterAttempts.add(row.id);

      void generateVideoPoster(row.blob!).then(({ poster, duration }) => {
        if (!active || (!poster && duration === undefined)) return;
        return updateAttachment(row.id, {
          ...(poster ? { thumbnail: poster } : {}),
          ...(duration !== undefined && row.duration === undefined ? { duration } : {}),
        });
      });
    }

    return () => {
      active = false;
    };
  }, [visuals, updateAttachment]);
}

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
          <span
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
      {extra > 0 && <OverflowCount count={extra} className="shrink-0" />}
    </div>
  );
}

// Informational, not a control: the whole card already opens the note, where the file opens.
function FileRow({ row, extra }: { row?: Attachment; extra: number }) {
  const { t, i18n } = useTranslation();
  const type = formatFileType(row?.name, row?.mime);
  const size = formatBytes(row?.size, i18n.language);

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

      {extra > 0 && <OverflowCount count={extra} className="shrink-0" />}
    </div>
  );
}

interface CardMediaProps {
  noteId: string;
  /** The note's Body HTML - the authority on which attachments exist and in what order. */
  body: string | null | undefined;
  /** Opens the note; every preview is a way into the note, never a player of its own. */
  onOpen: (intent?: Intent) => void;
  /** Rows the feed already joined on; absent means the card resolves its own. */
  attachments?: NoteAttachments;
}

/**
 * Kinds are grouped, not listed in Body order: visuals into one hero or capped wall, voice notes
 * into one player, files into one row, each with a `+N`. A card's height then follows the layout,
 * not what was attached, which keeps the wall scannable.
 */
export function CardMedia({ noteId, body, onOpen, attachments }: CardMediaProps) {
  const refs = useMemo(() => extractBodyAttachments(body), [body]);
  // Skip the query when the feed already joined the rows on, and when the Body
  // references nothing at all - most of a feed is prose.
  const ownRows = useNoteAttachments(attachments || refs.length === 0 ? null : noteId);
  const rows = attachments ?? ownRows;

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
  useVideoPosterBackfill(visuals);

  if (refs.length === 0) return null;

  return (
    <div data-slot="card-media" className="@container mb-2 flex flex-col gap-1.5">
      {visuals.length === 1 && <VisualHero visual={visuals[0]} url={urls[visuals[0].id]} />}
      {visuals.length > 1 && <VisualGrid visuals={visuals} urls={urls} />}

      {audio.length > 0 && (
        <AudioRow
          extra={audio.length - 1}
          duration={formatDuration(audio[0].row?.duration)}
          onActivate={() => onOpen({ kind: 'play' })}
        />
      )}

      {files.length > 0 && <FileRow row={files[0].row} extra={files.length - 1} />}
    </div>
  );
}

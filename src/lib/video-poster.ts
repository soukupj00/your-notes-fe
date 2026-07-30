const MAX_POSTER_EDGE = 512;
const WEBP_QUALITY = 0.75;

/** Where to sample. Not 0: many encoders open on a black or blank first frame. */
const SAMPLE_SECONDS = 0.6;

/** A clip that never reports metadata would otherwise hold the insert open. */
const DECODE_TIMEOUT_MS = 8000;

/**
 * A still frame from a video, downscaled for card rendering, plus the clip's
 * duration.
 *
 * A video attachment has no natural card preview: its bytes are a container the
 * feed must not decode, so without a stored poster the card can only show a
 * neutral plane. Capturing one frame once, at insert time, buys every later
 * render for free - the same trade `generateImageThumbnail` makes.
 *
 * Returns `{}` rather than throwing when the browser cannot decode the clip
 * (an unsupported codec, a corrupt file, a headless environment with no video
 * pipeline). A missing poster is a softer failure than a rejected attachment,
 * so the caller stores the video regardless and the card falls back.
 */
export async function generateVideoPoster(
  blob: Blob
): Promise<{ poster?: Blob; duration?: number }> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.crossOrigin = 'anonymous';

  try {
    const duration = await new Promise<number | undefined>((resolve) => {
      const timer = setTimeout(() => resolve(undefined), DECODE_TIMEOUT_MS);
      const done = (value: number | undefined) => {
        clearTimeout(timer);
        resolve(value);
      };
      video.addEventListener('loadedmetadata', () => done(video.duration), { once: true });
      video.addEventListener('error', () => done(undefined), { once: true });
      video.src = url;
    });

    if (duration === undefined) return {};

    // Seek before drawing: the frame at t=0 is often the encoder's blank lead-in,
    // and on a clip shorter than the sample point we take the midpoint instead.
    const target = Number.isFinite(duration)
      ? Math.min(SAMPLE_SECONDS, Math.max(0, duration / 2))
      : 0;
    const seeked = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), DECODE_TIMEOUT_MS);
      const done = (value: boolean) => {
        clearTimeout(timer);
        resolve(value);
      };
      video.addEventListener('seeked', () => done(true), { once: true });
      video.addEventListener('error', () => done(false), { once: true });
      video.currentTime = target;
    });

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!seeked || width <= 0 || height <= 0) {
      return { duration: Number.isFinite(duration) ? duration : undefined };
    }

    const scale = Math.min(1, MAX_POSTER_EDGE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return { duration: Number.isFinite(duration) ? duration : undefined };
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const poster = await new Promise<Blob | undefined>((resolve) => {
      canvas.toBlob((result) => resolve(result ?? undefined), 'image/webp', WEBP_QUALITY);
    });

    return { poster, duration: Number.isFinite(duration) ? duration : undefined };
  } catch {
    return {};
  } finally {
    // Detach the source before revoking, or Chromium logs a media error for the
    // element still pointing at a dead object URL.
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

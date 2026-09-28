const MAX_POSTER_EDGE = 512;
const WEBP_QUALITY = 0.75;

/** Where to sample. Not 0: many encoders open on a black or blank first frame. */
const SAMPLE_SECONDS = 0.6;

/** A clip that never reports metadata would otherwise hold the insert open. */
const DECODE_TIMEOUT_MS = 8000;

/**
 * Resolve once the element fires `event`, or `false` on `error` or timeout.
 *
 * `start` runs after the listeners are attached, because assigning `src` or
 * `currentTime` can settle synchronously on an already-buffered clip. The
 * timeout is what keeps a codec the browser never finishes decoding from
 * holding the insert open forever.
 */
function waitForMediaEvent(
  video: HTMLVideoElement,
  event: 'loadedmetadata' | 'seeked',
  start: () => void
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), DECODE_TIMEOUT_MS);
    const settle = (value: boolean) => {
      clearTimeout(timer);
      resolve(value);
    };
    video.addEventListener(event, () => settle(true), { once: true });
    video.addEventListener('error', () => settle(false), { once: true });
    start();
  });
}

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
): Promise<{ poster?: Blob; duration?: number; width?: number; height?: number }> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.crossOrigin = 'anonymous';

  try {
    const loaded = await waitForMediaEvent(video, 'loadedmetadata', () => {
      video.src = url;
    });
    if (!loaded) return {};

    // A live stream reports `Infinity`, which is a real clip with no length to
    // print and no midpoint to seek to. Resolve it once here so neither the
    // sample point nor the returned metadata has to ask again.
    const duration = Number.isFinite(video.duration) ? video.duration : undefined;
    // The frame size is known from the metadata alone; another Device reserves it (M5 slice 5).
    const metadata =
      video.videoWidth > 0 && video.videoHeight > 0
        ? { duration, width: video.videoWidth, height: video.videoHeight }
        : { duration };

    // Seek before drawing: the frame at t=0 is often the encoder's blank lead-in,
    // and on a clip shorter than the sample point we take the midpoint instead.
    const target = duration === undefined ? 0 : Math.min(SAMPLE_SECONDS, Math.max(0, duration / 2));
    const seeked = await waitForMediaEvent(video, 'seeked', () => {
      video.currentTime = target;
    });

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!seeked || width <= 0 || height <= 0) return metadata;

    const scale = Math.min(1, MAX_POSTER_EDGE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return metadata;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const poster = await new Promise<Blob | undefined>((resolve) => {
      canvas.toBlob((result) => resolve(result ?? undefined), 'image/webp', WEBP_QUALITY);
    });

    return { poster, ...metadata };
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

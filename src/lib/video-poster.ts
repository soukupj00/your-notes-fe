const MAX_POSTER_EDGE = 512;
const WEBP_QUALITY = 0.75;

/** Where to sample. Not 0: many encoders open on a black or blank first frame. */
const SAMPLE_SECONDS = 0.6;

/** A clip that never reports metadata would otherwise hold the insert open. */
const DECODE_TIMEOUT_MS = 8000;

/**
 * `start` runs after the listeners are attached, because assigning `src` or `currentTime` can
 * settle synchronously on an already-buffered clip.
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
 * Captured once at insert, because the feed must not decode a video to preview it. Returns `{}`
 * on a clip the browser cannot decode: a missing poster is softer than a rejected attachment.
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

    // A live stream reports `Infinity`: no length to print and no midpoint to seek to.
    const duration = Number.isFinite(video.duration) ? video.duration : undefined;
    // The frame size is known from the metadata alone; another Device reserves it (M5 slice 5).
    const metadata =
      video.videoWidth > 0 && video.videoHeight > 0
        ? { duration, width: video.videoWidth, height: video.videoHeight }
        : { duration };

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

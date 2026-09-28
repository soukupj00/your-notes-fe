const MAX_THUMBNAIL_EDGE = 512;
const WEBP_QUALITY = 0.75;

/** What decoding an image once at insert yields: its Preview, and its size in pixels. */
export type ImageDerivation = { thumbnail?: Blob; width?: number; height?: number };

/**
 * Downscale an image for card-feed rendering, and read its size while it is
 * decoded anyway (M5 slice 5: another Device reserves the picture's box before
 * its bytes arrive). No thumbnail when no downscale is needed or generation
 * fails, so callers fall back to the source blob; no size when it cannot be decoded.
 */
export async function generateImageThumbnail(blob: Blob): Promise<ImageDerivation> {
  let bitmap: ImageBitmap | undefined;

  try {
    bitmap = await createImageBitmap(blob);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    if (!Number.isFinite(longestEdge) || longestEdge <= 0) return {};
    const size = { width: bitmap.width, height: bitmap.height };
    if (longestEdge <= MAX_THUMBNAIL_EDGE) return size;

    const scale = MAX_THUMBNAIL_EDGE / longestEdge;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return size;
    context.drawImage(bitmap, 0, 0, width, height);

    const thumbnail = await new Promise<Blob | undefined>((resolve) => {
      canvas.toBlob((result) => resolve(result ?? undefined), 'image/webp', WEBP_QUALITY);
    });
    return { ...size, thumbnail };
  } catch {
    return {};
  } finally {
    bitmap?.close();
  }
}

const MAX_PREVIEW_EDGE = 512;
const WEBP_QUALITY = 0.75;

/** One scale and quality for an Image's and a Video's Preview; `undefined` when the browser cannot. */
export async function encodePreview(
  source: CanvasImageSource,
  width: number,
  height: number
): Promise<Blob | undefined> {
  const scale = Math.min(1, MAX_PREVIEW_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result ?? undefined), 'image/webp', WEBP_QUALITY);
  });
}

/** What decoding an image once at insert yields: its Preview, and its size in pixels. */
export type ImageDerivation = { thumbnail?: Blob; width?: number; height?: number };

/**
 * Also reads the size while decoding anyway, so another Device can reserve the picture's box before
 * its bytes arrive (M5 slice 5). No thumbnail when none is needed or it fails: use the source blob.
 */
export async function generateImageThumbnail(blob: Blob): Promise<ImageDerivation> {
  let bitmap: ImageBitmap | undefined;

  try {
    bitmap = await createImageBitmap(blob);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    if (!Number.isFinite(longestEdge) || longestEdge <= 0) return {};
    const size = { width: bitmap.width, height: bitmap.height };
    if (longestEdge <= MAX_PREVIEW_EDGE) return size;

    const thumbnail = await encodePreview(bitmap, bitmap.width, bitmap.height);
    return { ...size, thumbnail };
  } catch {
    return {};
  } finally {
    bitmap?.close();
  }
}

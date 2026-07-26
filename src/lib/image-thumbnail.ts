const MAX_THUMBNAIL_EDGE = 512;
const WEBP_QUALITY = 0.75;

/**
 * Downscale an image for card-feed rendering.
 * Returns undefined when no downscale is needed or thumbnail generation fails,
 * allowing callers to fall back to the source blob.
 */
export async function generateImageThumbnail(blob: Blob): Promise<Blob | undefined> {
  let bitmap: ImageBitmap | undefined;

  try {
    bitmap = await createImageBitmap(blob);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    if (!Number.isFinite(longestEdge) || longestEdge <= 0 || longestEdge <= MAX_THUMBNAIL_EDGE) {
      return undefined;
    }

    const scale = MAX_THUMBNAIL_EDGE / longestEdge;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return undefined;
    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise<Blob | undefined>((resolve) => {
      canvas.toBlob((thumbnail) => resolve(thumbnail ?? undefined), 'image/webp', WEBP_QUALITY);
    });
  } catch {
    return undefined;
  } finally {
    bitmap?.close();
  }
}

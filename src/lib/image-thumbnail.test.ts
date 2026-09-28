import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateImageThumbnail } from '@/lib/image-thumbnail.ts';

const drawImage = vi.fn();
const close = vi.fn();

beforeEach(() => {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 1024, height: 512, close }))
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  drawImage.mockReset();
  close.mockReset();
});

describe('generateImageThumbnail', () => {
  it('encodes a WebP thumbnail with a 512px longest edge and preserved aspect ratio', async () => {
    const thumbnail = new Blob(['thumbnail'], { type: 'image/webp' });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
      type,
      quality
    ) {
      expect(this.width).toBe(512);
      expect(this.height).toBe(256);
      expect(type).toBe('image/webp');
      expect(quality).toBe(0.75);
      callback(thumbnail);
    });

    await expect(
      generateImageThumbnail(new Blob(['source'], { type: 'image/png' }))
    ).resolves.toEqual({ thumbnail, width: 1024, height: 512 });

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 512, 256);
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not upscale an image of 512px or less, and still reports its size', async () => {
    vi.mocked(createImageBitmap).mockResolvedValue({
      width: 512,
      height: 300,
      close,
    } as unknown as ImageBitmap);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');

    await expect(
      generateImageThumbnail(new Blob(['small'], { type: 'image/png' }))
    ).resolves.toEqual({ width: 512, height: 300 });

    expect(toBlob).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it('degrades gracefully when the image cannot be decoded', async () => {
    vi.mocked(createImageBitmap).mockRejectedValue(new Error('decode failed'));

    await expect(generateImageThumbnail(new Blob(['bad']))).resolves.toEqual({});
  });
});

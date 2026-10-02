import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
import { liveRow } from '@/test/liveRow.ts';
import { VideoNodeView } from './VideoNodeView';

beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

function att(): Attachment {
  const now = new Date().toISOString();
  return {
    id: 'v1',
    noteId: 'n1',
    kind: 'video',
    mime: 'video/mp4',
    blob: new Blob(['x']),
    name: 'clip.mp4',
    createdAt: now,
    updatedAt: now,
  };
}
function props(get: (i: string) => Promise<Attachment | undefined>) {
  const watchAttachment = liveRow(get);
  return {
    node: { attrs: { attachmentId: 'v1' } },
    extension: {
      options: { getDeps: () => ({ watchAttachment, t: (k: string) => k }) },
    },
  } as unknown as Parameters<typeof VideoNodeView>[0];
}

describe('VideoNodeView', () => {
  it('resolves the blob into the video element src', async () => {
    render(<VideoNodeView {...props(async () => att())} />);
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toHaveAttribute('src', expect.stringContaining('blob:mock/'));
    });
  });
});

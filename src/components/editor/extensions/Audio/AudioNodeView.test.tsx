import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
import { AudioNodeView, formatTime } from './AudioNodeView';

beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = vi.fn();
  // jsdom's HTMLMediaElement.play/pause are not implemented.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function att(): Attachment {
  const now = new Date().toISOString();
  return {
    id: 'a1',
    noteId: 'n1',
    kind: 'audio',
    mime: 'audio/webm',
    blob: new Blob(['x']),
    name: 'memo.webm',
    duration: 14,
    createdAt: now,
    updatedAt: now,
  };
}
function props(get: (i: string) => Promise<Attachment | undefined>) {
  return {
    node: { attrs: { attachmentId: 'a1' } },
    extension: { options: { getDeps: () => ({ getAttachment: get, t: (k: string) => k }) } },
  } as unknown as Parameters<typeof AudioNodeView>[0];
}

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(14)).toBe('0:14');
    expect(formatTime(75)).toBe('1:15');
  });
});

describe('AudioNodeView', () => {
  it('resolves the blob into the audio element src and exposes a play control', async () => {
    render(<AudioNodeView {...props(async () => att())} />);
    const play = await screen.findByRole('button', { name: /play/i });
    expect(play).toBeInTheDocument();
    const audio = document.querySelector('audio');
    await waitFor(() =>
      expect(audio).toHaveAttribute('src', expect.stringContaining('blob:mock/'))
    );
  });

  it('toggles play/pause on click', async () => {
    render(<AudioNodeView {...props(async () => att())} />);
    const btn = await screen.findByRole('button', { name: /play/i });
    await userEvent.click(btn);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('shows an unavailable state when the row is missing', async () => {
    render(<AudioNodeView {...props(async () => undefined)} />);
    expect(await screen.findByText('editor.audio.unavailable')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
function props(
  get: (i: string) => Promise<Attachment | undefined>,
  opts: { isEditable?: boolean; deleteNode?: () => void } = {}
) {
  return {
    node: { attrs: { attachmentId: 'a1' } },
    editor: { isEditable: opts.isEditable ?? true, storage: {} },
    deleteNode: opts.deleteNode ?? vi.fn(),
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

  // Regression: the media listeners must attach once the hidden <audio> mounts
  // (state resolves ready AFTER first commit), not only on first render.
  it('advances the scrubber and total time from media events after the element mounts', async () => {
    render(<AudioNodeView {...props(async () => att())} />);
    // Wait for the hidden <audio> to actually mount (state resolves 'ready'
    // after the first commit) so the effect has attached its listeners.
    await waitFor(() => expect(document.querySelector('audio')).not.toBeNull());
    const audio = document.querySelector('audio') as HTMLAudioElement;

    Object.defineProperty(audio, 'duration', { value: 30, configurable: true });
    fireEvent(audio, new Event('loadedmetadata'));
    Object.defineProperty(audio, 'currentTime', { value: 6, configurable: true });
    fireEvent(audio, new Event('timeupdate'));

    await waitFor(() => expect(screen.getByText(/0:06\s*\/\s*0:30/)).toBeInTheDocument());
  });

  it('confirms before deleting: clicking trash then Remove calls deleteNode once', async () => {
    const deleteNode = vi.fn();
    render(<AudioNodeView {...props(async () => att(), { deleteNode })} />);
    await userEvent.click(await screen.findByRole('button', { name: 'editor.audio.delete' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.confirm' })
    );
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });

  it('does not delete when the confirm dialog is cancelled', async () => {
    const deleteNode = vi.fn();
    render(<AudioNodeView {...props(async () => att(), { deleteNode })} />);
    await userEvent.click(await screen.findByRole('button', { name: 'editor.audio.delete' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.cancel' })
    );
    expect(deleteNode).not.toHaveBeenCalled();
  });

  it('removes the node from the unavailable state too', async () => {
    const deleteNode = vi.fn();
    render(<AudioNodeView {...props(async () => undefined, { deleteNode })} />);
    // Let the state settle into 'missing' so we click the unavailable-state
    // button, not the loading-state one that unmounts underneath it.
    await screen.findByText('editor.audio.unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'editor.audio.delete' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.confirm' })
    );
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });

  it('hides the delete button when the editor is read-only', async () => {
    render(<AudioNodeView {...props(async () => att(), { isEditable: false })} />);
    await screen.findByRole('button', { name: /play/i });
    expect(screen.queryByRole('button', { name: 'editor.audio.delete' })).not.toBeInTheDocument();
  });

  type MockEditor = {
    isEditable: boolean;
    storage: { autoplayFirstAudioId?: string | null; autoplayReadyAudio?: Map<string, () => void> };
  };

  // Race direction 1: the editor's doc scan finds this attachment's id and
  // sets the storage flag BEFORE this element becomes ready.
  it('consumes a pre-set autoplay flag once its element becomes ready', async () => {
    const editor: MockEditor = { isEditable: true, storage: { autoplayFirstAudioId: 'a1' } };
    render(
      <AudioNodeView
        {...({
          ...props(async () => att()),
          editor,
        } as Parameters<typeof AudioNodeView>[0])}
      />
    );
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: /pause/i })).toBeInTheDocument();
    expect(editor.storage.autoplayFirstAudioId).toBeUndefined();
  });

  // Race direction 2: this element is already ready by the time the editor's
  // doc scan runs. AudioNodeView must have registered a trigger the scan can
  // call directly, since nothing re-checks the flag after the fact.
  it('registers a ready-to-play trigger a late doc scan can call directly', async () => {
    const editor: MockEditor = { isEditable: true, storage: {} };
    render(
      <AudioNodeView
        {...({
          ...props(async () => att()),
          editor,
        } as Parameters<typeof AudioNodeView>[0])}
      />
    );
    await waitFor(() => expect(document.querySelector('audio')).not.toBeNull());

    const trigger = editor.storage.autoplayReadyAudio?.get('a1');
    expect(trigger).toBeInstanceOf(Function);
    trigger?.();

    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('unregisters its ready-to-play trigger on unmount', async () => {
    const editor: MockEditor = { isEditable: true, storage: {} };
    const { unmount } = render(
      <AudioNodeView
        {...({
          ...props(async () => att()),
          editor,
        } as Parameters<typeof AudioNodeView>[0])}
      />
    );
    await waitFor(() =>
      expect(editor.storage.autoplayReadyAudio?.get('a1')).toBeInstanceOf(Function)
    );
    unmount();
    expect(editor.storage.autoplayReadyAudio?.get('a1')).toBeUndefined();
  });

  it('flips the button back to play when playback ends', async () => {
    render(<AudioNodeView {...props(async () => att())} />);
    await waitFor(() => expect(document.querySelector('audio')).not.toBeNull());
    const btn = screen.getByRole('button', { name: /play/i });
    await userEvent.click(btn);
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();

    const audio = document.querySelector('audio') as HTMLAudioElement;
    fireEvent(audio, new Event('ended'));

    expect(await screen.findByRole('button', { name: /play/i })).toBeInTheDocument();
  });
});

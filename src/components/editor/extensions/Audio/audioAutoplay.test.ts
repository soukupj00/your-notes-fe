import { describe, expect, it, vi } from 'vitest';
import { createAudioAutoplayCoordinator } from './audioAutoplay';

describe('audio autoplay coordinator', () => {
  it('plays a requested attachment when it later becomes ready', () => {
    const coordinator = createAudioAutoplayCoordinator();
    const play = vi.fn();

    coordinator.requestAutoplay('audio-1');
    coordinator.registerReadyAudio('audio-1', play);

    expect(play).toHaveBeenCalledTimes(1);
  });

  it('plays immediately when the requested attachment is already ready', () => {
    const coordinator = createAudioAutoplayCoordinator();
    const play = vi.fn();

    coordinator.registerReadyAudio('audio-1', play);
    coordinator.requestAutoplay('audio-1');

    expect(play).toHaveBeenCalledTimes(1);
  });
});

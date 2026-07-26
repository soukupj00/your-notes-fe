import { useEffect, useRef } from 'react';

/** Number of amplitude bars visible in the scrolling history. */
const BAR_COUNT = 40;
const BAR_GAP_RATIO = 0.35;
/** How often a new bar is sampled - a voice-memo cadence, not per-frame. */
const SAMPLE_INTERVAL_MS = 80;
/** Bars never fully flatten, so silence still reads as "listening". */
const MIN_BAR_HEIGHT_RATIO = 0.12;
/** Applied to sqrt(peak) (see readPeak) so quiet speech still reads as tall
 *  bars instead of a near-flat line - a straight linear gain leaves normal
 *  speaking volume looking barely audible. */
const AMPLITUDE_GAIN = 1.6;

/** Live mic amplitude history. Taps the recording MediaStream with a Web Audio
 *  AnalyserNode, samples one peak amplitude value on an interval, and renders
 *  it as a scrolling bar history (voice-memo style) instead of redrawing a raw
 *  time-domain waveform every animation frame - the raw oscilloscope is
 *  inherently jittery since `smoothingTimeConstant` does not apply to
 *  time-domain data. Owns its AudioContext lifecycle: the context and the
 *  sampling interval are torn down when the stream changes or the component
 *  unmounts, so no audio graph outlives the mic. */
export function RecordingWaveform({ stream }: { stream: MediaStream | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!stream || !canvas) return;
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const audioCtx = new AudioCtx();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const bars: number[] = [];

    // Peak (not RMS) within the buffer: RMS averages over the whole window
    // including near-zero crossings, which flattens ordinary speech to a
    // barely-visible line. A single-sample peak reacts to the loudest instant
    // in each ~12ms window, which is what a voice-memo bar should track.
    const readPeak = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      return peak;
    };

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('color').trim() || 'currentColor';

      const slot = width / BAR_COUNT;
      const barWidth = slot * (1 - BAR_GAP_RATIO);
      const minHeight = height * MIN_BAR_HEIGHT_RATIO;
      bars.forEach((amp, i) => {
        // sqrt compresses the 0-1 range so quiet talking (small amp) still
        // gets a visible boost, not just loud peaks.
        const scaled = Math.min(1, Math.sqrt(amp) * AMPLITUDE_GAIN);
        const barHeight = Math.max(minHeight, scaled * height);
        const x = i * slot + (slot - barWidth) / 2;
        const y = (height - barHeight) / 2;
        ctx.fillRect(x, y, barWidth, barHeight);
      });
    };

    const sample = () => {
      bars.push(readPeak());
      if (bars.length > BAR_COUNT) bars.shift();
      draw();
    };
    sample();
    const interval = window.setInterval(sample, SAMPLE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      source.disconnect();
      analyser.disconnect();
      void audioCtx.close();
    };
  }, [stream]);

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={40}
      aria-hidden
      className="h-10 w-full text-primary"
    />
  );
}

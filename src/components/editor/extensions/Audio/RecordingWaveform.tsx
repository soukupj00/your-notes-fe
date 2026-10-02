import { useEffect, useRef } from 'react';

const BAR_COUNT = 40;
const BAR_GAP_RATIO = 0.35;
/** How often a new bar is sampled - a voice-memo cadence, not per-frame. */
const SAMPLE_INTERVAL_MS = 80;
/** Bars never fully flatten, so silence still reads as "listening". */
const MIN_BAR_HEIGHT_RATIO = 0.12;
/** Applied to sqrt(peak): a linear gain leaves normal speaking volume looking barely audible. */
const AMPLITUDE_GAIN = 1.6;

/** A scrolling bar history sampled on an interval, not a per-frame raw waveform, which
 *  jitters because `smoothingTimeConstant` skips time-domain data. The AudioContext is
 *  closed with the stream, so no audio graph outlives the mic. */
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

    // Peak, not RMS: RMS averages in the zero crossings and flattens ordinary speech.
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

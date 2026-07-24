import { useEffect, useRef } from 'react';

/** Live mic waveform. Taps the recording MediaStream with a Web Audio
 *  AnalyserNode and paints the time-domain samples onto a canvas via
 *  requestAnimationFrame. Owns its AudioContext lifecycle: the context and the
 *  animation frame are torn down when the stream changes or the component
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

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      analyser.getByteTimeDomainData(data);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('color').trim() || 'currentColor';
      ctx.beginPath();
      const step = width / data.length;
      for (let i = 0; i < data.length; i++) {
        // Samples are centered at 128; map [0,255] -> [0,height].
        const y = (data[i] / 255) * height;
        const x = i * step;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
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

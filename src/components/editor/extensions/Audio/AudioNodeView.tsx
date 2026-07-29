import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { icons } from '@/components/icons';
import { AttachmentDeleteButton } from '../attachments/AttachmentDeleteButton';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** Seconds -> "m:ss". */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Editor render path for audioAttachment: a hidden native <audio> (decode/seek
 *  engine) skinned with a themed play/pause + time + scrubber. Object-URL
 *  lifecycle handled by the shared hook. */
export function AudioNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.getAttachment);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const Play = icons.Play;
  const Pause = icons.Pause;
  const canDelete = props.editor?.isEditable ?? false;

  const deleteButton = canDelete ? (
    <AttachmentDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t('editor.audio.delete')}
      t={deps.t}
    />
  ) : null;

  // Callback ref: the hidden <audio> only mounts once state resolves 'ready'
  // (after the loading commit), so a plain useEffect with [] would run while the
  // element is still null and wire nothing. Attaching here fires exactly when the
  // element mounts; React 19 runs the returned cleanup when it unmounts.
  const bindAudio = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el;
    if (!el) return;
    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onPause);
    return () => {
      audioRef.current = null;
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onPause);
    };
  }, []);

  // Best-effort autoplay: the browser's native media events are the only
  // source of truth for the control state. A rejected play() therefore leaves
  // the Play icon showing instead of reporting playback that never started.
  const attemptPlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    try {
      void el.play().catch(() => {});
    } catch {
      // Ignore - autoplay can be rejected by the browser's mobile policy.
    }
  }, []);

  const autoplay = props.editor.storage.audioAttachment.autoplay;

  // Synchronize this mounted media element with the external TipTap autoplay
  // coordinator. Registration covers both load orderings and unregisters when
  // the node view is no longer ready or unmounts.
  useEffect(() => {
    if (state.status !== 'ready' || !attachmentId) return;
    return autoplay.registerReadyAudio(attachmentId, attemptPlay);
  }, [state.status, attachmentId, autoplay, attemptPlay]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      attemptPlay();
    }
  };

  const seek = (v: number) => {
    const el = audioRef.current;
    if (el) el.currentTime = v;
    setCurrent(v);
  };

  if (state.status === 'missing') {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-muted-foreground text-sm">
          <span className="flex-1 text-center">{deps.t('editor.audio.unavailable')}</span>
          {deleteButton}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
        <button
          type="button"
          onClick={toggle}
          disabled={state.status !== 'ready'}
          aria-label={deps.t(playing ? 'editor.audio.pause' : 'editor.audio.play')}
          className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={duration || (state.status === 'ready' ? (state.attachment.duration ?? 0) : 0)}
          value={current}
          step={0.1}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={deps.t('editor.audio.seek')}
          className="h-1 flex-1 accent-primary"
        />
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatTime(current)} /{' '}
          {formatTime(
            duration || (state.status === 'ready' ? (state.attachment.duration ?? 0) : 0)
          )}
        </span>
        {deleteButton}
        {state.status === 'ready' && (
          <audio ref={bindAudio} src={state.url} preload="metadata" className="hidden">
            <track kind="captions" />
          </audio>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export default AudioNodeView;

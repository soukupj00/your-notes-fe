import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { icons } from '@/components/icons';
import { formatElapsed } from '@/lib/format-attachment.ts';
import { AttachmentDeleteButton } from '../attachments/AttachmentDeleteButton';
import { AttachmentNotDownloaded } from '../attachments/AttachmentNotDownloaded';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** A hidden native <audio> decodes and seeks; the visible controls are ours. */
export function AudioNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.watchAttachment);
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

  // A callback ref, because the <audio> mounts only once the URL is ready: an effect with []
  // would run while it is still null. React 19 runs the returned cleanup on unmount.
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

  // Native media events are the only source of truth for the controls, so a rejected
  // autoplay leaves the Play icon showing rather than claiming playback.
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

  // The autoplay coordinator covers either load order (audioAutoplay.ts).
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

  if (state.status === 'remote') {
    return (
      <AttachmentNotDownloaded
        attachment={state.attachment}
        deps={deps}
        fallbackName={deps.t('editor.audio.label')}
        deleteButton={
          canDelete ? (
            <AttachmentDeleteButton
              onConfirm={() => props.deleteNode()}
              label={deps.t('editor.audio.delete')}
              t={deps.t}
              overlay
            />
          ) : null
        }
      />
    );
  }

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
          className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary"
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
          {formatElapsed(current)} /{' '}
          {formatElapsed(
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

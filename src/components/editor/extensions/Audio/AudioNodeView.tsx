import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { icons } from '@/components/icons';
import { AttachmentDeleteButton } from '../attachments/AttachmentDeleteButton';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

declare module '@tiptap/core' {
  interface Storage {
    /** One-shot "autoplay this attachment once its <audio> is ready" flag, set
     *  by the editor when the note was opened via its card's audio chip. Used
     *  when the doc scan runs BEFORE the target attachment's blob has loaded. */
    autoplayFirstAudioId?: string | null;
    /** Registry of ready-to-play triggers keyed by attachmentId, populated by
     *  each AudioNodeView once its <audio> element is ready. Used when the doc
     *  scan runs AFTER the target attachment is already ready - the two attachment
     *  loads (note body, attachment blob) race independently, so either can
     *  finish first; this registry plus the flag above cover both orderings. */
    autoplayReadyAudio?: Map<string, () => void>;
  }
}

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
    const onEnd = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnd);
    return () => {
      audioRef.current = null;
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnd);
    };
  }, []);

  // Best-effort autoplay: attempt play() and only reflect it in the UI once
  // playback actually starts - a rejected play() (mobile autoplay policy) must
  // leave the Play icon showing, not flip to Pause.
  const attemptPlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    try {
      const result = el.play();
      if (result && typeof result.then === 'function') {
        result.then(() => setPlaying(true)).catch(() => {});
      } else {
        setPlaying(true);
      }
    } catch {
      // Ignore - autoplay can be rejected by the browser's mobile policy.
    }
  }, []);

  // Best-effort autoplay-on-open: consume the one-shot storage flag exactly
  // when this attachment's <audio> element becomes available. Covers the case
  // where the editor's doc scan (finding the target attachmentId) finishes
  // BEFORE this element is ready.
  useEffect(() => {
    if (state.status !== 'ready') return;
    const storage = props.editor?.storage;
    if (!storage || storage.autoplayFirstAudioId !== attachmentId) return;
    delete storage.autoplayFirstAudioId;
    attemptPlay();
  }, [state.status, attachmentId, props.editor, attemptPlay]);

  // The other race direction: this element may already be ready by the time
  // the editor's doc scan runs (the note-body load and the attachment-blob
  // load are two independent async chains with no ordering guarantee between
  // them). Register a trigger the scan can call directly instead of relying
  // on the flag above, which nothing re-checks once this effect has already
  // run once.
  useEffect(() => {
    if (state.status !== 'ready' || !attachmentId) return;
    const storage = props.editor?.storage;
    if (!storage) return;
    if (!storage.autoplayReadyAudio) storage.autoplayReadyAudio = new Map();
    storage.autoplayReadyAudio.set(attachmentId, attemptPlay);
    return () => {
      if (storage.autoplayReadyAudio?.get(attachmentId) === attemptPlay) {
        storage.autoplayReadyAudio.delete(attachmentId);
      }
    };
  }, [state.status, attachmentId, props.editor, attemptPlay]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
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

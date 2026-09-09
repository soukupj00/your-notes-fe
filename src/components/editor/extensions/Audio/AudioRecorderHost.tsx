import type { Editor } from '@tiptap/core';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { icons } from '@/components/icons';
import { formatElapsed } from '@/lib/format-attachment.ts';
import type { AttachmentDeps } from '../attachments/deps';
import { RecordingWaveform } from './RecordingWaveform';
import { useAudioRecorder } from './useAudioRecorder';

export interface AudioRecorderHostProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
}

/** RecorderError code -> translation key. 'denied' keeps the legacy 'permission'
 *  key; the rest are distinct so the toast tells the true cause. */
const ERROR_KEY: Record<string, string> = {
  denied: 'editor.audio.errors.permission',
  unsupported: 'editor.audio.errors.unsupported',
  'no-device': 'editor.audio.errors.no-device',
  'in-use': 'editor.audio.errors.in-use',
  failed: 'editor.audio.errors.failed',
};

const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

/**
 * The one recorder an editor has. Mounted by the Editor for as long as it is
 * editable, whatever the toolbar shows: the mic button used to own this, and on
 * a phone that button sits inside a collapsed menu, so a "Voice note" started
 * from the speed dial waited for a recorder that only existed once the user
 * happened to open that menu.
 *
 * Renders nothing until a take is running, then the take's controls (timer,
 * waveform, Cancel, Stop) in the editor's own flow, above the note bar and the
 * toolbar - a place that exists on every layout.
 */
export function AudioRecorderHost({ editor, getDeps }: AudioRecorderHostProps) {
  const rec = useAudioRecorder();
  const capture = editor.storage.audioAttachment.capture;
  const Square = icons.Square;

  useEffect(() => {
    if (rec.status === 'error') {
      toast(getDeps().t(ERROR_KEY[rec.error ?? 'failed'] ?? ERROR_KEY.failed));
    }
  }, [rec.status, rec.error, getDeps]);

  const start = rec.start;
  useEffect(() => capture.registerRecorder(() => void start()), [capture, start]);

  const recording = rec.status === 'recording';
  useEffect(() => {
    capture.setRecording(recording);
    return () => capture.setRecording(false);
  }, [capture, recording]);

  const onStop = async () => {
    const out = await rec.stop();
    if (!out) return;
    const deps = getDeps();
    try {
      const noteId = await deps.getNoteId();
      const ext = EXT[out.mime.split(';')[0]] ?? 'webm';
      const file = new File([out.blob], `recording.${ext}`, { type: out.mime });
      // The recorder already measured this; persisting it is what lets a card
      // show a clip's length without decoding the audio on the feed.
      const att = await deps.createAttachment(noteId, file, 'audio', {
        duration: out.durationMs / 1000,
      });
      editor.chain().focus().insertAudioAttachment({ attachmentId: att.id }).run();
    } catch {
      deps.onError('insert-failed');
    }
  };

  if (!recording) return null;

  const t = getDeps().t;
  return (
    <fieldset className="my-2 flex flex-col gap-3 rounded-md border border-border bg-card p-3 shadow-rest">
      <legend className="sr-only">{t('editor.audio.recording')}</legend>
      <div className="flex items-center gap-2">
        <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
        <span className="text-xs tabular-nums">{formatElapsed(rec.elapsedMs / 1000)}</span>
      </div>
      <RecordingWaveform stream={rec.stream} />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => rec.cancel()}
          className="touch-target rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-muted"
        >
          {t('editor.audio.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void onStop()}
          className="touch-target flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-primary-foreground text-xs transition-colors hover:bg-primary/90"
        >
          <Square className="size-3.5" />
          {t('editor.audio.stop')}
        </button>
      </div>
    </fieldset>
  );
}

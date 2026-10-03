import type { Editor } from '@tiptap/core';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { icons } from '@/components/icons';
import { useLatest } from '@/hooks/useLatest.ts';
import { AttachmentError, fileExtension } from '@/lib/attachments.ts';
import { formatElapsed } from '@/lib/format.ts';
import { insertAttachmentNode } from '../attachments/createAttachmentNode';
import type { AttachmentDeps } from '../attachments/deps';
import { RecordingWaveform } from './RecordingWaveform';
import { useAudioRecorder } from './useAudioRecorder';

export interface AudioRecorderHostProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
}

/** 'denied' keeps the legacy 'permission' key. */
const ERROR_KEY: Record<string, string> = {
  denied: 'editor.audio.errors.permission',
  unsupported: 'editor.audio.errors.unsupported',
  'no-device': 'editor.audio.errors.no-device',
  'in-use': 'editor.audio.errors.in-use',
  failed: 'editor.audio.errors.failed',
};

/** The editor's one recorder, mounted while the editor is editable whatever the toolbar
 *  shows, so a voice note started from the dial never waits on a collapsed menu.
 *  See src/components/editor/CLAUDE.md, Audio. */
export function AudioRecorderHost({ editor, getDeps }: AudioRecorderHostProps) {
  const rec = useAudioRecorder();
  const capture = editor.storage.audioAttachment.capture;
  const Square = icons.Square;

  // Read through a stable getter: a parent handing in a new `getDeps` each render must not
  // re-run this effect, or one error toasts on every keystroke.
  const deps = useLatest(getDeps());
  useEffect(() => {
    if (rec.status === 'error') {
      toast(deps().t(ERROR_KEY[rec.error ?? 'failed'] ?? ERROR_KEY.failed));
    }
  }, [rec.status, rec.error, deps]);

  // The take's promise is handed over, so the coordinator knows when the
  // request is really answered (or torn down with this host before it was).
  const start = rec.start;
  useEffect(() => capture.registerRecorder(start), [capture, start]);

  const recording = rec.status === 'recording';
  useEffect(() => {
    capture.setRecording(recording);
    return () => capture.setRecording(false);
  }, [capture, recording]);

  const onStop = async () => {
    const out = await rec.stop();
    if (!out) return;
    const d = deps();
    try {
      const noteId = await d.getNoteId();
      const ext = fileExtension('audio', out.mime) ?? 'webm';
      const file = new File([out.blob], `recording.${ext}`, { type: out.mime });
      // The recorder already measured this; persisting it is what lets a card
      // show a clip's length without decoding the audio on the feed.
      const att = await d.createAttachment(noteId, file, 'audio', {
        duration: out.durationMs / 1000,
      });
      insertAttachmentNode(editor, 'audio', att.id);
    } catch (err) {
      d.onError(err instanceof AttachmentError ? err.code : 'insert-failed', 'audio');
    }
  };

  if (!recording) return null;

  const t = deps().t;
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

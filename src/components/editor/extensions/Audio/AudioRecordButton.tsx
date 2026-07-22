import type { Editor } from '@tiptap/core';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { icons } from '@/components/icons';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { ALLOWED_AUDIO_MIME } from '@/lib/attachments.ts';
import type { AttachmentDeps } from '../attachments/deps';
import { insertAttachmentFiles } from '../attachments/insert';
import { formatTime } from './AudioNodeView';
import { useAudioRecorder } from './useAudioRecorder';

export interface AudioRecordButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

/** Toolbar entry point for audio: a mic button that toggles an inline record
 *  widget (timer + Stop + Cancel) and offers a file picker. Recording -> Blob ->
 *  audio attachment; picked files -> shared insert pipeline. */
export function AudioRecordButton({ editor, getDeps, tooltip }: AudioRecordButtonProps) {
  const rec = useAudioRecorder();
  const inputRef = useRef<HTMLInputElement>(null);
  const Square = icons.Square;

  // Recorder errors (permission denied / unsupported) surface as a toast.
  useEffect(() => {
    if (rec.status === 'error') {
      const key =
        rec.error === 'unsupported'
          ? 'editor.audio.errors.unsupported'
          : 'editor.audio.errors.permission';
      toast(getDeps().t(key));
    }
  }, [rec.status, rec.error, getDeps]);

  const insert = (id: string) =>
    editor.chain().focus().insertAudioAttachment({ attachmentId: id }).run();

  const onStop = async () => {
    const out = await rec.stop();
    if (!out) return;
    const deps = getDeps();
    try {
      const noteId = await deps.getNoteId();
      const ext = EXT[out.mime.split(';')[0]] ?? 'webm';
      const file = new File([out.blob], `recording.${ext}`, { type: out.mime });
      const att = await deps.createAttachment(noteId, file, 'audio');
      insert(att.id);
    } catch {
      deps.onError('insert-failed');
    }
  };

  if (!rec.supported) {
    return <ActionButton icon="Mic" tooltip={tooltip} disabled action={() => {}} />;
  }

  if (rec.status === 'recording') {
    const t = getDeps().t;
    return (
      <span className="flex items-center gap-2 rounded-md border px-2 py-1">
        <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
        <span className="text-xs tabular-nums">{formatTime(rec.elapsedMs / 1000)}</span>
        <button
          type="button"
          onClick={() => void onStop()}
          aria-label={t('editor.audio.stop')}
          className="text-xs"
        >
          <Square className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => rec.cancel()}
          aria-label={t('editor.audio.cancel')}
          className="text-muted-foreground text-xs"
        >
          {t('editor.audio.cancel')}
        </button>
      </span>
    );
  }

  return (
    <>
      <ActionButton icon="Mic" tooltip={tooltip} action={() => void rec.start()} />
      {/* File-attach affordance: reuses the same node insertion via the shared
          pipeline. paste/drop (Task 9) also attach audio files. */}
      <ActionButton
        icon="Paperclip"
        tooltip={getDeps().t('editor.audio.attach')}
        action={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_AUDIO_MIME.join(',')}
        className="hidden"
        onChange={(e) => {
          if (e.target.files)
            void insertAttachmentFiles(editor, e.target.files, 'audio', getDeps(), insert);
          e.target.value = '';
        }}
      />
    </>
  );
}

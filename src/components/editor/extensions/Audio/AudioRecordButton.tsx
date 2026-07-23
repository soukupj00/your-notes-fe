import type { Editor } from '@tiptap/core';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { icons } from '@/components/icons';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover.tsx';
import { ALLOWED_AUDIO_MIME } from '@/lib/attachments.ts';
import type { AttachmentDeps } from '../attachments/deps';
import { insertAttachmentFiles } from '../attachments/insert';
import { formatTime } from './AudioNodeView';
import { RecordingWaveform } from './RecordingWaveform';
import { useAudioRecorder } from './useAudioRecorder';

export interface AudioRecordButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
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

/** Toolbar entry point for audio: a mic button that opens a recording popover
 *  (live waveform + timer + Stop + Cancel) and offers a file picker. Recording ->
 *  Blob -> audio attachment; picked files -> shared insert pipeline. */
export function AudioRecordButton({ editor, getDeps, tooltip }: AudioRecordButtonProps) {
  const rec = useAudioRecorder();
  const inputRef = useRef<HTMLInputElement>(null);
  const Square = icons.Square;

  // Recorder errors surface as a toast. Each cause gets its own message so
  // "no microphone found" is not misreported as a permission denial.
  useEffect(() => {
    if (rec.status === 'error') {
      toast(getDeps().t(ERROR_KEY[rec.error ?? 'failed'] ?? ERROR_KEY.failed));
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

  const t = getDeps().t;
  const recording = rec.status === 'recording';

  return (
    <Popover
      open={recording}
      onOpenChange={(open) => {
        // Closing the popover (Esc / click-outside) aborts the current take.
        if (!open && recording) rec.cancel();
      }}
    >
      <PopoverAnchor asChild>
        <span className="inline-flex items-center">
          <ActionButton
            icon="Mic"
            tooltip={tooltip}
            disabled={recording}
            action={() => void rec.start()}
          />
          {/* File-attach affordance: reuses the same node insertion via the
              shared pipeline. paste/drop (Task 9) also attach audio files. */}
          <ActionButton
            icon="Paperclip"
            tooltip={t('editor.audio.attach')}
            disabled={recording}
            action={() => inputRef.current?.click()}
          />
        </span>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-64" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
            <span className="text-xs tabular-nums">{formatTime(rec.elapsedMs / 1000)}</span>
          </div>
          <RecordingWaveform stream={rec.stream} />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => rec.cancel()}
              className="rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-muted"
            >
              {t('editor.audio.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void onStop()}
              className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-primary-foreground text-xs"
            >
              <Square className="size-3.5" />
              {t('editor.audio.stop')}
            </button>
          </div>
        </div>
      </PopoverContent>
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
    </Popover>
  );
}

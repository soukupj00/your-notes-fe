import type { Editor } from '@tiptap/core';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { icons } from '@/components/icons';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover.tsx';
import { formatElapsed } from '@/lib/format-attachment.ts';
import type { AttachmentDeps } from '../attachments/deps';
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
 *  (live waveform + timer + Stop + Cancel). Recording -> Blob -> audio attachment.
 *  File uploads (including .mp3 etc.) go through the generic File extension's
 *  toolbar button instead - this button is record-only. */
export function AudioRecordButton({ editor, getDeps, tooltip }: AudioRecordButtonProps) {
  const rec = useAudioRecorder();
  const Square = icons.Square;

  // Recorder errors surface as a toast. Each cause gets its own message so
  // "no microphone found" is not misreported as a permission denial.
  useEffect(() => {
    if (rec.status === 'error') {
      toast(getDeps().t(ERROR_KEY[rec.error ?? 'failed'] ?? ERROR_KEY.failed));
    }
  }, [rec.status, rec.error, getDeps]);

  // "New audio note" opens the editor and expects the mic to be live already.
  // The editor asks; this button owns the recorder, so it answers - through the
  // storage coordinator, since the two mount independently.
  const start = rec.start;
  useEffect(() => {
    return editor.storage.audioAttachment.capture.registerRecorder(() => void start());
  }, [editor, start]);

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
      // The recorder already measured this; persisting it is what lets a card
      // show a clip's length without decoding the audio on the feed.
      const att = await deps.createAttachment(noteId, file, 'audio', {
        duration: out.durationMs / 1000,
      });
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
        <ActionButton
          icon="Mic"
          tooltip={tooltip}
          disabled={recording}
          action={() => void rec.start()}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-[calc(100vw-2rem)] sm:w-64"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
            <span className="text-xs tabular-nums">{formatElapsed(rec.elapsedMs / 1000)}</span>
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
              className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-primary-foreground text-xs transition-colors hover:bg-primary/90"
            >
              <Square className="size-3.5" />
              {t('editor.audio.stop')}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

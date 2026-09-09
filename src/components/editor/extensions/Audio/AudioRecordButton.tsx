import type { Editor } from '@tiptap/core';
import { useSyncExternalStore } from 'react';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { AttachmentDeps } from '../attachments/deps';

export interface AudioRecordButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** Toolbar entry point for audio. A request, not a recorder: the recorder is
 *  `AudioRecorderHost`, mounted by the Editor whatever the toolbar shows, so
 *  this button can sit inside a collapsed menu or be switched off entirely and
 *  a take still has an owner. File uploads (including .mp3 etc.) go through the
 *  generic File extension's toolbar button instead - this is record-only. */
export function AudioRecordButton({ editor, tooltip }: AudioRecordButtonProps) {
  const capture = editor.storage.audioAttachment.capture;
  const recording = useSyncExternalStore(capture.subscribe, capture.isRecording, () => false);
  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  return (
    <ActionButton
      icon="Mic"
      tooltip={tooltip}
      disabled={!supported || recording}
      action={() => capture.requestRecording()}
    />
  );
}

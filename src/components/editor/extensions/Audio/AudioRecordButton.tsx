import type { Editor } from '@tiptap/core';
import { useSyncExternalStore } from 'react';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { AttachmentDeps } from '../attachments/deps';

export interface AudioRecordButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** A request, not a recorder: `AudioRecorderHost` owns the take, so this button can sit in a
 *  collapsed menu or be switched off. Record-only; uploads go through the File button. */
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

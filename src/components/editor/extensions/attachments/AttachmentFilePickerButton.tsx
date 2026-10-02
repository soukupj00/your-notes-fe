import { useRef } from 'react';
import { ActionButton, type ActionButtonProps } from '@/components/ui/ActionButton.tsx';
import { ATTACHMENT_SPECS } from '@/lib/attachments.ts';
import type { AttachmentKind } from '@/models.ts';
import type { ButtonView } from '../button-types';
import type { AttachmentNodeConfig } from './createAttachmentNode';
import { insertFiles } from './insert';

export interface AttachmentFilePickerButtonProps {
  icon: NonNullable<ActionButtonProps['icon']>;
  tooltip: string;
  accept?: string;
  onFiles: (files: File[]) => void;
}

export function AttachmentFilePickerButton({
  icon,
  tooltip,
  accept,
  onFiles,
}: AttachmentFilePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <ActionButton icon={icon} tooltip={tooltip} action={() => inputRef.current?.click()} />
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) onFiles(Array.from(event.target.files));
          event.target.value = '';
        }}
      />
    </>
  );
}

/** The toolbar button of a kind whose files come from a picker. */
export function pickerButton(
  kind: AttachmentKind,
  icon: AttachmentFilePickerButtonProps['icon']
): AttachmentNodeConfig['button'] {
  return ({ editor, getDeps, t }): ButtonView<typeof AttachmentFilePickerButton> => ({
    component: AttachmentFilePickerButton,
    componentProps: {
      icon,
      tooltip: t(`editor.${kind}.tooltip`),
      accept: ATTACHMENT_SPECS[kind].accept,
      // Deps are read after the pick, so the button sees the freshest getNoteId.
      onFiles: (files) => void insertFiles(kind, editor, files, getDeps()),
    },
  });
}

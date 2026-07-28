import { useRef } from 'react';
import { ActionButton, type ActionButtonProps } from '@/components/ui/ActionButton.tsx';

interface AttachmentFilePickerButtonProps {
  icon: NonNullable<ActionButtonProps['icon']>;
  tooltip: string;
  accept?: string;
  onFiles: (files: File[]) => void;
}

/** Shared hidden-input workflow for editor attachment toolbar buttons. */
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

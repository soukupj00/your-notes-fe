import { type ReactNode, useRef } from 'react';
import type { NoteOpenRequest } from '@/components/notes/NotesView.tsx';
import type { QuickCaptureAction } from '@/components/notes/quickCaptureActions.ts';

/**
 * One hidden file input a capture bar owns, opened synchronously inside a
 * Start's tap - the only moment a browser lets a picker open - and reporting
 * the chosen files as part of the open request. Both bars use it, so the two
 * cannot differ in what a picker Start does.
 */
export function useStartPicker(onStart: (editing: NoteOpenRequest) => void): {
  input: ReactNode;
  open: (action: QuickCaptureAction) => void;
} {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<QuickCaptureAction | null>(null);

  const open = (action: QuickCaptureAction) => {
    const input = inputRef.current;
    if (!action.picker || !input) return;
    pendingRef.current = action;
    input.accept = action.picker.accept;
    if (action.picker.capture) input.setAttribute('capture', action.picker.capture);
    else input.removeAttribute('capture');
    input.click();
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      className="hidden"
      data-testid="start-picker"
      onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        const action = pendingRef.current;
        pendingRef.current = null;
        if (files.length && action) onStart({ ...action.editing, files });
      }}
    />
  );

  return { input, open };
}

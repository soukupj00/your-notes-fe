import { type ReactNode, useRef } from 'react';
import type { QuickCaptureAction } from '@/components/notes/quickCaptureActions.ts';
import type { Intent } from '@/lib/intent.ts';

/**
 * Begins a Start. A picker Start opens the OS picker synchronously inside the tap, the only moment
 * a browser lets it open (CLAUDE.md, Nav shell), and the chosen files become the Intent; any other
 * Start is handed straight on. Both capture bars use it, so a Start behaves the same in each.
 */
export function useStartPicker(onStart: (intent?: Intent) => void): {
  input: ReactNode;
  start: (action: QuickCaptureAction) => void;
} {
  const inputRef = useRef<HTMLInputElement>(null);
  // A change event counts only if `start` opened the picker.
  const pendingRef = useRef(false);

  const start = (action: QuickCaptureAction) => {
    if (!action.picker) {
      onStart(action.intent);
      return;
    }
    const input = inputRef.current;
    if (!input) return;
    pendingRef.current = true;
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
        const pending = pendingRef.current;
        pendingRef.current = false;
        if (files.length && pending) onStart({ kind: 'files', files });
      }}
    />
  );

  return { input, start };
}

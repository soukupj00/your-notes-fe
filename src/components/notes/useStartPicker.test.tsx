import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Intent } from '@/lib/intent.ts';
import { QUICK_CAPTURE_ACTIONS } from './quickCaptureActions.ts';
import { useStartPicker } from './useStartPicker.tsx';

/** The hook under a bar with one button per Start, as both real bars render it. */
function Bar({ onStart }: { onStart: (intent?: Intent) => void }) {
  const picker = useStartPicker(onStart);
  return (
    <>
      {QUICK_CAPTURE_ACTIONS.map((action) => (
        <button key={action.key} type="button" onClick={() => picker.start(action)}>
          {action.key}
        </button>
      ))}
      {picker.input}
    </>
  );
}

describe('useStartPicker', () => {
  it.each([
    ['text', undefined],
    ['checklist', { kind: 'checklist' }],
    ['audio', { kind: 'record' }],
    ['drawing', { kind: 'draw' }],
  ])(
    'hands a %s Start straight on with its Intent, never through the picker',
    async (key, intent) => {
      const onStart = vi.fn();
      render(<Bar onStart={onStart} />);
      const click = vi.spyOn(screen.getByTestId('start-picker'), 'click');

      await userEvent.click(screen.getByRole('button', { name: key }));

      expect(onStart).toHaveBeenCalledWith(intent);
      expect(click).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['picture', 'image/*', null],
    ['camera', 'image/*', 'environment'],
  ])(
    '%s opens the picker inside the tap and starts with the chosen files',
    async (key, accept, capture) => {
      // The tap's user activation is the only thing that can open a picker, and it does not
      // survive the route change to the editor, so the files, not the request, are what travel.
      const onStart = vi.fn();
      render(<Bar onStart={onStart} />);
      const input = screen.getByTestId('start-picker') as HTMLInputElement;
      const click = vi.spyOn(input, 'click');

      await userEvent.click(screen.getByRole('button', { name: key }));

      expect(click).toHaveBeenCalledTimes(1);
      expect(input.accept).toBe(accept);
      expect(input.getAttribute('capture')).toBe(capture);
      expect(onStart).not.toHaveBeenCalled();

      const file = new File(['x'], 'a.png', { type: 'image/png' });
      await userEvent.upload(input, file);

      expect(onStart).toHaveBeenCalledWith({ kind: 'files', files: [file] });
    }
  );
});

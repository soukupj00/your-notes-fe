import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuickCaptureBar } from './QuickCaptureBar.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The editor pulls in TipTap/Excalidraw; only its checklist constant is needed.
vi.mock('@/components/notes/NoteEditorDialog.tsx', () => ({
  NoteEditorDialog: () => null,
  EMPTY_CHECKLIST_BODY: '<ul data-type="taskList"></ul>',
}));

async function openDial() {
  const onStart = vi.fn();
  render(<QuickCaptureBar onStart={onStart} />);
  await userEvent.click(screen.getByRole('button', { name: 'notes.capture.open' }));
  return onStart;
}

describe('QuickCaptureBar', () => {
  it('starts collapsed to a single button', () => {
    render(<QuickCaptureBar onStart={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'notes.capture.open' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.capture.audio' })).not.toBeInTheDocument();
  });

  it('expands into the five ways to start a note', async () => {
    await openDial();

    for (const key of ['text', 'checklist', 'audio', 'drawing', 'picture']) {
      expect(await screen.findByRole('button', { name: `notes.capture.${key}` })).toBeVisible();
    }
  });

  it.each([
    ['text', { id: null }],
    ['checklist', { id: null, initialBody: '<ul data-type="taskList"></ul>' }],
    ['audio', { id: null, capture: 'audio' }],
    ['drawing', { id: null, capture: 'drawing' }],
    ['picture', { id: null, capture: 'picture' }],
  ])('opens the editor in the %s state', async (key, expected) => {
    const onStart = await openDial();

    await userEvent.click(await screen.findByRole('button', { name: `notes.capture.${key}` }));

    expect(onStart).toHaveBeenCalledWith(expected);
  });

  it('collapses again once an action is taken', async () => {
    await openDial();

    await userEvent.click(await screen.findByRole('button', { name: 'notes.capture.text' }));

    expect(screen.queryByRole('button', { name: 'notes.capture.audio' })).not.toBeInTheDocument();
  });
});

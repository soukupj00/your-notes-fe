import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { db } from '@/db/db.ts';
import { QuickCaptureBar } from './QuickCaptureBar.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Motion preference is orthogonal to this interaction suite.
vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => true,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);

afterEach(async () => {
  await db.settings.clear();
});

async function openDial() {
  const onStart = vi.fn();
  render(<QuickCaptureBar onStart={onStart} />, { wrapper });
  await userEvent.click(screen.getByRole('button', { name: 'notes.capture.open' }));
  return onStart;
}

describe('QuickCaptureBar', () => {
  it('starts collapsed to a single button', () => {
    render(<QuickCaptureBar onStart={vi.fn()} />, { wrapper });

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
    [
      'checklist',
      {
        id: null,
        initialBody:
          '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
      },
    ],
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

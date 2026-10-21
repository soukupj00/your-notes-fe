import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NoteColorButton } from './NoteColorButton.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('NoteColorButton', () => {
  // Opening focuses the first swatch, whose tooltip would otherwise take the first Escape.
  it('closes on one Escape', async () => {
    render(<NoteColorButton onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'notes.color' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'colors.default' })).toHaveFocus()
    );

    await userEvent.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'colors.default' })).not.toBeInTheDocument()
    );
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { ASSIGNABLE_NOTE_COLORS } from '@/lib/note-colors.ts';
import { NoteColorPicker } from './NoteColorPicker.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mount = (props: Partial<React.ComponentProps<typeof NoteColorPicker>> = {}) =>
  render(
    <TooltipProvider>
      <NoteColorPicker onChange={vi.fn()} {...props} />
    </TooltipProvider>
  );

describe('NoteColorPicker', () => {
  it('names every swatch, so identity is never carried by hue alone', () => {
    // The palette's non-colour redundancy. No palette makes nine hues reliably
    // separable under dichromacy, so the name has to be reachable for all of
    // them - not only the ones that happen to look distinct.
    mount();

    for (const token of ASSIGNABLE_NOTE_COLORS) {
      expect(screen.getByRole('button', { name: `colors.${token}` })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'colors.default' })).toBeInTheDocument();
  });

  it('reports the chosen token rather than a colour value', async () => {
    const onChange = vi.fn();
    mount({ onChange });

    await userEvent.click(screen.getByRole('button', { name: 'colors.teal' }));

    expect(onChange).toHaveBeenCalledWith('teal');
  });

  it('clears the colour rather than storing a token for "no colour"', async () => {
    const onChange = vi.fn();
    mount({ onChange, value: 'teal' });

    await userEvent.click(screen.getByRole('button', { name: 'colors.default' }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('marks the active token pressed and everything else unpressed', () => {
    mount({ value: 'pink' });

    expect(screen.getByRole('button', { name: 'colors.pink' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'colors.blue' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });
});

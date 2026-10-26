import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PickerTiles } from './PickerTiles.tsx';

const OPTIONS = [
  { value: 'left', label: 'Left', picture: <span /> },
  { value: 'right', label: 'Right', picture: <span /> },
] as const;

function mount(value: 'left' | 'right' = 'left') {
  const onChange = vi.fn();
  render(
    <PickerTiles label="Placement" value={value} options={[...OPTIONS]} onChange={onChange} />
  );
  return onChange;
}

describe('PickerTiles', () => {
  it('is a radio group named by its label, one radio per option, the value checked', () => {
    mount('right');

    const group = screen.getByRole('radiogroup', { name: 'Placement' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Left' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Right' })).toBeChecked();
  });

  it('chooses a tile on click', async () => {
    const onChange = mount('left');

    await userEvent.click(screen.getByRole('radio', { name: 'Right' }));

    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('moves the choice with the arrow keys', async () => {
    const onChange = mount('left');
    screen.getByRole('radio', { name: 'Left' }).focus();

    await userEvent.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith('right');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeleteButton, EditButton, SaveButton } from './EntityActionButtons.tsx';

describe('entity action buttons', () => {
  it('provides default labels, icons, and semantic variants', () => {
    render(
      <>
        <SaveButton />
        <DeleteButton />
        <EditButton />
      </>
    );

    expect(screen.getByRole('button', { name: 'Save' }).querySelector('.lucide-save')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Delete' }).querySelector('.lucide-trash-2')
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Edit' }).querySelector('.lucide-pencil')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-destructive');
  });

  it('allows parents to override labels and ordinary button props', () => {
    render(<SaveButton label="Store drawing" disabled />);

    expect(screen.getByRole('button', { name: 'Store drawing' })).toBeDisabled();
  });
});

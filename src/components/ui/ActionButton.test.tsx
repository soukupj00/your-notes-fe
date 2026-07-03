import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionButton } from './ActionButton';
import { TooltipProvider } from './tooltip';

function renderButton(props: React.ComponentProps<typeof ActionButton>) {
  return render(
    <TooltipProvider>
      <ActionButton {...props} />
    </TooltipProvider>
  );
}

describe('ActionButton', () => {
  it('exposes the tooltip as the accessible name for an icon-only button', () => {
    renderButton({ icon: 'Bold', tooltip: 'Bold', toggle: true });
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  });

  it('reflects active state via data-state for toggle styling', () => {
    renderButton({ icon: 'List', tooltip: 'Bullet list', toggle: true, isActive: () => true });
    expect(screen.getByRole('button', { name: 'Bullet list' })).toHaveAttribute('data-state', 'on');
  });
});

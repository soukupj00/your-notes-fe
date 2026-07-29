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

  // The media/undo buttons are not toggles, so they used to fall through to the
  // Button `default` variant and render as filled primary (purple) slabs beside
  // the flat toggle buttons. They must stay ghost.
  it('renders a non-toggle button flat, not as a filled primary button', () => {
    renderButton({ icon: 'Mic', tooltip: 'Record audio' });
    expect(screen.getByRole('button', { name: 'Record audio' })).not.toHaveClass('bg-primary');
  });
});

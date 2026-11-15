import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { IconTooltip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

describe('IconTooltip', () => {
  it('shows the label beside the button it wraps, with no provider above it', async () => {
    render(
      <IconTooltip label="Archive">
        <button type="button" aria-label="Archive note">
          x
        </button>
      </IconTooltip>
    );

    await userEvent.hover(screen.getByRole('button', { name: 'Archive note' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Archive');
  });
});

describe('TooltipTrigger', () => {
  function renderTip() {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button">Bold</button>
          </TooltipTrigger>
          <TooltipContent>Bold tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    return screen.getByRole('button', { name: 'Bold' });
  }

  it('opens when a key press moves focus to it', async () => {
    renderTip();

    await userEvent.tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Bold tip');
  });

  it('stays closed when focus arrives after a pointer, as it does on a tap', () => {
    const button = renderTip();

    fireEvent.pointerDown(document.body);
    fireEvent.focus(button);

    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

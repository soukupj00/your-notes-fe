import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { IconTooltip } from './tooltip';

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

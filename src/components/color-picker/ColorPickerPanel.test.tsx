import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ColorPickerPanel } from './ColorPickerPanel';
import { CARD_COLORS } from './palettes';

function renderPanel(onChange = vi.fn()) {
  return render(
    <TooltipProvider>
      <ColorPickerPanel palette={CARD_COLORS} value="" onChange={onChange} />
    </TooltipProvider>
  );
}

describe('ColorPickerPanel', () => {
  it('renders one swatch button per palette color plus the Custom button', () => {
    renderPanel();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(CARD_COLORS.colors.length + 1);
  });

  it('clicking a swatch fires onChange with its cssValue', () => {
    const onChange = vi.fn();
    renderPanel(onChange);
    const red = CARD_COLORS.colors.find((c) => c.label === 'Red');
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    expect(onChange).toHaveBeenCalledWith(red?.cssValue);
  });

  it('clicking the Default swatch fires onChange with an empty string', () => {
    const onChange = vi.fn();
    renderPanel(onChange);
    fireEvent.click(screen.getByRole('button', { name: 'Default' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('the custom picker is hidden until the Custom button is clicked', () => {
    renderPanel();
    expect(document.querySelector('.react-colorful')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /custom/i }));
    expect(document.querySelector('.react-colorful')).not.toBeNull();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defaultToolbarLayout, toolbarPreset } from './presets';
import { resolveLayout } from './resolveLayout';
import { ToolbarPreviewStrip } from './ToolbarPreviewStrip';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const strip = () => screen.getByTestId('toolbar-preview');
/** One icon box per slot the bar would draw. */
const slots = () => strip().querySelectorAll('svg').length;

describe('ToolbarPreviewStrip', () => {
  it('draws one slot per button the bar would show', () => {
    const layout = defaultToolbarLayout('wide');
    render(<ToolbarPreviewStrip layout={layout} widthClass="wide" />);

    const expected = resolveLayout(layout, 'wide').reduce(
      // A collapsed family is one trigger with a chevron next to it, so it draws
      // two icons rather than one.
      (total, entry) => total + (entry.collapsed ? 2 : entry.items.length),
      0
    );
    expect(slots()).toBe(expected);
  });

  it('is hidden from assistive tech, which has the ordered list instead', () => {
    render(<ToolbarPreviewStrip layout={defaultToolbarLayout('wide')} widthClass="wide" />);

    expect(strip()).toHaveAttribute('aria-hidden');
  });

  it('scrolls rather than wrapping on compact, like the bar it pictures', () => {
    render(
      <ToolbarPreviewStrip layout={toolbarPreset('everything', 'compact')} widthClass="compact" />
    );

    expect(strip()).toHaveClass('overflow-x-auto');
    expect(strip()).not.toHaveClass('flex-wrap');
  });

  it('shows nothing at all for a Layout with every family off', () => {
    render(
      <ToolbarPreviewStrip
        layout={defaultToolbarLayout('wide').map((family) => ({ ...family, on: false }))}
        widthClass="wide"
      />
    );

    expect(slots()).toBe(0);
  });
});

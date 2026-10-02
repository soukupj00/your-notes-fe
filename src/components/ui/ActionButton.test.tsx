import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionButton, MenuRowLabelProvider } from './ActionButton';
import { TooltipProvider } from './tooltip';

function renderButton(
  props: React.ComponentProps<typeof ActionButton>,
  options?: { menuRowLabel?: string }
) {
  const button = <ActionButton {...props} />;
  return render(
    <TooltipProvider delayDuration={0}>
      {options?.menuRowLabel === undefined ? (
        button
      ) : (
        <MenuRowLabelProvider value={options.menuRowLabel}>{button}</MenuRowLabelProvider>
      )}
    </TooltipProvider>
  );
}

/**
 * The shared setup stubs `matchMedia` as never matching, so without this the desktop
 * `(pointer: fine)` branch is unreachable.
 */
function stubPointer(fine: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('pointer: fine') ? fine : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ActionButton', () => {
  it('exposes the tooltip as the accessible name for an icon-only button', () => {
    renderButton({ icon: 'Bold', tooltip: 'Bold', toggle: true });
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  });

  it('reflects active state via data-state for toggle styling', () => {
    renderButton({ icon: 'List', tooltip: 'Bullet list', toggle: true, isActive: () => true });
    expect(screen.getByRole('button', { name: 'Bullet list' })).toHaveAttribute('data-state', 'on');
  });

  // Non-toggle buttons used to fall through to Button's filled `default` variant
  // beside the flat toggles. They must stay ghost.
  it('renders a non-toggle button flat, not as a filled primary button', () => {
    renderButton({ icon: 'Mic', tooltip: 'Record audio' });
    expect(screen.getByRole('button', { name: 'Record audio' })).not.toHaveClass('bg-primary');
  });

  // A `PopoverTrigger asChild` writes `open`/`closed` over `data-state`, so every
  // button that opens a popover lost its highlight.
  it('carries its active styling as a class, not only as data-state', () => {
    renderButton({ icon: 'Baseline', tooltip: 'Text color', toggle: true, isActive: () => true });
    expect(screen.getByRole('button', { name: 'Text color' })).toHaveClass('bg-accent');
  });

  it('leaves an inactive toggle unstyled', () => {
    renderButton({ icon: 'Baseline', tooltip: 'Text color', toggle: true, isActive: () => false });
    expect(screen.getByRole('button', { name: 'Text color' })).not.toHaveClass('bg-accent');
  });

  describe('keyboard shortcut hints', () => {
    it('shows the shortcut in the tooltip on a device with a pointer', async () => {
      stubPointer(true);
      renderButton({ icon: 'Bold', tooltip: 'Bold', toggle: true, shortcutKeys: ['Mod', 'B'] });

      await userEvent.hover(screen.getByRole('button', { name: 'Bold' }));

      expect(await screen.findByRole('tooltip')).toHaveTextContent(/Bold.*\+/);
    });

    it('hides it on touch, where there are no keys to press', async () => {
      stubPointer(false);
      renderButton({ icon: 'Bold', tooltip: 'Bold', toggle: true, shortcutKeys: ['Mod', 'B'] });

      await userEvent.hover(screen.getByRole('button', { name: 'Bold' }));

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('Bold');
      expect(tooltip.textContent).not.toMatch(/\+/);
    });
  });

  describe('as a row in a collapsed family menu', () => {
    it('takes its name from the menu rather than from whoever rendered it', () => {
      // The point of the context: `link`, the attachment pickers and the colour triggers
      // wrap an ActionButton, so they can never be handed a label directly.
      renderButton({ icon: 'Link2', tooltip: 'Link' }, { menuRowLabel: 'Link' });
      expect(screen.getByRole('button', { name: 'Link' })).toHaveTextContent('Link');
    });

    it('drops the tooltip, which would float over the popover it belongs to', async () => {
      stubPointer(true);
      renderButton(
        { icon: 'Bold', tooltip: 'Bold', toggle: true, shortcutKeys: ['Mod', 'B'] },
        { menuRowLabel: 'Bold' }
      );

      await userEvent.hover(screen.getByRole('button', { name: 'Bold' }));

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});

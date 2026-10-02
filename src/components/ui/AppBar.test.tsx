import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppBar } from '@/components/ui/AppBar.tsx';

const bar = () => document.querySelector('[data-slot="app-bar"]') as HTMLElement;

describe('AppBar', () => {
  it('renders all three slots', () => {
    render(<AppBar left={<button type="button">back</button>} center="Archive" right="gear" />);

    expect(screen.getByRole('button', { name: 'back' })).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('gear')).toBeInTheDocument();
  });

  // An empty side slot would still cost a `gap-2`, leaving the bar looking
  // padded on one edge and not the other on the routes that carry no gear.
  it('omits a side slot rather than rendering it empty', () => {
    render(<AppBar center="Settings" />);

    expect(bar().children).toHaveLength(1);
  });

  // Flex shrinks the sides first, but a long title must truncate rather than squeeze
  // a 44px control below the floor.
  it('lets only the middle flex', () => {
    render(<AppBar left="L" center="C" right="R" />);

    const [left, center, right] = Array.from(bar().children);
    expect(left).toHaveClass('shrink-0');
    expect(right).toHaveClass('shrink-0');
    expect(center).toHaveClass('flex-1', 'min-w-0');
  });
});

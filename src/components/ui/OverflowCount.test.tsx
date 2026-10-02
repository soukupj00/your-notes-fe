import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverflowCount } from './OverflowCount.tsx';

describe('OverflowCount', () => {
  it('keeps its 11px label size', () => {
    // tailwind-merge reads `text-label` as a colour and drops it, so assert the class
    // survives rather than the text.
    render(<OverflowCount count={2} />);
    expect(screen.getByText('+2').className).toContain('text-label');
  });

  it("still takes a caller's layout classes", () => {
    render(<OverflowCount count={2} className="shrink-0" />);
    expect(screen.getByText('+2').className).toContain('shrink-0');
  });
});

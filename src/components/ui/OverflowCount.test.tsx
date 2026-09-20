import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverflowCount } from './OverflowCount.tsx';

describe('OverflowCount', () => {
  it('keeps its 11px label size', () => {
    // `text-label` is the project's own type token, not one of Tailwind's own
    // sizes, so tailwind-merge classes it as a text *colour* and drops it in
    // favour of the `text-note-on-chip` that follows. The chip then renders at
    // the inherited body size - which is why this asserts the class survives
    // rather than asserting the text reads "+2".
    render(<OverflowCount count={2} />);
    expect(screen.getByText('+2').className).toContain('text-label');
  });

  it("still takes a caller's layout classes", () => {
    render(<OverflowCount count={2} className="shrink-0" />);
    expect(screen.getByText('+2').className).toContain('shrink-0');
  });
});
